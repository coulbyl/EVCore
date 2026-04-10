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
        compact ? "rounded-[1.15rem] px-3 py-2.5" : "px-5 py-5",
      )}
    >
      <div
        className={cn(
          compact ? "border-b-2 pb-1.5" : "border-b-[3px] pb-2.5",
          toneClasses[tone],
        )}
      >
        <p
          className={cn(
            "font-semibold uppercase text-slate-500",
            compact
              ? "text-[0.58rem] tracking-[0.18em]"
              : "text-[0.68rem] tracking-[0.2em]",
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            "mt-3 font-semibold tracking-tight text-slate-950",
            compact ? "mt-1 text-[1.8rem] leading-none" : "text-[2.35rem]",
          )}
        >
          {value}
        </p>
      </div>
      {delta ? (
        <div className={cn(compact ? "mt-2" : "mt-3")}>{delta}</div>
      ) : null}
    </div>
  );
}
