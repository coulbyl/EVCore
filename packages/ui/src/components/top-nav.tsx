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
    <header className="ev-shell-shadow rounded-[1.9rem] border border-border/80 bg-panel-strong px-7 py-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-flex rounded-full border border-border bg-secondary px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Console
            </span>
            <span className="text-sm text-border">/</span>
            <span className="text-sm font-medium text-muted-foreground">
              Dashboard
            </span>
          </div>
          <h1 className="mt-4 text-[2.15rem] font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span>{dateLabel}</span>
          <span className="text-border">|</span>
          <span className="font-medium text-foreground">{statusLabel}</span>
          <Button variant="secondary">Refresh</Button>
        </div>
      </div>
    </header>
  );
}
