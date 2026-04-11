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
      <div className={`flex items-center gap-2 ${compact ? "px-0" : "px-2"}`}>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          {delta.bet} BET
        </span>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
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
        className={`flex items-center gap-2 ${compact ? "flex-wrap px-0" : "px-2"}`}
      >
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          {value}
        </span>
        <span
          className={`font-medium uppercase text-slate-500 ${compact ? "text-[0.62rem] tracking-widest" : "text-xs tracking-[0.12em]"}`}
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
      <div className={compact ? "space-y-1" : "flex items-center gap-2 px-2"}>
        <div className={compact ? "flex items-center gap-1.5" : "contents"}>
          <span
            className={`${compact ? "text-[0.78rem]" : "text-sm"} font-semibold text-slate-700`}
          >
            {percentValue}
          </span>
          <div
            className={`${compact ? "h-1.5 min-w-0 flex-1" : "h-2 w-20"} overflow-hidden rounded-full bg-slate-200`}
          >
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: percentValue }}
            />
          </div>
        </div>
        <span
          className={`uppercase text-slate-500 ${compact ? "block text-[0.56rem] tracking-[0.16em]" : "text-xs tracking-[0.12em]"}`}
        >
          couverture
        </span>
      </div>
    );
  }

  return (
    <p
      className={`${compact ? "px-0 text-[0.72rem]" : "px-2 text-sm"} text-slate-500`}
    >
      {delta}
    </p>
  );
}
