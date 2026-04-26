"use client";

import { TrendingUp, Shield, Target } from "lucide-react";
import {
  usePredictions,
  usePredictionStats,
} from "@/domains/dashboard/use-cases/get-predictions";
import type { PnlSummary } from "@/domains/dashboard/types/dashboard";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function thirtyDaysAgoIso() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Shared card shell
// ---------------------------------------------------------------------------

type CanalShellProps = {
  canal: "ev" | "sv" | "conf";
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
};

const CANAL_STYLES = {
  ev: {
    color: "var(--canal-ev)",
    soft: "var(--canal-ev-soft)",
    border: "color-mix(in srgb, var(--canal-ev) 20%, transparent)",
  },
  sv: {
    color: "var(--canal-sv)",
    soft: "var(--canal-sv-soft)",
    border: "color-mix(in srgb, var(--canal-sv) 20%, transparent)",
  },
  conf: {
    color: "var(--canal-conf)",
    soft: "var(--canal-conf-soft)",
    border: "color-mix(in srgb, var(--canal-conf) 20%, transparent)",
  },
} as const;

function CanalShell({ canal, icon, label, children }: CanalShellProps) {
  const s = CANAL_STYLES[canal];
  return (
    <div
      className="flex flex-col gap-3 rounded-[1.15rem] border p-4"
      style={{ borderColor: s.border, background: s.soft }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-lg"
          style={{
            color: s.color,
            background: `color-mix(in srgb, ${s.color} 14%, transparent)`,
          }}
        >
          {icon}
        </span>
        <span
          className="text-[0.65rem] font-bold uppercase tracking-[0.22em]"
          style={{ color: s.color }}
        >
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`tabular-nums text-sm font-semibold ${highlight ? "text-foreground" : "text-foreground"}`}
      >
        {value}
        {sub && (
          <span className="ml-1 text-[0.65rem] font-normal text-muted-foreground">
            {sub}
          </span>
        )}
      </span>
    </div>
  );
}

const SKELETON = <div className="h-4 w-12 animate-pulse rounded bg-border" />;

// ---------------------------------------------------------------------------
// Canal EV
// ---------------------------------------------------------------------------

function CanalEvCard({ pnl }: { pnl: PnlSummary | null }) {
  return (
    <CanalShell canal="ev" icon={<TrendingUp size={14} />} label="Canal EV">
      {pnl ? (
        <>
          <Stat label="ROI" value={pnl.roi} />
          <Stat label="Paris réglés" value={pnl.settledBets} />
          <Stat label="Réussite" value={pnl.winRate} />
        </>
      ) : (
        <>
          <Stat label="ROI" value={SKELETON} />
          <Stat label="Paris réglés" value={SKELETON} />
          <Stat label="Réussite" value={SKELETON} />
        </>
      )}
    </CanalShell>
  );
}

// ---------------------------------------------------------------------------
// Canal Sécurité
// ---------------------------------------------------------------------------

function CanalSvCard({ pnl }: { pnl: PnlSummary | null }) {
  return (
    <CanalShell canal="sv" icon={<Shield size={14} />} label="Canal Sécurité">
      {pnl ? (
        <>
          <Stat label="Net" value={pnl.netUnits} sub="u" />
          <Stat label="Paris réglés" value={pnl.settledBets} />
          <Stat
            label="Gagnés"
            value={`${pnl.wonBets}`}
            sub={`/ ${pnl.settledBets}`}
          />
        </>
      ) : (
        <>
          <Stat label="Net" value={SKELETON} />
          <Stat label="Paris réglés" value={SKELETON} />
          <Stat label="Gagnés" value={SKELETON} />
        </>
      )}
    </CanalShell>
  );
}

// ---------------------------------------------------------------------------
// Canal Confiance
// ---------------------------------------------------------------------------

function CanalConfCard() {
  const today = todayIso();
  const from = thirtyDaysAgoIso();

  const { data: predictions = [] } = usePredictions(today);
  const { data: stats } = usePredictionStats(from, today);

  const settled = predictions.filter((p) => p.correct !== null);
  const correct = settled.filter((p) => p.correct === true).length;
  const todayRate =
    settled.length > 0
      ? `${Math.round((correct / settled.length) * 100)}%`
      : "—";

  return (
    <CanalShell
      canal="conf"
      icon={<Target size={14} />}
      label="Canal Confiance"
    >
      <Stat
        label="Aujourd'hui"
        value={`${correct}/${settled.length}`}
        sub={
          predictions.length > settled.length
            ? `(${predictions.length - settled.length} en attente)`
            : undefined
        }
      />
      <Stat label="Taux du jour" value={todayRate} />
      <Stat
        label="30 jours"
        value={stats ? stats.hitRate : SKELETON}
        sub={stats ? `${stats.correct}/${stats.total} picks` : undefined}
      />
    </CanalShell>
  );
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export function CanalCards({ pnl }: { pnl: PnlSummary | null }) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <CanalEvCard pnl={pnl} />
      <CanalSvCard pnl={pnl} />
      <CanalConfCard />
    </section>
  );
}
