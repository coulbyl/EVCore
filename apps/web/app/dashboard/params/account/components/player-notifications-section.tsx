"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Switch } from "@evcore/ui";
import { clientApiRequest } from "@/lib/api/client-api";
import {
  useCurrentUser,
  useSetCurrentUser,
} from "@/domains/auth/context/current-user-context";
import { SettingsSectionCard } from "./settings-section-card";

type Setting = "morningBriefEnabled" | "weeklyStatementEnabled";

const ROWS = [
  { key: "morningBriefEnabled", label: "morning", hint: "morningHint" },
  { key: "weeklyStatementEnabled", label: "weekly", hint: "weeklyHint" },
] as const;

/** La matinée et le relevé du lundi (2026-10-29), actifs par défaut. */
export function PlayerNotificationsSection() {
  const t = useTranslations("account.playerNotifications");
  const currentUser = useCurrentUser();
  const setCurrentUser = useSetCurrentUser();
  const [busy, setBusy] = useState<Setting | null>(null);

  async function handleChange(key: Setting, checked: boolean) {
    setBusy(key);
    try {
      await clientApiRequest("/auth/me", {
        method: "PATCH",
        body: { [key]: checked },
        fallbackErrorMessage: t("error"),
      });
      setCurrentUser({ ...currentUser, [key]: checked });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <SettingsSectionCard title={t("title")} description={t("description")}>
      <div className="flex flex-col gap-3">
        {ROWS.map((row) => (
          <div
            key={row.key}
            className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-background p-4"
          >
            <div className="min-w-0">
              <p
                id={`${row.key}-label`}
                className="text-sm font-semibold text-foreground"
              >
                {t(row.label)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t(row.hint)}
              </p>
            </div>
            <Switch
              aria-labelledby={`${row.key}-label`}
              checked={currentUser[row.key]}
              onCheckedChange={(checked) => void handleChange(row.key, checked)}
              disabled={busy !== null}
            />
          </div>
        ))}
      </div>
    </SettingsSectionCard>
  );
}
