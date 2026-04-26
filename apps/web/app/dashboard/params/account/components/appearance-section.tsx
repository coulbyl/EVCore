"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { RadioGroup, RadioGroupItem } from "@evcore/ui";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("account");
  const tTheme = useTranslations("theme");

  const options = [
    { value: "light", label: tTheme("light"), icon: SunIcon },
    { value: "dark", label: tTheme("dark"), icon: MoonIcon },
    { value: "system", label: tTheme("system"), icon: MonitorIcon },
  ] as const;

  return (
    <div className="rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
        {t("appearance")}
      </p>
      <h3 className="mt-2 text-base font-semibold tracking-tight text-foreground">
        {t("theme")}
      </h3>

      <RadioGroup
        value={theme ?? "system"}
        onValueChange={setTheme}
        className="mt-4 grid grid-cols-3 gap-3"
      >
        {options.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            htmlFor={`theme-${value}`}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-border bg-background px-3 py-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent/10"
          >
            <RadioGroupItem
              id={`theme-${value}`}
              value={value}
              className="sr-only"
            />
            <Icon className="size-5 text-muted-foreground" />
            {label}
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
