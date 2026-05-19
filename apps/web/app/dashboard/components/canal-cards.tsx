"use client";

import { TrendingUp, Shield, Target, Minus, Activity } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePredictionStats } from "@/domains/dashboard/use-cases/get-predictions";
import { useChannelHealth } from "@/domains/dashboard/use-cases/get-channel-health";
import { usePnlByCanal } from "@/domains/dashboard/use-cases/get-pnl-by-canal";
import type {
  ChannelHealthItem,
  ChannelStatus,
} from "@/domains/dashboard/types/dashboard";

const STATUS_DOT: Record<ChannelStatus, string> = {
  GREEN: "bg-success",
  ORANGE: "bg-warning",
  RED: "bg-danger",
  INACTIVE: "bg-muted-foreground/30",
  INSUFFICIENT_DATA: "bg-muted-foreground/50",
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
  draw: {
    color: "var(--canal-draw)",
    soft: "var(--canal-draw-soft)",
    border: "color-mix(in srgb, var(--canal-draw) 20%, transparent)",
  },
  btts: {
    color: "var(--canal-btts)",
    soft: "var(--canal-btts-soft)",
    border: "color-mix(in srgb, var(--canal-btts) 20%, transparent)",
  },
} as const;

type Canal = keyof typeof CANAL_STYLES;

const SKELETON = <div className="h-4 w-12 animate-pulse rounded bg-border" />;

type StatRow = { label: string; value: React.ReactNode; sub?: string };

function Stat({ label, value, sub }: StatRow) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="tabular-nums text-sm font-semibold text-foreground">
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

function CanalCard({
  canal,
  icon,
  label,
  status,
  rows,
}: {
  canal: Canal;
  icon: React.ReactNode;
  label: string;
  status?: ChannelStatus;
  rows: [StatRow, StatRow, StatRow];
}) {
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
        {status && (
          <span
            className={`ml-auto size-2 shrink-0 rounded-full ${STATUS_DOT[status]}`}
          />
        )}
      </div>
      {rows.map((r, i) => (
        <Stat key={i} label={r.label} value={r.value} sub={r.sub} />
      ))}
    </div>
  );
}

export function CanalCards({ from, to }: { from: string; to: string }) {
  const t = useTranslations("performance");
  const tPicks = useTranslations("picks");
  const { data: healthItems = [] } = useChannelHealth();
  const { data: pnlByCanal } = usePnlByCanal(from, to);
  const { data: confStats } = usePredictionStats(from, to, "CONF");
  const { data: drawStats } = usePredictionStats(from, to, "DRAW");
  const { data: bttsStats } = usePredictionStats(from, to, "BTTS");

  const findStatus = (ch: ChannelHealthItem["channel"]) =>
    healthItems.find((h) => h.channel === ch)?.status;

  const ev = pnlByCanal?.ev ?? null;
  const sv = pnlByCanal?.sv ?? null;

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <CanalCard
        canal="sv"
        icon={<Shield size={14} />}
        label={tPicks("safeValue")}
        status={findStatus("SV")}
        rows={[
          { label: t("roi"), value: sv ? sv.roi : SKELETON },
          { label: t("settledBets"), value: sv ? sv.settledBets : SKELETON },
          { label: t("winRate"), value: sv ? sv.winRate : SKELETON },
        ]}
      />
      <CanalCard
        canal="btts"
        icon={<Activity size={14} />}
        label={tPicks("btts")}
        status={findStatus("BTTS")}
        rows={[
          { label: t("roi"), value: bttsStats ? bttsStats.roi : SKELETON },
          {
            label: t("settledBets"),
            value: bttsStats
              ? `${bttsStats.correct}/${bttsStats.total}`
              : SKELETON,
          },
          {
            label: t("winRate"),
            value: bttsStats ? bttsStats.hitRate : SKELETON,
          },
        ]}
      />
      <CanalCard
        canal="conf"
        icon={<Target size={14} />}
        label={tPicks("confidence")}
        status={findStatus("CONF")}
        rows={[
          { label: t("roi"), value: confStats ? confStats.roi : SKELETON },
          {
            label: t("settledBets"),
            value: confStats
              ? `${confStats.correct}/${confStats.total}`
              : SKELETON,
          },
          {
            label: t("winRate"),
            value: confStats ? confStats.hitRate : SKELETON,
          },
        ]}
      />
      <CanalCard
        canal="draw"
        icon={<Minus size={14} />}
        label={tPicks("matchNull")}
        status={findStatus("DRAW")}
        rows={[
          { label: t("roi"), value: drawStats ? drawStats.roi : SKELETON },
          {
            label: t("settledBets"),
            value: drawStats
              ? `${drawStats.correct}/${drawStats.total}`
              : SKELETON,
          },
          {
            label: t("winRate"),
            value: drawStats ? drawStats.hitRate : SKELETON,
          },
        ]}
      />
      <CanalCard
        canal="ev"
        icon={<TrendingUp size={14} />}
        label={tPicks("evChannel")}
        status={findStatus("EV")}
        rows={[
          { label: t("roi"), value: ev ? ev.roi : SKELETON },
          { label: t("settledBets"), value: ev ? ev.settledBets : SKELETON },
          { label: t("winRate"), value: ev ? ev.winRate : SKELETON },
        ]}
      />
    </section>
  );
}
