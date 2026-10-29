"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@evcore/ui/cn";
import { PLAYER_TABS, isTabActive } from "./shell-constants";
import { TabLed } from "./tab-led";

/**
 * La barre d'onglets du téléphone, fixée en bas, au-dessus de la zone de
 * geste du système. Masquée à partir de 1024 px, où la colonne gauche prend
 * le relais (10-transverse.md § 4).
 */
export function BottomTabs() {
  const pathname = usePathname();
  const t = useTranslations("shell");

  return (
    <nav
      aria-label={t("tabsLabel")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-4">
        {PLAYER_TABS.map((tab) => {
          const active = isTabActive(pathname, tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-legal font-medium focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <Icon
                    aria-hidden
                    strokeWidth={1.8}
                    className={cn("size-[1.375rem]", active && "text-primary")}
                  />
                  {active ? (
                    <TabLed className="absolute -top-2 left-1/2 -translate-x-1/2" />
                  ) : null}
                </span>
                {t(`tabs.${tab.key}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
