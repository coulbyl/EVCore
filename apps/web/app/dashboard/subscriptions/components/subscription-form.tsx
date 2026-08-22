"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Button,
  Checkbox,
  DatePicker,
  Label,
  MultiCombobox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@evcore/ui";
import { Repeat } from "lucide-react";
import { InputAmount } from "@/components/input-amount";
import { useSubscriptionsCatalog } from "@/domains/subscriptions/use-cases/get-subscriptions-catalog";
import { useCreateSubscription } from "@/domains/subscriptions/use-cases/create-subscription";
import type {
  SubscriptionChannelPickMode,
  SubscriptionSourceType,
} from "@/domains/subscriptions/types/subscriptions";
import {
  leaguePresetLabel,
  pickModeLabel,
  weekdayFullLabel,
} from "../subscriptions-constants";
import { SubscriptionSourceSelect } from "./subscription-source-select";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SubscriptionForm() {
  const t = useTranslations("subscriptions");
  const router = useRouter();
  const { data: catalog } = useSubscriptionsCatalog();
  const createMutation = useCreateSubscription();

  const [sourceType, setSourceType] = useState<SubscriptionSourceType | null>(
    null,
  );
  const [channelPickMode, setChannelPickMode] =
    useState<SubscriptionChannelPickMode>("INVESTIR");
  const [topN, setTopN] = useState<number | null>(null);
  const [stakePerEvent, setStakePerEvent] = useState<number | undefined>();
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [competitionCodes, setCompetitionCodes] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>();

  // Le catalogue arrive de façon asynchrone — initialise les champs verrouillés
  // dès qu'il est disponible plutôt que de figer une valeur par défaut en dur.
  useEffect(() => {
    if (!catalog) return;
    setSourceType((prev) => prev ?? catalog.sources[0]?.id ?? null);
  }, [catalog]);

  const selectedSource = useMemo(
    () => catalog?.sources.find((s) => s.id === sourceType),
    [catalog, sourceType],
  );
  const isChannelSource = selectedSource?.kind === "CHANNEL";
  const topNOptions = useMemo(
    () => selectedSource?.topNOptions ?? [],
    [selectedSource],
  );

  // topN est propre au canal choisi (ex. VALUE n'offre pas top3) — recale sur
  // une option valide dès que la source change, plutôt que de laisser une
  // valeur obsolète issue du canal précédent.
  useEffect(() => {
    if (topNOptions.length === 0) return;
    setTopN((prev) =>
      prev !== null && topNOptions.includes(prev) ? prev : topNOptions[0]!,
    );
  }, [topNOptions]);

  const competitionOptions = useMemo(
    () =>
      (catalog?.competitions ?? []).map((c) => ({
        value: c.code,
        label: `${c.name} (${c.country})`,
      })),
    [catalog],
  );

  function toggleDay(value: number) {
    setDaysOfWeek((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
    );
  }

  function applyPreset(codes: string[]) {
    setCompetitionCodes((prev) => Array.from(new Set([...prev, ...codes])));
  }

  const dayConditionMissing =
    daysOfWeek.length === 0 && competitionCodes.length === 0;
  const canSubmit =
    sourceType !== null &&
    stakePerEvent !== undefined &&
    stakePerEvent >= 1 &&
    !dayConditionMissing &&
    startDate !== undefined &&
    endDate !== undefined &&
    endDate > startDate;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !canSubmit ||
      !startDate ||
      !endDate ||
      stakePerEvent === undefined ||
      sourceType === null
    ) {
      return;
    }

    const created = await createMutation.mutateAsync({
      sourceType,
      channelPickMode: isChannelSource ? channelPickMode : null,
      topN: isChannelSource ? topN : null,
      stakePerEvent,
      daysOfWeek,
      competitionCodes,
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
    });
    router.push(`/dashboard/subscriptions/${created.id}`);
  }

  if (!catalog) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("form.loadingCatalog")}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-5">
      <div className="space-y-1.5">
        <Label>{t("form.sourceLabel")}</Label>
        <SubscriptionSourceSelect
          sources={catalog.sources}
          value={sourceType}
          onChange={(v) => setSourceType(v)}
        />
        {selectedSource?.roiShrunk !== null &&
          selectedSource?.roiShrunk !== undefined && (
            <p className="text-[0.68rem] text-muted-foreground">
              {t("form.sourceRoiHint", {
                roi: `${selectedSource.roiShrunk >= 0 ? "+" : "−"}${Math.abs(selectedSource.roiShrunk * 100).toFixed(1)}%`,
                n: selectedSource.roiSampleSize ?? 0,
              })}
            </p>
          )}
      </div>

      {isChannelSource ? (
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <Label>{t("form.pickModeLabel")}</Label>
            <Select
              value={channelPickMode}
              onValueChange={(v) =>
                setChannelPickMode(v as SubscriptionChannelPickMode)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {catalog.channelPickModes.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {pickModeLabel(m.id, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("form.topNLabel")}</Label>
            <Select
              value={topN !== null ? String(topN) : undefined}
              onValueChange={(v) => setTopN(Number(v))}
            >
              <SelectTrigger className="w-full sm:w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {topNOptions.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {t("topN", { n })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label>{t("form.stakeLabel")}</Label>
        <InputAmount value={stakePerEvent} onChange={setStakePerEvent} />
      </div>

      <div className="space-y-2">
        <Label>{t("form.weekdaysLabel")}</Label>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {catalog.weekdays.map((day) => (
            <label
              key={day.value}
              className="flex items-center gap-1.5 text-sm text-foreground"
            >
              <Checkbox
                checked={daysOfWeek.includes(day.value)}
                onCheckedChange={() => toggleDay(day.value)}
              />
              {weekdayFullLabel(day.value, t)}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("form.leaguesLabel")}</Label>
        <div className="flex flex-wrap gap-1.5">
          {catalog.leaguePresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.competitionCodes)}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-accent hover:text-accent"
            >
              {leaguePresetLabel(preset.id, t)}
            </button>
          ))}
        </div>
        <MultiCombobox
          options={competitionOptions}
          value={competitionCodes}
          onChange={setCompetitionCodes}
          placeholder={t("form.leaguesPlaceholder")}
          searchPlaceholder={t("form.leaguesSearchPlaceholder")}
          emptyLabel={t("form.leaguesEmpty")}
        />
      </div>

      {dayConditionMissing ? (
        <p className="text-xs text-destructive">
          {t("form.dayConditionMissing")}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("form.startDateLabel")}</Label>
          <DatePicker value={startDate} onChange={setStartDate} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("form.endDateLabel")}</Label>
          <DatePicker
            value={endDate}
            onChange={setEndDate}
            placeholder={todayIsoDate()}
          />
        </div>
      </div>
      {startDate && endDate && endDate <= startDate ? (
        <p className="text-xs text-destructive">
          {t("form.endDateBeforeStart")}
        </p>
      ) : null}

      {createMutation.isError ? (
        <p className="text-xs text-destructive">
          {createMutation.error instanceof Error
            ? createMutation.error.message
            : t("form.createError")}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={!canSubmit || createMutation.isPending}
        className="mt-2 gap-2 self-start"
      >
        <Repeat size={14} />
        {createMutation.isPending ? t("form.submitting") : t("form.submit")}
      </Button>
    </form>
  );
}
