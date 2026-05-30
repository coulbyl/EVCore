import type {
  InvestmentCanal,
  InvestmentPickDto,
} from "@/domains/ai-engine/types/investment";
import {
  CANAL_COLOR,
  CANAL_LABEL,
  CANAL_DESCRIPTION,
  formatPct,
} from "./canal-constants";
import { PickCard } from "./pick-card";

export function CanalSection({
  canal,
  picks,
  locale,
}: {
  canal: InvestmentCanal;
  picks: InvestmentPickDto[];
  locale: string;
}) {
  if (picks.length === 0) return null;
  const color = CANAL_COLOR[canal];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className="h-3.5 w-1 shrink-0 rounded-full"
          style={{ background: color }}
        />
        <h3 className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {CANAL_LABEL[canal]}
        </h3>
        <span
          className="rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold tabular-nums"
          style={{
            color,
            background: `color-mix(in srgb, ${color} 14%, transparent)`,
          }}
        >
          {picks.length}
        </span>
        <span className="text-[0.65rem] text-muted-foreground/60">
          {CANAL_DESCRIPTION[canal]}
          <span className="ml-1.5 tabular-nums opacity-70">
            hist. {formatPct(picks[0]?.calibratedHitRate ?? 0)}
          </span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {picks.map((pick) => (
          <PickCard
            key={`${pick.fixtureId}:${pick.canal}`}
            pick={pick}
            locale={locale}
          />
        ))}
      </div>
    </section>
  );
}
