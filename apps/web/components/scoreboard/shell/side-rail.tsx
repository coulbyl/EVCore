"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePlayerText } from "../text/player-texts";
// clsx alone: no class comes from outside, nothing for tailwind-merge to
// resolve, and it weighed 8.5 kio of the player's JS (C0).
import { clsx as cn } from "clsx";
import { PLAYER_TABS, isTabActive } from "./shell-constants";
import { TabLed } from "./tab-led";

/**
 * La colonne gauche des écrans larges (≥ 1024 px) : la marque, les mêmes
 * quatre onglets que la barre du bas, et en pied la cloche et l'initiale
 * (passées par `footer`, rendues côté serveur). 10-transverse.md § 4.
 */
export function SideRail({ footer }: { footer: React.ReactNode }) {
  const pathname = usePathname();
  const t = usePlayerText("shell");

  return (
    <nav
      data-sheet-inert=""
      aria-label={t("tabsLabel")}
      className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col bg-band px-3 py-6 text-band-muted dark:border-r dark:border-band-rule lg:flex"
    >
      <Link
        href="/today"
        className="mb-5 rounded-md px-3 score text-title font-bold text-band-foreground focus-visible:outline-2 focus-visible:outline-led-on"
      >
        {t("brand")}
      </Link>
      <ul className="flex flex-col gap-1">
        {PLAYER_TABS.map((tab) => {
          const active = isTabActive(pathname, tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-body font-medium transition-colors focus-visible:outline-2 focus-visible:outline-led-on",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:text-band-foreground",
                )}
              >
                <Icon aria-hidden strokeWidth={1.8} className="size-5" />
                <span className="flex-1">{t(`tabs.${tab.key}`)}</span>
                {active ? <TabLed /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto px-1">{footer}</div>
    </nav>
  );
}
