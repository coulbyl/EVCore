import Link from "next/link";
import { Settings } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PlayerBand } from "@/components/scoreboard/shell/player-band";
import {
  ADMIN_SECTIONS,
  type AdminSectionKey,
} from "@/components/scoreboard/shell/shell-constants";
import { ChipGroup } from "@/components/scoreboard/ui/chip-group";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import { displayLocaleOf, formatTime } from "@/helpers/scoreboard-format";

/**
 * The admin's band (maquettes AdminMobile, Admin): its title and the
 * moment it is read, then on a phone the three screens as chips and the
 * settings wheel (the rail carries them on a wide screen).
 */
export async function AdminBand({ current }: { current: AdminSectionKey }) {
  const [t, shell, locale, timeZone] = await Promise.all([
    getTranslations("console"),
    getTranslations("shell"),
    getLocale(),
    getPlayerTimeZone(),
  ]);
  const display = displayLocaleOf(locale);
  const now = new Date();
  const day = new Intl.DateTimeFormat(display === "en" ? "en-GB" : "fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone,
  }).format(now);
  const screens = ADMIN_SECTIONS.filter((s) => s.key !== "settings");

  return (
    <PlayerBand>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="score text-title font-bold">
            {t(`titles.${current}`)}
          </h1>
          <p className="text-meta text-band-muted">
            {day} · {formatTime(now, display, timeZone)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 lg:hidden">
          <ChipGroup
            label={shell("tabs.admin")}
            tone="band"
            items={screens.map((s) => ({
              key: s.key,
              label: shell(`adminSections.${s.key}`),
              href: s.href,
              active: s.key === current,
            }))}
          />
          <Link
            href="/admin/settings"
            aria-label={shell("adminSections.settings")}
            aria-current={current === "settings" ? "page" : undefined}
            className="flex size-11 items-center justify-center rounded-full text-band-muted hover:text-band-foreground focus-visible:outline-2 focus-visible:outline-led-on aria-[current=page]:text-led-on"
          >
            <Settings aria-hidden className="size-5" strokeWidth={1.8} />
          </Link>
        </div>
      </div>
    </PlayerBand>
  );
}
