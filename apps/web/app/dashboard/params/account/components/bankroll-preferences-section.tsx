"use client";

import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@evcore/ui";
import { SettingsSectionCard } from "./settings-section-card";

type Currency = "EUR" | "USD" | "GBP";

export function BankrollPreferencesSection({
  labels,
}: {
  labels: {
    eyebrow: string;
    title: string;
    description: string;
    preferenceHint: string;
    displayCurrency: string;
    currencyOptions: Array<{ value: Currency; label: string }>;
  };
}) {
  const [currency, setCurrency] = useState<Currency>("EUR");

  return (
    <SettingsSectionCard
      eyebrow={labels.eyebrow}
      title={labels.title}
      description={labels.description}
    >
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {labels.displayCurrency}
          </p>
          <RadioGroup
            value={currency}
            onValueChange={(value) => setCurrency(value as Currency)}
            className="mt-3 grid grid-cols-3 gap-3"
          >
            {labels.currencyOptions.map((option) => (
              <label
                key={option.value}
                htmlFor={`currency-${option.value}`}
                className="flex cursor-pointer items-center justify-center rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent/10"
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
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {labels.preferenceHint}
      </p>
    </SettingsSectionCard>
  );
}
