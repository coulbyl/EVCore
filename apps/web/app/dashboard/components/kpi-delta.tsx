import { cn } from "@evcore/ui/cn";
import type { KpiDelta as KpiDeltaType } from "@/domains/dashboard/types/dashboard";

export function KpiDelta({
  delta,
  compact = false,
}: {
  delta: KpiDeltaType;
  compact?: boolean;
}) {
  if (typeof delta === "object") {
    return (
      <div className={cn("flex items-center gap-2", compact ? "px-0" : "px-0 sm:px-2")}>
        <span className="rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
          {delta.bet} BET
        </span>
        <span className="rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
          {delta.noBet} NO_BET
        </span>
      </div>
    );
  }

  if (
    (delta.startsWith("+") || delta.startsWith("-")) &&
    (delta.includes("vs") || delta.includes("hier"))
  ) {
    const [value, ...rest] = delta.split(" ");
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 px-0",
          !compact && "sm:flex-nowrap sm:px-2",
        )}
      >
        <span className="rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
          {value}
        </span>
        <span
          className={cn(
            "font-medium uppercase text-muted-foreground text-[0.62rem] tracking-widest",
            !compact && "sm:text-xs sm:tracking-[0.12em]",
          )}
        >
          {rest.join(" ")}
        </span>
      </div>
    );
  }

  if (
    delta.toLowerCase().includes("couverture") ||
    delta.toLowerCase().includes("coverage")
  ) {
    const percentMatch = delta.match(/(\d+(?:[.,]\d+)?)%/);
    const rawPercent = percentMatch?.[1] ?? "0";
    const percentValue = `${rawPercent.replace(",", ".")}%`;
    return (
      <div
        className={cn(
          "flex flex-col gap-1",
          !compact && "sm:flex-row sm:items-center sm:gap-2 sm:px-2",
        )}
      >
        <div className={cn("flex items-center gap-1.5", !compact && "sm:contents")}>
          <span
            className={cn(
              "text-[0.78rem] font-semibold text-foreground",
              !compact && "sm:text-sm",
            )}
          >
            {percentValue}
          </span>
          <div
            className={cn(
              "h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary",
              !compact && "sm:h-2 sm:w-20 sm:flex-none",
            )}
          >
            <div
              className="h-full rounded-full bg-success"
              style={{ width: percentValue }}
            />
          </div>
        </div>
        <span
          className={cn(
            "block uppercase text-muted-foreground text-[0.56rem] tracking-[0.16em]",
            !compact && "sm:inline sm:text-xs sm:tracking-[0.12em]",
          )}
        >
          couverture
        </span>
      </div>
    );
  }

  return (
    <p
      className={cn(
        "px-0 text-[0.72rem] text-muted-foreground",
        !compact && "sm:px-2 sm:text-sm",
      )}
    >
      {delta}
    </p>
  );
}
