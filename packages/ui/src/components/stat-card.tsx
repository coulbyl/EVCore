import { type ReactNode } from "react";
import { cn } from "../utils/cn";

const toneClasses = {
  accent: "border-accent",
  success: "border-success",
  warning: "border-warning",
  danger: "border-danger",
  neutral: "border-border",
} as const;

export function StatCard({
  label,
  value,
  delta,
  icon,
  tone = "accent",
  compact = false,
}: {
  label: string;
  value: string;
  delta?: ReactNode;
  icon?: ReactNode;
  tone?: keyof typeof toneClasses;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.15rem] border border-border bg-panel-strong px-3 py-2.5 shadow-sm",
        !compact && "sm:rounded-[1.55rem] sm:px-5 sm:py-5",
      )}
    >
      <div
        className={cn(
          "border-b-2 pb-1.5",
          !compact && "sm:border-b-[3px] sm:pb-2.5",
          toneClasses[tone],
        )}
      >
        <p
          className={cn(
            "flex items-center gap-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground",
            !compact && "sm:text-[0.68rem] sm:tracking-[0.2em]",
          )}
        >
          {icon}
          {label}
        </p>
        <p
          className={cn(
            "mt-1 break-words text-xs font-medium text-foreground",
            !compact && "sm:mt-3 sm:text-lg",
          )}
        >
          {value}
        </p>
      </div>
      {delta ? (
        <div className={cn("mt-2", !compact && "sm:mt-3")}>{delta}</div>
      ) : null}
    </div>
  );
}
