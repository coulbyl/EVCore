"use client";

import { useState } from "react";
import { Switch } from "@evcore/ui";
import { clientApiRequest } from "@/lib/api/client-api";
import {
  useCurrentUser,
  useSetCurrentUser,
} from "@/domains/auth/context/current-user-context";
import { SettingsSectionCard } from "./settings-section-card";

export function EmailNotificationsSection({
  labels,
}: {
  labels: {
    title: string;
    description: string;
    toggleLabel: string;
  };
}) {
  const currentUser = useCurrentUser();
  const setCurrentUser = useSetCurrentUser();
  const [isBusy, setIsBusy] = useState(false);

  async function handleChange(checked: boolean) {
    setIsBusy(true);
    try {
      await clientApiRequest("/auth/me", {
        method: "PATCH",
        body: { emailSupportNotificationsEnabled: checked },
        fallbackErrorMessage:
          "Impossible d'enregistrer cette préférence de notification.",
      });
      setCurrentUser({
        ...currentUser,
        emailSupportNotificationsEnabled: checked,
      });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <SettingsSectionCard title={labels.title} description={labels.description}>
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-background p-4">
        <p className="min-w-0 text-sm font-semibold text-foreground">
          {labels.toggleLabel}
        </p>
        <Switch
          checked={currentUser.emailSupportNotificationsEnabled}
          onCheckedChange={(checked) => void handleChange(checked)}
          disabled={isBusy}
        />
      </div>
    </SettingsSectionCard>
  );
}
