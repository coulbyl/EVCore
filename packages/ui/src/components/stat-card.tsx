import { type ReactNode } from "react";
import { cn } from "../utils/cn";

const toneClasses = {
  accent: "border-accent",
  success: "border-success",
  warning: "border-warning",
  danger: "border-danger",
  neutral: "border-slate-300",
} as const;

export function StatCard({
  label,
  value,
  delta,
  tone = "accent",
  compact = false,
}: {
  label: string;
  value: string;
  delta?: ReactNode;
  tone?: keyof typeof toneClasses;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.55rem] border border-border bg-panel-strong shadow-sm",
        compact ? "rounded-xl px-3 py-2.5" : "px-5 py-5",
      )}
    >
      <div
        className={cn(
          compact ? "border-b-2 pb-1.5" : "border-b-[3px] pb-2.5",
          toneClasses[tone],
        )}
      >
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
          {label}
        </p>
        <p
          className={cn(
            "mt-3 font-semibold tracking-tight text-slate-950",
            compact ? "mt-1 text-[1.2rem]" : "text-[2.35rem]",
          )}
        >
          {value}
        </p>
      </div>
      {delta ? <div className="mt-3">{delta}</div> : null}
    </div>
  );
}
