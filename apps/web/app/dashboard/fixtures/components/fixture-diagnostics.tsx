"use client";

import { Check, ShoppingCart } from "lucide-react";
import {
  Badge,
  cn,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  StatCard,
} from "@evcore/ui";
import { useTranslations } from "next-intl";
import {
  fixtureStatusLabel,
  formatCombinedPickForDisplay,
} from "@/helpers/fixture";
import {
  formatScore,
  isFixtureBettable,
} from "@/domains/fixture/helpers/fixture";
import { useBetSlip } from "@/domains/bet-slip/context/bet-slip-context";
import { draftItemKey } from "@/domains/bet-slip/types/bet-slip";
import type { BetSlipDraftItem } from "@/domains/bet-slip/types/bet-slip";
import type {
  FixtureEvaluatedPickSnapshot,
  FixtureRow,
} from "@/domains/fixture/types/fixture";
import { CanalBadge } from "@/components/canal-badge";
import {
  FixtureFactorBar,
  type FixtureFactorDef,
} from "@/components/fixture-factor-bar";

// ── helpers ──────────────────────────────────────────────────────────────────

type BadgeVariant =
  | "accent"
  | "success"
  | "warning"
  | "destructive"
  | "neutral";
type Translator = ReturnType<typeof useTranslations>;

function fixtureStatusTone(status: string): BadgeVariant {
  const s = status.toLowerCase();
  if (s === "finished") return "neutral";
  if (s === "in_progress") return "accent";
  if (s === "postponed" || s === "cancelled") return "destructive";
  return "warning";
}

function formatEv(raw: string): string {
  const v = parseFloat(raw);
  if (Number.isNaN(v)) return raw;
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
}

function rejectionLabel(reason: string | undefined, t: Translator): string {
  if (!reason) return "—";
  const key = `rejection.${reason}` as const;
  const translated = t.has(key) ? t(key) : reason;
  return translated;
}

// ── factor bars ───────────────────────────────────────────────────────────────

// shared via `@/components/fixture-factor-bar`

// ── merged markets table ──────────────────────────────────────────────────────

function PlacePickButton({
  snap,
  fixtureId,
  alreadyInUserTicket,
  onPlace,
  t,
}: {
  snap: FixtureEvaluatedPickSnapshot;
  fixtureId: string;
  alreadyInUserTicket: boolean;
  onPlace: (snap: FixtureEvaluatedPickSnapshot) => void;
  t: Translator;
}) {
  const { isInSlip } = useBetSlip();
  const key = draftItemKey({
    fixtureId,
    market: snap.market,
    pick: snap.pick,
    comboMarket: snap.comboMarket,
    comboPick: snap.comboPick,
  });
  const inSlip = isInSlip(key);
  const disabled = alreadyInUserTicket && !inSlip;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (inSlip || alreadyInUserTicket) return;
        onPlace(snap);
      }}
      disabled={disabled}
      title={
        inSlip
          ? t("actions.alreadyInSlip")
          : alreadyInUserTicket
            ? t("actions.alreadyInTickets")
            : t("actions.placePick")
      }
      className={`flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border text-[0.7rem] font-semibold transition-colors ${
        inSlip
          ? "border-success/20 bg-success/12 text-success"
          : disabled
            ? "cursor-not-allowed border-border bg-secondary text-muted-foreground"
            : "border-border bg-panel text-muted-foreground hover:border-accent hover:text-accent"
      }`}
    >
      {inSlip ? <Check size={13} /> : <ShoppingCart size={13} />}
    </button>
  );
}

function EvaluatedPickItem({
  snap,
  fixtureId,
  alreadyInUserTicket,
  onPlace,
  bettable,
  t,
}: {
  snap: FixtureEvaluatedPickSnapshot;
  fixtureId: string;
  alreadyInUserTicket: boolean;
  onPlace: (snap: FixtureEvaluatedPickSnapshot) => void;
  bettable: boolean;
  t: Translator;
}) {
  const prob = `${(Number(snap.probability) * 100).toFixed(1)}%`;
  const evLabel = formatEv(snap.ev);
  const evNum = parseFloat(snap.ev);

  return (
    <div className="rounded-[1.1rem] border border-border bg-panel-strong p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {formatCombinedPickForDisplay(snap)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {t("table.probability")}:{" "}
              <span className="font-semibold text-foreground">{prob}</span>
            </span>
            <span className="tabular-nums">
              {t("table.odds")}:{" "}
              <span className="font-semibold text-foreground">{snap.odds}</span>
            </span>
            <span
              className={cn(
                "tabular-nums font-semibold",
                !Number.isNaN(evNum) && evNum >= 0
                  ? "text-success"
                  : "text-danger",
              )}
            >
              {evLabel}
            </span>
          </div>
        </div>

        {bettable ? (
          <div onClick={(e) => e.stopPropagation()}>
            <PlacePickButton
              snap={snap}
              fixtureId={fixtureId}
              alreadyInUserTicket={alreadyInUserTicket}
              onPlace={onPlace}
              t={t}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-2">
        {snap.status === "viable" ? (
          <Badge variant="success" className="rounded-full">
            {t("table.viable")}
          </Badge>
        ) : (
          <Badge variant="neutral" className="rounded-full">
            {rejectionLabel(snap.rejectionReason, t)}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function FixtureDiagnostics({ row }: { row: FixtureRow }) {
  const t = useTranslations("fixtureDiagnostics");
  const mr = row.modelRun;
  const score = formatScore(row.score, row.htScore);
  const { draft, addItem, open } = useBetSlip();
  const factorDefs: FixtureFactorDef[] = [
    {
      key: "recentForm",
      label: t("factors.recentForm"),
      kind: "directional",
      hint: t("factorHints.recentForm"),
    },
    {
      key: "xg",
      label: t("factors.xg"),
      kind: "directional",
      hint: t("factorHints.xg"),
    },
    {
      key: "performanceDomExt",
      label: t("factors.performanceDomExt"),
      kind: "directional",
      hint: t("factorHints.performanceDomExt"),
    },
    {
      key: "volatiliteLigue",
      label: t("factors.volatiliteLigue"),
      kind: "absolute",
      hint: t("factorHints.volatiliteLigue"),
    },
  ];

  function handlePlacePick(snap: FixtureEvaluatedPickSnapshot) {
    if (!mr) return;
    const shouldOpen = draft.items.length === 0;

    const sv = row.safeValueBet;
    const matchesSv =
      sv?.market === snap.market &&
      sv?.pick === snap.pick &&
      (sv?.comboMarket ?? null) === (snap.comboMarket ?? null) &&
      (sv?.comboPick ?? null) === (snap.comboPick ?? null);

    const base = {
      fixtureId: row.fixtureId,
      fixture: row.fixture,
      homeLogo: row.homeLogo,
      awayLogo: row.awayLogo,
      competition: row.competition,
      scheduledAt: row.scheduledAt,
      market: snap.market,
      pick: snap.pick,
      odds: snap.odds,
      comboMarket: snap.comboMarket,
      comboPick: snap.comboPick,
      ev: snap.ev,
      stakeOverride: null,
    };

    const item: BetSlipDraftItem =
      matchesSv && sv
        ? { ...base, betId: sv.betId }
        : { ...base, modelRunId: mr.modelRunId };

    addItem(item);
    if (shouldOpen) open();
  }

  if (!mr) {
    return (
      <div className="rounded-[1.7rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
        <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
          <EmptyHeader>
            <EmptyTitle>{t("empty.title")}</EmptyTitle>
            <EmptyDescription>{t("empty.description")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const alreadyInUserTicket = false;

  const hasFactors =
    mr.factors && Object.values(mr.factors).some((v) => v !== null);

  const viableCount = mr.evaluatedPicks.filter(
    (p) => p.status === "viable",
  ).length;
  const totalCount = mr.evaluatedPicks.length;

  return (
    <div className="rounded-[1.35rem] border border-border bg-panel-strong p-4 sm:p-5 ev-shell-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <p className="text-base font-semibold leading-tight text-foreground sm:text-lg">
            {row.fixture}
          </p>
          {score && (
            <p className="mt-1 text-sm font-medium text-foreground">{score}</p>
          )}
        </div>
        <Badge variant={fixtureStatusTone(row.status)} className="shrink-0">
          {fixtureStatusLabel(row.status)}
        </Badge>
      </div>

      {/* Pick retenu */}
      {mr.decision === "BET" && mr.market && mr.pick && (
        <div className="mt-4 flex items-center gap-3 rounded-[1rem] border border-border bg-panel p-3">
          <CanalBadge canal="EV" />
          <span className="flex-1 text-sm font-semibold text-foreground">
            {formatCombinedPickForDisplay({
              market: mr.market,
              pick: mr.pick,
              comboMarket: mr.comboMarket ?? undefined,
              comboPick: mr.comboPick ?? undefined,
            })}
          </span>
          {mr.ev && (
            <span
              className="tabular-nums text-sm font-bold"
              style={{ color: "var(--canal-ev)" }}
            >
              {mr.ev}
            </span>
          )}
          {mr.probEstimated && (
            <span className="text-xs text-muted-foreground">
              {mr.probEstimated}
            </span>
          )}
        </div>
      )}

      {mr.decision === "NO_BET" && (
        <div className="mt-4 rounded-[1rem] border border-dashed border-border bg-panel/60 px-3 py-2.5 text-sm text-muted-foreground">
          {t("noBet.message")} {t("noBet.decision")}{" "}
          <span className="font-semibold text-foreground">NO_BET</span>
        </div>
      )}

      {/* Pourquoi ce pick ? */}
      {hasFactors && mr.factors && (
        <div className="mt-5">
          <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("sections.whyThisPick")}
          </p>
          <div className="flex flex-col gap-2">
            {factorDefs.map((f) => (
              <FixtureFactorBar
                key={f.key}
                label={f.label}
                value={mr.factors![f.key]}
                kind={f.kind}
                hint={f.hint}
              />
            ))}
          </div>
        </div>
      )}

      {/* Prédiction modèle */}
      <div className="mt-5">
        <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t("sections.modelPrediction")}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            compact
            tone="neutral"
            label={t("stats.estimatedProbability")}
            value={mr.probEstimated ?? "—"}
          />
          <StatCard
            compact
            tone={mr.ev && parseFloat(mr.ev) >= 0 ? "success" : "danger"}
            label={t("stats.evValue")}
            value={mr.ev ? formatEv(mr.ev) : "—"}
          />
          {mr.lambdaHome !== null || mr.lambdaAway !== null ? (
            <div className="col-span-2 flex items-center rounded-[1.15rem] border border-border bg-panel-strong px-3 py-2.5">
              <p className="text-[0.72rem] leading-snug text-muted-foreground">
                {t("predictionSummary.modelPredicts")}{" "}
                <span className="font-semibold text-foreground">
                  ~{mr.lambdaHome ?? "?"}
                </span>{" "}
                {t("predictionSummary.homeGoals")} ·{" "}
                <span className="font-semibold text-foreground">
                  ~{mr.lambdaAway ?? "?"}
                </span>{" "}
                {t("predictionSummary.awayGoals")}
                {mr.expectedTotalGoals && (
                  <>
                    {" "}
                    →{" "}
                    <span className="font-semibold text-foreground">
                      {mr.expectedTotalGoals}{" "}
                      {t("predictionSummary.expectedGoals")}
                    </span>
                  </>
                )}
              </p>
            </div>
          ) : (
            <>
              <StatCard
                compact
                tone="neutral"
                label={t("stats.lambdaHome")}
                value={mr.lambdaHome ?? "—"}
              />
              <StatCard
                compact
                tone="neutral"
                label={t("stats.lambdaAway")}
                value={mr.lambdaAway ?? "—"}
              />
            </>
          )}
        </div>
      </div>

      {/* Marchés analysés */}
      {mr.evaluatedPicks.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-baseline gap-2">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("sections.analyzedMarkets")}
            </p>
            <span className="text-[0.72rem] text-muted-foreground">
              {totalCount}{" "}
              {totalCount > 1
                ? t("marketsSummary.markets")
                : t("marketsSummary.market")}{" "}
              ·{" "}
              <span className="text-success font-medium">
                {viableCount}{" "}
                {viableCount > 1
                  ? t("marketsSummary.viables")
                  : t("marketsSummary.viable")}
              </span>
              {totalCount - viableCount > 0 && (
                <>
                  {" "}
                  ·{" "}
                  <span className="text-danger font-medium">
                    {totalCount - viableCount}{" "}
                    {totalCount - viableCount > 1
                      ? t("marketsSummary.rejectedPlural")
                      : t("marketsSummary.rejected")}
                  </span>
                </>
              )}
            </span>
          </div>

          <div className="max-h-[min(40dvh,520px)] min-h-0 overflow-y-auto pr-1">
            <div className="flex flex-col gap-2">
              {mr.evaluatedPicks.map((snap) => (
                <EvaluatedPickItem
                  key={`${snap.market}:${snap.pick}:${snap.comboMarket ?? ""}:${snap.comboPick ?? ""}`}
                  snap={snap}
                  fixtureId={row.fixtureId}
                  alreadyInUserTicket={alreadyInUserTicket}
                  onPlace={handlePlacePick}
                  bettable={isFixtureBettable(row)}
                  t={t}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
