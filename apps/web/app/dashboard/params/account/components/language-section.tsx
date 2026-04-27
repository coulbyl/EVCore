"use client";

import { useTranslations } from "next-intl";
import { RadioGroup, RadioGroupItem } from "@evcore/ui";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { SettingsSectionCard } from "./settings-section-card";

type Locale = "fr" | "en";

export function LanguageSection({ currentLocale }: { currentLocale: Locale }) {
  const t = useTranslations("account");
  const tLocale = useTranslations("locale");
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimisticLocale, setOptimisticLocale] = useOptimistic(currentLocale);

  function handleChange(locale: string) {
    const next = locale as Locale;
    startTransition(() => {
      setOptimisticLocale(next);
      document.cookie = `NEXT_LOCALE=${next}; path=/; samesite=lax`;
      router.refresh();
    });
  }

  return (
    <SettingsSectionCard eyebrow={t("language")}>
      <RadioGroup
        value={optimisticLocale}
        onValueChange={handleChange}
        className="mt-4 grid grid-cols-2 gap-3"
      >
        {(["fr", "en"] as const).map((locale) => (
          <label
            key={locale}
            htmlFor={`locale-${locale}`}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent/10"
          >
            <RadioGroupItem id={`locale-${locale}`} value={locale} />
            {tLocale(locale)}
          </label>
        ))}
      </RadioGroup>
    </SettingsSectionCard>
  );
}
