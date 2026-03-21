import { Button } from "./button";

export function TopNav({
  title,
  subtitle,
  dateLabel,
  statusLabel,
}: {
  title: string;
  subtitle?: string;
  dateLabel: string;
  statusLabel: string;
}) {
  return (
    <header className="rounded-[1.9rem] border border-white/80 bg-white/88 px-7 py-6 shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Console
            </span>
            <span className="text-sm text-slate-300">/</span>
            <span className="text-sm font-medium text-slate-500">
              Dashboard
            </span>
          </div>
          <h1 className="mt-4 text-[2.15rem] font-semibold tracking-tight text-slate-900">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <span>{dateLabel}</span>
          <span className="text-slate-300">|</span>
          <span className="font-medium text-slate-700">{statusLabel}</span>
          <Button tone="secondary">Refresh</Button>
        </div>
      </div>
    </header>
  );
}
