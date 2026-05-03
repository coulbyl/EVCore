"use client";

import { SettingsSectionCard } from "./settings-section-card";

export function NotificationsSection({
  labels,
}: {
  labels: {
    eyebrow: string;
    title: string;
    description: string;
    availabilityHint: string;
    statusLabel: string;
    items: Array<{
      key: string;
      label: string;
      help: string;
    }>;
  };
}) {
  return (
    <SettingsSectionCard
      eyebrow={labels.eyebrow}
      title={labels.title}
      description={labels.description}
    >
      <div className="flex flex-col gap-3">
        {labels.items.map((item) => (
          <div
            key={item.key}
            className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-background p-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {item.label}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{item.help}</p>
            </div>
            <span className="shrink-0 rounded-full border border-border bg-panel px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {labels.statusLabel}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {labels.availabilityHint}
      </p>
    </SettingsSectionCard>
  );
}
