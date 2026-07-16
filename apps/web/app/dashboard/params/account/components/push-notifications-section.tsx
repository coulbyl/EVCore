"use client";

import { Switch } from "@evcore/ui";
import { usePushSubscription } from "@/domains/push/use-cases/use-push-subscription";
import { SettingsSectionCard } from "./settings-section-card";

export function PushNotificationsSection({
  labels,
}: {
  labels: {
    title: string;
    description: string;
    toggleLabel: string;
    unsupportedHint: string;
    deniedHint: string;
  };
}) {
  const { status, isBusy, error, enable, disable } = usePushSubscription();

  const handleChange = (checked: boolean) => {
    void (checked ? enable() : disable());
  };

  return (
    <SettingsSectionCard title={labels.title} description={labels.description}>
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-background p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {labels.toggleLabel}
          </p>
          {status === "unsupported" && (
            <p className="mt-1 text-sm text-muted-foreground">
              {labels.unsupportedHint}
            </p>
          )}
          {status === "denied" && (
            <p className="mt-1 text-sm text-muted-foreground">
              {labels.deniedHint}
            </p>
          )}
          {error && <p className="mt-1 text-sm text-danger">{error}</p>}
        </div>
        <Switch
          checked={status === "subscribed"}
          onCheckedChange={handleChange}
          disabled={isBusy || status === "unsupported" || status === "denied"}
        />
      </div>
    </SettingsSectionCard>
  );
}
