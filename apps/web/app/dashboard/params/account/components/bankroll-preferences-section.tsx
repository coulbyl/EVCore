"use client";

import { useEffect, useState } from "react";
import { Input, RadioGroup, RadioGroupItem } from "@evcore/ui";
import { clientApiRequest } from "@/lib/api/client-api";
import {
  useCurrentUser,
  useSetCurrentUser,
} from "@/domains/auth/context/current-user-context";
import { useCurrencyFormat } from "@/providers/currency-provider";
import type { AppCurrency } from "@/helpers/number";
import { SettingsSectionCard } from "./settings-section-card";

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
    unitStake: string;
    unitModeFixed: string;
    unitModePct: string;
    unitAmountPlaceholder: string;
    unitPctPlaceholder: string;
    unitPctSuffix: string;
    unitOptionalHint: string;
  };
}) {
  const currentUser = useCurrentUser();
  const setCurrentUser = useSetCurrentUser();
  const { currency, setCurrency } = useCurrencyFormat();
  const [unitMode, setUnitMode] = useState<"FIXED" | "PCT" | "">("");
  const [unitAmountInput, setUnitAmountInput] = useState("");
  const [unitPctInput, setUnitPctInput] = useState("");

  useEffect(() => {
    setUnitMode(
      currentUser.unitMode === "FIXED" || currentUser.unitMode === "PCT"
        ? currentUser.unitMode
        : "",
    );
    setUnitAmountInput(
      currentUser.unitAmount ? String(Number(currentUser.unitAmount)) : "",
    );
    setUnitPctInput(
      currentUser.unitPercent
        ? String(Number(currentUser.unitPercent) * 100)
        : "",
    );
  }, [currentUser.unitAmount, currentUser.unitMode, currentUser.unitPercent]);

  async function persistPreferences(
    patch: Partial<{
      currency: AppCurrency;
      unitMode: "FIXED" | "PCT";
      unitAmount: number;
      unitPercent: number;
    }>,
  ) {
    await clientApiRequest("/auth/me", {
      method: "PATCH",
      body: patch,
      fallbackErrorMessage:
        "Impossible d'enregistrer les préférences de bankroll.",
    });

    setCurrentUser({
      ...currentUser,
      currency: patch.currency ?? currentUser.currency,
      unitMode: patch.unitMode ?? currentUser.unitMode,
      unitAmount:
        patch.unitAmount !== undefined
          ? patch.unitAmount.toFixed(2)
          : currentUser.unitAmount,
      unitPercent:
        patch.unitPercent !== undefined
          ? patch.unitPercent.toFixed(4)
          : currentUser.unitPercent,
    });
  }

  function handleCurrencyChange(value: string) {
    const next = value as AppCurrency;
    setCurrency(next);
    void persistPreferences({ currency: next });
  }

  function handleUnitModeChange(value: string) {
    const next = value as "FIXED" | "PCT";
    setUnitMode(next);
    void persistPreferences({ unitMode: next });
  }

  function handleUnitAmountBlur() {
    if (unitMode !== "FIXED") return;
    const parsed = Number(unitAmountInput);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    void persistPreferences({ unitMode: "FIXED", unitAmount: parsed });
  }

  function handleUnitPercentBlur() {
    if (unitMode !== "PCT") return;
    const percent = Number(unitPctInput);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) return;
    void persistPreferences({ unitMode: "PCT", unitPercent: percent / 100 });
  }

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
            onValueChange={handleCurrencyChange}
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

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {labels.unitStake}
          </p>
          <RadioGroup
            value={unitMode}
            onValueChange={handleUnitModeChange}
            className="mt-3 grid grid-cols-2 gap-3"
          >
            <label
              htmlFor="unit-mode-fixed"
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent/10"
            >
              <RadioGroupItem id="unit-mode-fixed" value="FIXED" />
              {labels.unitModeFixed}
            </label>
            <label
              htmlFor="unit-mode-pct"
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent/10"
            >
              <RadioGroupItem id="unit-mode-pct" value="PCT" />
              {labels.unitModePct}
            </label>
          </RadioGroup>

          {unitMode === "" ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {labels.unitOptionalHint}
            </p>
          ) : null}

          {unitMode === "FIXED" ? (
            <div className="mt-3">
              <Input
                type="number"
                min={0}
                step={100}
                value={unitAmountInput}
                onChange={(event) => setUnitAmountInput(event.target.value)}
                onBlur={handleUnitAmountBlur}
                placeholder={labels.unitAmountPlaceholder}
              />
            </div>
          ) : null}

          {unitMode === "PCT" ? (
            <div className="mt-3 flex items-center gap-3">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={unitPctInput}
                onChange={(event) => setUnitPctInput(event.target.value)}
                onBlur={handleUnitPercentBlur}
                placeholder={labels.unitPctPlaceholder}
              />
              <span className="text-sm font-semibold text-muted-foreground">
                {labels.unitPctSuffix}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {labels.savedAutomatically}
      </p>
    </SettingsSectionCard>
  );
}
