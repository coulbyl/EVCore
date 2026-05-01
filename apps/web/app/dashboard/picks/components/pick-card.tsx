"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@evcore/ui";
import { useTranslations } from "next-intl";
import { CanalBadge } from "@/components/canal-badge";
import { formatCombinedPickForDisplay } from "@/helpers/fixture";
import { formatKickoff, formatScore } from "@/domains/fixture/helpers/fixture";
import type {
  FixtureRow,
  FixtureModelFactors,
} from "@/domains/fixture/types/fixture";
import {
  FixtureFactorBar,
  type FixtureFactorDef,
} from "@/components/fixture-factor-bar";
import { AddToSlipInline } from "./add-to-slip-inline";

// ── helpers ─────────────────────────────────────────────────────────────────

function TeamLogos({
  homeLogo,
  awayLogo,
}: {
  homeLogo: string | null;
  awayLogo: string | null;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {homeLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={homeLogo} alt="" className="size-5 object-contain" />
      ) : (
        <div className="size-5 rounded-full bg-secondary" />
      )}
      {awayLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={awayLogo} alt="" className="size-5 object-contain" />
      ) : (
        <div className="size-5 rounded-full bg-secondary" />
      )}
    </div>
  );
}

function ResultBadge({
  status,
}: {
  status: "WON" | "LOST" | "PENDING" | null;
}) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  if (status === "PENDING")
    return <span className="text-xs text-muted-foreground">En attente</span>;
  return (
    <Badge
      variant={status === "WON" ? "success" : "destructive"}
      className="rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest"
    >
      {status === "WON" ? "Gagné" : "Perdu"}
    </Badge>
  );
}

// ── factor bars ──────────────────────────────────────────────────────────────

// shared via `@/components/fixture-factor-bar`

function WhySection({
  factors,
  probEstimated,
  odds,
}: {
  factors: FixtureModelFactors | null;
  probEstimated: string | null;
  odds: string | null;
}) {
  const t = useTranslations("fixtureDiagnostics");
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

  const hasFactors = factors && Object.values(factors).some((v) => v !== null);

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="mb-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Pourquoi ce pick ?
      </p>
      {hasFactors ? (
        <div className="flex flex-col gap-2">
          {factorDefs.map((f) => (
            <FixtureFactorBar
              key={f.key}
              label={f.label}
              value={factors[f.key]}
              kind={f.kind}
              hint={f.hint}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Détail des facteurs non disponible.
        </p>
      )}
      {(probEstimated || odds) && (
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          {probEstimated && (
            <span>
              Prob. estimée :{" "}
              <span className="font-semibold text-foreground">
                {probEstimated}
              </span>
            </span>
          )}
          {odds && (
            <span>
              Cote :{" "}
              <span className="font-semibold text-foreground">{odds}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── EV pick card ─────────────────────────────────────────────────────────────

export function EvPickCard({ row }: { row: FixtureRow }) {
  const [open, setOpen] = useState(false);
  const mr = row.modelRun;
  if (!mr || mr.decision !== "BET") return null;

  const score = formatScore(row.score, row.htScore);
  const pickLabel =
    mr.market && mr.pick
      ? formatCombinedPickForDisplay({
          market: mr.market,
          pick: mr.pick,
          comboMarket: mr.comboMarket ?? undefined,
          comboPick: mr.comboPick ?? undefined,
        })
      : null;

  const odds =
    mr.market && mr.pick
      ? (mr.evaluatedPicks.find(
          (p) =>
            p.market === mr.market &&
            p.pick === mr.pick &&
            (p.comboMarket ?? null) === (mr.comboMarket ?? null) &&
            (p.comboPick ?? null) === (mr.comboPick ?? null),
        )?.odds ?? null)
      : null;

  return (
    <div className="rounded-[1.2rem] border border-border bg-panel-strong p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TeamLogos homeLogo={row.homeLogo} awayLogo={row.awayLogo} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {row.fixture}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {row.competition}
              {" · "}
              {formatKickoff(row.scheduledAt)}
            </p>
          </div>
        </div>
        <CanalBadge canal="EV" />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="flex min-w-0 items-center gap-2">
          {pickLabel && (
            <span className="truncate text-sm font-medium text-foreground">
              {pickLabel}
            </span>
          )}
          {score && (
            <>
              <span className="text-border">·</span>
              <span className="shrink-0 font-semibold tabular-nums text-sm text-muted-foreground">
                {score}
              </span>
            </>
          )}
        </div>
        {odds && (
          <span className="tabular-nums text-sm text-muted-foreground">
            {odds}
          </span>
        )}
        {mr.ev && (
          <span
            className="tabular-nums text-sm font-bold"
            style={{ color: "var(--canal-ev)" }}
          >
            {mr.ev}
          </span>
        )}
        <ResultBadge status={mr.betStatus} />
        <AddToSlipInline row={row} canal="EV" />
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-2.5 flex items-center gap-1 text-[0.72rem] font-medium text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Pourquoi ce pick ?
      </button>

      {open && (
        <WhySection
          factors={mr.factors}
          probEstimated={mr.probEstimated}
          odds={odds}
        />
      )}
    </div>
  );
}

// ── SV pick card ─────────────────────────────────────────────────────────────

export function SvPickCard({ row }: { row: FixtureRow }) {
  const sv = row.safeValueBet;
  if (!sv) return null;

  const score = formatScore(row.score, row.htScore);
  const pickLabel = formatCombinedPickForDisplay({
    market: sv.market,
    pick: sv.pick,
    comboMarket: sv.comboMarket ?? undefined,
    comboPick: sv.comboPick ?? undefined,
  });

  return (
    <div className="rounded-[1.2rem] border border-border bg-panel-strong p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TeamLogos homeLogo={row.homeLogo} awayLogo={row.awayLogo} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {row.fixture}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {row.competition}
              {" · "}
              {formatKickoff(row.scheduledAt)}
            </p>
          </div>
        </div>
        <CanalBadge canal="SV" />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="flex min-w-0 items-center gap-2">
          {pickLabel && (
            <span className="truncate text-sm font-medium text-foreground">
              {pickLabel}
            </span>
          )}
          {score && (
            <>
              <span className="text-border">·</span>
              <span className="shrink-0 font-semibold tabular-nums text-sm text-muted-foreground">
                {score}
              </span>
            </>
          )}
        </div>
        {sv.odds && (
          <span className="tabular-nums text-sm text-muted-foreground">
            {sv.odds}
          </span>
        )}
        <span
          className="tabular-nums text-sm font-bold"
          style={{ color: "var(--canal-sv)" }}
        >
          {sv.ev}
        </span>
        <ResultBadge status={sv.betStatus} />
        <AddToSlipInline row={row} canal="SV" />
      </div>
    </div>
  );
}

// ── CONF pick card ────────────────────────────────────────────────────────────

export function ConfPickCard({ row }: { row: FixtureRow }) {
  const pred = row.prediction;
  if (!pred) return null;

  const PICK_LABEL: Record<string, string> = {
    HOME: "Domicile",
    AWAY: "Extérieur",
    DRAW: "Nul",
  };

  return (
    <div className="rounded-[1.2rem] border border-border bg-panel-strong p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TeamLogos homeLogo={row.homeLogo} awayLogo={row.awayLogo} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {row.fixture}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {row.competition}
              {" · "}
              {formatKickoff(row.scheduledAt)}
            </p>
          </div>
        </div>
        <CanalBadge canal="CONF" />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-sm font-medium text-foreground">
          {PICK_LABEL[pred.pick] ?? pred.pick}
        </span>
        <span
          className="tabular-nums text-sm font-semibold"
          style={{ color: "var(--canal-conf)" }}
        >
          {pred.probability}
        </span>
        {pred.correct === true && (
          <Badge
            variant="success"
            className="rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase"
          >
            Correct
          </Badge>
        )}
        {pred.correct === false && (
          <Badge
            variant="destructive"
            className="rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase"
          >
            Incorrect
          </Badge>
        )}
      </div>
    </div>
  );
}
