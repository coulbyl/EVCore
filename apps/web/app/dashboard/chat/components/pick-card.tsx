import { cn } from "@evcore/ui";
import { CANAL_LABEL, CANAL_STYLE, fmtPct } from "./chat-constants";
import type { ChatPick } from "@/domains/chat/types/chat";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm tabular-nums">{value}</span>
    </div>
  );
}

export function PickCard({ pick }: { pick: ChatPick }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "shrink-0 rounded-md px-1.5 py-0.5 text-[0.65rem] font-medium",
              CANAL_STYLE[pick.canal],
            )}
          >
            {CANAL_LABEL[pick.canal]}
          </span>
          <span className="truncate text-sm font-medium">{pick.match}</span>
        </div>
        {pick.reliability !== null ? (
          <span className="shrink-0 text-[0.65rem] text-muted-foreground">
            fiab. 30j {fmtPct(pick.reliability)}
          </span>
        ) : null}
      </div>

      <div className="mt-1 text-sm text-foreground">{pick.pick}</div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <Stat
          label="Cote"
          value={pick.odds !== null ? pick.odds.toFixed(2) : "—"}
        />
        <Stat label="Proba" value={fmtPct(pick.proba)} />
      </div>
    </div>
  );
}
