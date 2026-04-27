"use client";

import { useState } from "react";
import { Switch } from "@evcore/ui";
import { SettingsSectionCard } from "./settings-section-card";

type NotificationPreferenceKey =
  | "roiAlert"
  | "marketSuspension"
  | "brierAlert"
  | "weeklyReport";

const DEFAULT_PREFERENCES: Record<NotificationPreferenceKey, boolean> = {
  roiAlert: true,
  marketSuspension: true,
  brierAlert: false,
  weeklyReport: true,
};

export function NotificationsSection({
  labels,
}: {
  labels: {
    eyebrow: string;
    title: string;
    description: string;
    preferenceHint: string;
    items: Array<{
      key: NotificationPreferenceKey;
      label: string;
      help: string;
    }>;
  };
}) {
  const [preferences, setPreferences] =
    useState<Record<NotificationPreferenceKey, boolean>>(DEFAULT_PREFERENCES);

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
            <Switch
              checked={preferences[item.key]}
              onCheckedChange={(checked) =>
                setPreferences((prev) => ({ ...prev, [item.key]: checked }))
              }
              aria-label={item.label}
            />
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {labels.preferenceHint}
      </p>
    </SettingsSectionCard>
  );
}
