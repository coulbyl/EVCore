"use client";

import { chanceOf, ledsOf } from "@/helpers/scoreboard-format";
import { ChanceLeds } from "../ui/chance-leds";
import { usePlayerText } from "../text/player-texts";

/**
 * The ticket's chance in the ticket's voice (07 § 3–4): « environ 1 fois
 * sur 9 » with its nine diodes, one lit; beyond 20 the number alone, from
 * 200 « moins de 1 fois sur 200 ». A single bet: « 6 sur 10 ».
 */
export function TicketChance({
  probability,
  phrasing = "about",
  showLeds = true,
  tone = "band",
  className,
}: {
  probability: number;
  /** `short` for a single bet: « 6 sur 10 », not « environ ». */
  phrasing?: "about" | "short";
  showLeds?: boolean;
  /** `band`: amber on the ink of the bar and the sheet's figures. */
  tone?: "band" | "surface";
  className?: string;
}) {
  const t = usePlayerText("scoreboard.chance");
  const chance = chanceOf(probability);
  if (!chance) return null;
  const values: Record<string, string> =
    chance.kind === "outOfTen"
      ? { count: String(chance.count), total: String(chance.total) }
      : { total: String(chance.total) };
  const kind =
    chance.kind === "outOfTen"
      ? "OutOfTen"
      : chance.kind === "oneIn"
        ? "OneIn"
        : "RarerThan";
  const written =
    phrasing === "about"
      ? `about${kind}`
      : `${kind[0]?.toLowerCase()}${kind.slice(1)}`;
  const spoken = `spoken${kind}`;
  const leds = showLeds ? ledsOf(chance) : null;
  return (
    <span className={className}>
      {leds ? (
        <ChanceLeds
          lit={leds.lit}
          total={leds.total}
          label={t(spoken, values)}
          tone={tone}
          size="sm"
        />
      ) : null}
      <span
        aria-hidden={leds ? true : undefined}
        className={
          tone === "band" ? "score font-bold text-led-on" : "score font-bold"
        }
      >
        {t(written, values)}
      </span>
      {leds ? null : <span className="sr-only">{t(spoken, values)}</span>}
    </span>
  );
}
