import { cn } from "../utils/cn";

const valueToneClasses = {
  positive: "text-emerald-600",
  negative: "text-rose-600",
  warning: "text-amber-600",
  neutral: "text-foreground",
} as const;

export type StatListItem = {
  label: string;
  value: string;
  tone?: keyof typeof valueToneClasses;
  mono?: boolean;
};

export function StatList({
  items,
  className,
}: {
  items: StatListItem[];
  className?: string;
}) {
  return (
    <ul className={cn("space-y-1.5", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center justify-between gap-3">
          <span className={cn("text-xs text-muted-foreground", item.mono && "font-mono")}>
            {item.label}
          </span>
          <span
            className={cn(
              "tabular-nums text-sm font-semibold",
              valueToneClasses[item.tone ?? "neutral"],
            )}
          >
            {item.value}
          </span>
        </li>
      ))}
    </ul>
  );
}
