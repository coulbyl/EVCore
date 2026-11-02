"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Ellipsis } from "lucide-react";
import { clsx as cn } from "clsx";
import { usePlayerText } from "../text/player-texts";
import {
  ADMIN_BAR_KEYS,
  ADMIN_MORE_KEYS,
  ADMIN_SECTIONS,
  PLAYER_TABS,
  isAdminSectionActive,
  isTabActive,
} from "./shell-constants";
import { TabLed } from "./tab-led";
import { TabStatusLed } from "./tab-status-led";

const MORE_ID = "admin-more";

const TAB =
  "flex min-h-14 w-full flex-col items-center justify-center gap-1 text-legal font-medium focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring";
const ROW =
  "flex min-h-13 items-center gap-3.5 border-t border-border text-bet font-medium first:border-t-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";

/**
 * An admin's bar on a phone (12-admin.md, revue du 01/11): its four screens
 * and « Plus », a sheet with Exploitation, Réglages and the player's tabs —
 * the admin still looks at what a player sees, without four more tabs.
 */
export function AdminBottomTabs() {
  const pathname = usePathname();
  const t = usePlayerText("shell");
  const sections = new Map(ADMIN_SECTIONS.map((s) => [s.key, s]));
  const bar = ADMIN_BAR_KEYS.flatMap((key) => sections.get(key) ?? []);
  const more = ADMIN_MORE_KEYS.flatMap((key) => sections.get(key) ?? []);
  const moreActive = !bar.some((s) => isAdminSectionActive(pathname, s.href));
  const hide = () => document.getElementById(MORE_ID)?.hidePopover();

  return (
    <nav
      data-sheet-inert=""
      aria-label={t("tabsLabel")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {bar.map((section) => {
          const active = isAdminSectionActive(pathname, section.href);
          const Icon = section.icon;
          return (
            <li key={section.key}>
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  TAB,
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <Icon
                    aria-hidden
                    strokeWidth={1.8}
                    className={cn("size-[1.375rem]", active && "text-primary")}
                  />
                  <TabStatusLed
                    active={active}
                    className="absolute -top-2 left-1/2 -translate-x-1/2"
                  />
                </span>
                {section.key === "home"
                  ? t("adminBar.home")
                  : t(`adminSections.${section.key}`)}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            popoverTarget={MORE_ID}
            aria-current={moreActive ? "page" : undefined}
            className={cn(
              TAB,
              moreActive ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span className="relative">
              <Ellipsis
                aria-hidden
                strokeWidth={1.8}
                className={cn("size-[1.375rem]", moreActive && "text-primary")}
              />
              {moreActive ? (
                <TabLed className="absolute -top-2 left-1/2 -translate-x-1/2" />
              ) : null}
            </span>
            {t("adminBar.more")}
          </button>
        </li>
      </ul>
      <div
        id={MORE_ID}
        popover="auto"
        role="dialog"
        aria-label={t("adminBar.more")}
        className="fixed inset-x-0 top-auto bottom-[calc(3.5rem+env(safe-area-inset-bottom))] m-0 w-full max-w-none rounded-t-2xl border-0 bg-card px-4 pt-2 pb-3 text-card-foreground shadow-[0_-8px_24px_rgba(14,19,32,0.18)] backdrop:bg-black/40"
      >
        <div
          aria-hidden
          className="mx-auto mt-1 mb-2 h-1 w-10 rounded-full bg-border"
        />
        {[
          {
            title: t("adminBar.adminGroup"),
            items: more.map((s) => ({
              key: s.key,
              href: s.href,
              icon: s.icon,
              label: t(`adminSections.${s.key}`),
              active: isAdminSectionActive(pathname, s.href),
            })),
          },
          {
            title: t("adminBar.playerGroup"),
            items: PLAYER_TABS.map((tab) => ({
              key: tab.key,
              href: tab.href,
              icon: tab.icon,
              label: t(`tabs.${tab.key}`),
              active: isTabActive(pathname, tab.href),
            })),
          },
        ].map((group) => (
          <section key={group.title} className="flex flex-col">
            <p className="pt-3 pb-1 text-meta font-semibold text-muted-foreground">
              {group.title}
            </p>
            <ul className="flex flex-col">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li
                    key={item.key}
                    className="border-t border-border first:border-t-0"
                  >
                    <Link
                      href={item.href}
                      onClick={hide}
                      aria-current={item.active ? "page" : undefined}
                      className={cn(ROW, "border-t-0")}
                    >
                      <Icon
                        aria-hidden
                        strokeWidth={1.8}
                        className={cn(
                          "size-[1.375rem] shrink-0",
                          item.active && "text-primary",
                        )}
                      />
                      <span className="flex-1">{item.label}</span>
                      <ChevronRight
                        aria-hidden
                        className="size-[1.125rem] text-icon-subtle"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}
