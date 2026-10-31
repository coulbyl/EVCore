"use client";

import { RadioGroup, RadioGroupItem } from "@evcore/ui";
import { clientApiRequest } from "@/lib/api/client-api";
import {
  useCurrentUser,
  useSetCurrentUser,
} from "@/domains/auth/context/current-user-context";
import { useCurrencyFormat } from "@/providers/currency-provider";
import type { AppCurrency } from "@/helpers/number";
import { SettingsSectionCard } from "./settings-section-card";

/**
 * La devise reste (09 § 5) ; la mise par unité est partie avec le suivi de
 * mise (2026-10-31).
 */
export function BankrollPreferencesSection({
  labels,
}: {
  labels: {
    eyebrow: string;
    title: string;
    description: string;
    savedAutomatically: string;
    displayCurrency: string;
    currencyOptions: Array<{ value: AppCurrency; label: string }>;
  };
}) {
  const currentUser = useCurrentUser();
  const setCurrentUser = useSetCurrentUser();
  const { currency, setCurrency } = useCurrencyFormat();

  async function handleCurrencyChange(value: string) {
    const next = value as AppCurrency;
    setCurrency(next);
    await clientApiRequest("/auth/me", {
      method: "PATCH",
      body: { currency: next },
      fallbackErrorMessage: "Impossible d'enregistrer la devise.",
    });
    setCurrentUser({ ...currentUser, currency: next });
  }

  return (
    <SettingsSectionCard
      eyebrow={labels.eyebrow}
      title={labels.title}
      description={labels.description}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {labels.displayCurrency}
        </p>
        <RadioGroup
          value={currency}
          onValueChange={(value) => void handleCurrencyChange(value)}
          className="mt-3 grid grid-cols-3 gap-3"
        >
          {labels.currencyOptions.map((option) => (
            <label
              key={option.value}
              htmlFor={`currency-${option.value}`}
              className="relative flex cursor-pointer items-center justify-center rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent/10"
            >
              <RadioGroupItem
                id={`currency-${option.value}`}
                value={option.value}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </RadioGroup>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {labels.savedAutomatically}
      </p>
    </SettingsSectionCard>
  );
}
