"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Plus, Repeat } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/responsive-dialog";
import { InputAmount } from "@/components/input-amount";
import { useSubscriptionsCatalog } from "@/domains/subscriptions/use-cases/get-subscriptions-catalog";
import { useCreateSubscription } from "@/domains/subscriptions/use-cases/create-subscription";
import type {
  SubscriptionChannelPickMode,
  SubscriptionSourceType,
} from "@/domains/subscriptions/types/subscriptions";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CreateSubscriptionDialog() {
  const [open, setOpen] = useState(false);
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
    setTopN((prev) => prev ?? catalog.topNOptions[0] ?? null);
  }, [catalog]);

  const selectedSource = useMemo(
    () => catalog?.sources.find((s) => s.id === sourceType),
    [catalog, sourceType],
  );
  const isChannelSource = selectedSource?.kind === "CHANNEL";

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

  function resetForm() {
    setSourceType(catalog?.sources[0]?.id ?? null);
    setChannelPickMode("INVESTIR");
    setTopN(catalog?.topNOptions[0] ?? null);
    setStakePerEvent(undefined);
    setDaysOfWeek([]);
    setCompetitionCodes([]);
    setStartDate(new Date());
    setEndDate(undefined);
    createMutation.reset();
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

    try {
      await createMutation.mutateAsync({
        sourceType,
        channelPickMode: isChannelSource ? channelPickMode : null,
        topN: isChannelSource ? topN : null,
        stakePerEvent,
        daysOfWeek,
        competitionCodes,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
      });
      setOpen(false);
      resetForm();
    } catch {
      // Erreur affichée via createMutation.error ci-dessous.
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetForm();
      }}
      // Le Popover du MultiCombobox (compétitions) porte son contenu dans un
      // portail séparé du Dialog/Drawer — avec le piège de focus par défaut
      // (modal), les clics/saisies dans ce popover imbriqué ne sont pas reçus
      // (bug Radix/vaul connu). modal={false} désactive ce piège de focus
      // pour ce dialogue précis, sans quoi le combobox reste inerte.
      modal={false}
    >
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <Plus size={14} />
        Nouvel abonnement
      </Button>

      <ResponsiveDialogContent className="bg-panel p-6 sm:max-w-2xl lg:max-w-3xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Repeat size={16} className="text-accent" />
            Nouvel abonnement
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Une discipline figée : source, mise, jours, période. Suivi
            automatique, sans lien avec le portefeuille réel.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {!catalog ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-0">
            Chargement du catalogue…
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4 sm:px-0 sm:pb-0"
          >
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select
                value={sourceType ?? undefined}
                onValueChange={(v) =>
                  setSourceType(v as SubscriptionSourceType)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {catalog.sources.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isChannelSource ? (
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <div className="space-y-1.5">
                  <Label>Sélection des picks quotidiens</Label>
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
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Nombre de picks / jour</Label>
                  <Select
                    value={topN !== null ? String(topN) : undefined}
                    onValueChange={(v) => setTopN(Number(v))}
                  >
                    <SelectTrigger className="w-full sm:w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {catalog.topNOptions.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          Top {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label>Mise par événement</Label>
              <InputAmount value={stakePerEvent} onChange={setStakePerEvent} />
            </div>

            <div className="space-y-2">
              <Label>Jours de semaine</Label>
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
                    {day.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Championnats (optionnel, en plus des jours cochés)</Label>
              <div className="flex flex-wrap gap-1.5">
                {catalog.leaguePresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.competitionCodes)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-accent hover:text-accent"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <MultiCombobox
                options={competitionOptions}
                value={competitionCodes}
                onChange={setCompetitionCodes}
                placeholder="Choisir des championnats..."
                searchPlaceholder="Rechercher un championnat..."
                emptyLabel="Aucun championnat trouvé."
              />
            </div>

            {dayConditionMissing ? (
              <p className="text-xs text-destructive">
                Coche au moins un jour de semaine ou choisis au moins un
                championnat.
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date de début</Label>
                <DatePicker value={startDate} onChange={setStartDate} />
              </div>
              <div className="space-y-1.5">
                <Label>Date de fin</Label>
                <DatePicker
                  value={endDate}
                  onChange={setEndDate}
                  placeholder={todayIsoDate()}
                />
              </div>
            </div>
            {startDate && endDate && endDate <= startDate ? (
              <p className="text-xs text-destructive">
                La date de fin doit être après la date de début.
              </p>
            ) : null}

            {createMutation.isError ? (
              <p className="text-xs text-destructive">
                {createMutation.error instanceof Error
                  ? createMutation.error.message
                  : "Impossible de créer l'abonnement."}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={!canSubmit || createMutation.isPending}
              className="mt-2 gap-2"
            >
              <Repeat size={14} />
              {createMutation.isPending ? "Création…" : "Créer l'abonnement"}
            </Button>
          </form>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
