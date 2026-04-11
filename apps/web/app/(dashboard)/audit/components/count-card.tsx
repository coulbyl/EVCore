import { formatCompactValue } from "@/helpers/number";

export function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-slate-50 px-4 py-3">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-[1.6rem] font-semibold tabular-nums tracking-tight text-slate-800">
        {formatCompactValue(value)}
      </p>
    </div>
  );
}
