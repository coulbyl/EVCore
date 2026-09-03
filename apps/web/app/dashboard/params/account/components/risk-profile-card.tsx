"use client";

import { useTranslations } from "next-intl";
import { clientApiRequest } from "@/lib/api/client-api";
import {
  useCurrentUser,
  useSetCurrentUser,
} from "@/domains/auth/context/current-user-context";
import type { RiskProfile } from "@/domains/auth/types/auth";
import { RISK_PROFILE_VALUES } from "./personalization-constants";
import { SettingsSectionCard } from "./settings-section-card";

export function RiskProfileCard() {
  const t = useTranslations("account.personalization");
  const currentUser = useCurrentUser();
  const setCurrentUser = useSetCurrentUser();

  async function handleChange(value: RiskProfile) {
    setCurrentUser({ ...currentUser, riskProfile: value });
    await clientApiRequest("/auth/me", {
      method: "PATCH",
      body: { riskProfile: value },
      fallbackErrorMessage: "Impossible d'enregistrer le profil de risque.",
    });
  }

  return (
    <SettingsSectionCard
      eyebrow={t("riskProfileTitle")}
      description={t("riskProfileSubtitle")}
    >
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-background p-1">
        {RISK_PROFILE_VALUES.map((value) => {
          const active = currentUser.riskProfile === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => void handleChange(value)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent-soft text-accent"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`riskProfile.${value}`)}
            </button>
          );
        })}
      </div>
    </SettingsSectionCard>
  );
}
