import { cn } from "../utils/cn";

const toneClasses = {
  success: "bg-emerald-500",
  warning: "bg-amber-400",
  danger: "bg-rose-400",
  accent: "bg-accent",
  neutral: "bg-slate-400",
} as const;

const textToneClasses = {
  success: "text-emerald-600",
  warning: "text-amber-600",
  danger: "text-rose-500",
  accent: "text-accent",
  neutral: "text-muted-foreground",
} as const;

type ProgressBarTone = keyof typeof toneClasses;

function resolveTone(pct: number, thresholds?: { success: number; warning: number }): ProgressBarTone {
  if (!thresholds) return "accent";
  if (pct >= thresholds.success) return "success";
  if (pct >= thresholds.warning) return "warning";
  return "danger";
}

export function ProgressBar({
  value,
  max = 100,
  tone,
  thresholds,
  label,
  showValue = true,
  className,
}: {
  value: number;
  max?: number;
  tone?: ProgressBarTone;
  thresholds?: { success: number; warning: number };
  label?: string;
  showValue?: boolean;
  className?: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const resolved = tone ?? resolveTone(pct, thresholds);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showValue && (
        <span className={cn("min-w-[2.5rem] text-right tabular-nums text-xs font-semibold", textToneClasses[resolved])}>
          {pct}%
        </span>
      )}
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full transition-all", toneClasses[resolved])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {label && (
        <span className="text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  );
}
