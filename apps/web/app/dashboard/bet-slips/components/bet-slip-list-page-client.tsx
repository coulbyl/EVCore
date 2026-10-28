"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Receipt } from "lucide-react";
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  FilterBar,
  Page,
  PageContent,
  PageHeader,
  PageHeaderTitle,
} from "@evcore/ui";
import type { FilterDef, FilterState } from "@evcore/ui";
import { todayIso, daysAgoIso } from "@/lib/date";
import { useBetSlips } from "@/domains/bet-slip/use-cases/get-bet-slips";
import { useOperatorSummary } from "@/domains/bet-slip/use-cases/get-operator-summary";
import { useTranslations } from "next-intl";
import { useIsSingleColumn } from "@/hooks/use-mobile";
import type { BetSlipView } from "@/domains/bet-slip/types/bet-slip";
import { BetSlipCard } from "./bet-slip-card";
import { sumSlipResults } from "./bet-slip-constants";
import { BetSlipDetailPanel } from "./bet-slip-detail-panel";
import { SlipsResultLine } from "./slips-result-line";

type SlipTypeFilter = "ALL" | BetSlipView["type"];

function buildSlipFilters(t: ReturnType<typeof useTranslations>): FilterDef[] {
  return [
    {
      key: "type",
      type: "select",
      label: t("filter.type"),
      options: [
        { value: "ALL", label: t("filter.all") },
        { value: "SIMPLE", label: t("filter.single") },
        { value: "COMBO", label: t("filter.combo") },
      ],
    },
    { key: "from", type: "date", label: t("filter.from") },
    { key: "to", type: "date", label: t("filter.to") },
  ];
}

export function BetSlipListPageClient() {
  const t = useTranslations("betSlips");
  const slipFilters = useMemo(() => buildSlipFilters(t), [t]);
  const [filterState, setFilterState] = useState<FilterState>({
    type: "ALL",
    from: daysAgoIso(7),
    to: todayIso(),
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const from = (filterState.from as string) || "";
  const to = (filterState.to as string) || "";
  const typeFilter = ((filterState.type as string) || "ALL") as SlipTypeFilter;

  const { data, isLoading, isError, refetch } = useBetSlips(from, to);
  const betSlips = useMemo(() => data ?? [], [data]);
  // Toutes périodes confondues : distingue « jamais joué » de « rien entre
  // ces dates ». Un nouvel arrivant n'a rien à filtrer (revue UX du
  // 2026-10-11, P1-9).
  const { data: lifetime } = useOperatorSummary();
  const neverPlayed = lifetime !== undefined && lifetime.slipCount === 0;
  // Tablette comprise : entre 768 et 1023 px, ni tiroir ni colonne de
  // détail ne s'affichait, et toucher un coupon ne montrait rien.
  const singleColumn = useIsSingleColumn();

  const selectedSlip = betSlips.find((s) => s.id === selectedId) ?? null;
  const filteredBetSlips = useMemo(
    () =>
      typeFilter === "ALL"
        ? betSlips
        : betSlips.filter((slip) => slip.type === typeFilter),
    [betSlips, typeFilter],
  );

  const totals = useMemo(
    () => sumSlipResults(filteredBetSlips),
    [filteredBetSlips],
  );

  function handleSelect(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  function handleClose() {
    setSelectedId(null);
  }

  const filter = (
    <div className="shrink-0 flex flex-col gap-3 rounded-[1.1rem] border border-border bg-panel p-4">
      {betSlips.length > 0 ? (
        <SlipsResultLine
          from={from || daysAgoIso(7)}
          to={to || todayIso()}
          totals={totals}
          lifetime={lifetime?.money}
        />
      ) : null}
      <FilterBar
        filters={slipFilters}
        value={filterState}
        onChange={setFilterState}
        onReset={() =>
          setFilterState({ type: "ALL", from: daysAgoIso(7), to: todayIso() })
        }
      />
    </div>
  );

  // Sans ces deux états, un chargement lent ou une erreur réseau affichait
  // « Tes coupons existent, mais pas entre ces dates » (revue UX du
  // 2026-10-27).
  const items = isLoading ? (
    <p className="p-4 text-sm text-muted-foreground" role="status">
      {t("loading")}
    </p>
  ) : isError ? (
    <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
      <EmptyHeader>
        <EmptyTitle>{t("loadError")}</EmptyTitle>
      </EmptyHeader>
      <Button variant="outline" onClick={() => void refetch()}>
        {t("retry")}
      </Button>
    </Empty>
  ) : filteredBetSlips.length === 0 ? (
    neverPlayed ? (
      <Empty
        data-testid="bet-slips-never-played"
        className="rounded-3xl border border-dashed border-border bg-panel/70 p-8"
      >
        <EmptyHeader>
          <Receipt size={28} className="mx-auto text-muted-foreground/40" />
          <EmptyTitle>{t("neverPlayedTitle")}</EmptyTitle>
          <EmptyDescription>{t("neverPlayedBody")}</EmptyDescription>
        </EmptyHeader>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent/80"
        >
          {t("neverPlayedLink")} <ArrowRight size={14} />
        </Link>
      </Empty>
    ) : (
      <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
        <EmptyHeader>
          <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
          <EmptyDescription>
            {betSlips.length > 0
              ? t("emptyTypeDescription")
              : t("emptyDescription")}
          </EmptyDescription>
        </EmptyHeader>
        {betSlips.length === 0 && (
          <Button
            variant="outline"
            onClick={() =>
              setFilterState({
                type: "ALL",
                from: daysAgoIso(90),
                to: todayIso(),
              })
            }
          >
            {t("widenPeriod")}
          </Button>
        )}
      </Empty>
    )
  ) : (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
      {filteredBetSlips.map((betSlip) => (
        <BetSlipCard
          key={betSlip.id}
          betSlip={betSlip}
          selected={betSlip.id === selectedId}
          onClick={() => handleSelect(betSlip.id)}
        />
      ))}
    </div>
  );

  return (
    <Page className="flex h-full flex-col">
      <PageHeader className="flex-col items-start gap-1 lg:flex-col lg:items-start lg:justify-start">
        <PageHeaderTitle>{t("title")}</PageHeaderTitle>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          {t("intro")}
        </p>
      </PageHeader>
      <PageContent
        data-tour="bet-slips-summary"
        className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-5 ev-shell-shadow"
      >
        {/* Plus d'onglet « Classement des joueurs » : classer des parieurs par
            ROI dès 5 coupons récompense la chance et pousse à jouer plus
            (audit du 2026-10-23, P2-9). */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="hidden min-h-0 flex-1 lg:grid lg:grid-cols-[3fr_2fr] lg:grid-rows-1 lg:gap-5">
            <div className="flex min-h-0 flex-col gap-4">
              {!neverPlayed && filter}
              <div className="min-h-0 flex-1 overflow-y-auto">{items}</div>
            </div>
            <div className="h-full min-h-0">
              {selectedSlip ? (
                <BetSlipDetailPanel data={selectedSlip} onClose={handleClose} />
              ) : (
                <div className="flex h-full items-center justify-center rounded-[1.35rem] border border-dashed border-border bg-secondary">
                  <p className="text-sm text-muted-foreground">
                    {t("selectHint")}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 lg:hidden">
            {!neverPlayed && filter}
            {/* pb-24 : le bouton flottant ne recouvre plus la dernière carte. */}
            <div className="min-h-0 flex-1 overflow-y-auto pb-24">{items}</div>
          </div>
        </div>
      </PageContent>

      {singleColumn && (
        <Drawer
          open={selectedSlip !== null}
          onOpenChange={(open) => !open && handleClose()}
          direction="bottom"
        >
          <DrawerContent className="z-50 flex max-h-[92dvh] flex-col rounded-t-3xl bg-panel outline-none">
            <DrawerTitle className="sr-only">{t("detailTitle")}</DrawerTitle>
            {selectedSlip && (
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">
                <BetSlipDetailPanel data={selectedSlip} onClose={handleClose} />
              </div>
            )}
          </DrawerContent>
        </Drawer>
      )}
    </Page>
  );
}
