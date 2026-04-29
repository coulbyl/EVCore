"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@evcore/ui";
import { CanalBadge } from "@/components/canal-badge";
import { formatCombinedPickForDisplay } from "@/helpers/fixture";
import { formatKickoff } from "@/domains/fixture/helpers/fixture";
import type {
  FixtureRow,
  FixtureModelFactors,
} from "@/domains/fixture/types/fixture";
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
  if (!status || status === "PENDING") return null;
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

const FACTOR_DEFS: {
  key: keyof FixtureModelFactors;
  label: string;
}[] = [
  { key: "recentForm", label: "Forme récente" },
  { key: "xg", label: "Expected Goals (xG)" },
  { key: "performanceDomExt", label: "Avantage dom./ext." },
  { key: "volatiliteLigue", label: "Stabilité de la ligue" },
];

function FactorBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  const pct = Math.min(Math.max(value, 0), 1) * 100;
  const color =
    pct >= 65
      ? "var(--color-success)"
      : pct >= 40
        ? "var(--canal-ev)"
        : "var(--color-destructive)";

  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 text-[0.72rem] text-muted-foreground">
        {label}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct.toFixed(0)}%`, background: color }}
        />
      </div>
      <span
        className="w-9 shrink-0 text-right text-[0.72rem] font-semibold tabular-nums"
        style={{ color }}
      >
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

function WhySection({
  factors,
  probEstimated,
  odds,
}: {
  factors: FixtureModelFactors | null;
  probEstimated: string | null;
  odds: string | null;
}) {
  const hasFactors = factors && Object.values(factors).some((v) => v !== null);

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="mb-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Pourquoi ce pick ?
      </p>
      {hasFactors ? (
        <div className="flex flex-col gap-2">
          {FACTOR_DEFS.map((f) => (
            <FactorBar key={f.key} label={f.label} value={factors[f.key]} />
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
        {pickLabel && (
          <span className="text-sm font-medium text-foreground">
            {pickLabel}
          </span>
        )}
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
        {pickLabel && (
          <span className="text-sm font-medium text-foreground">
            {pickLabel}
          </span>
        )}
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
