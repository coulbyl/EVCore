import { useTranslations } from "next-intl";
import { cn } from "@evcore/ui/cn";
import { chanceOf, ledsOf, type Chance } from "@/helpers/scoreboard-format";
import { ChanceLeds } from "./chance-leds";

/**
 * Une chance écrite et allumée (13-style.md § 5) : « 8 sur 10 » avec ses
 * diodes, « 1 sur 3 », « moins de 1 sur 200 » (sans diodes au-delà de 20).
 *
 * `phrasing="about"` est la voix du ticket (07 § 3) : « environ 1 fois sur
 * 9 ». Une probabilité illisible n'affiche rien.
 */
export function ChanceFigure({
  probability,
  phrasing = "short",
  showLeds = true,
  tone = "surface",
  size = "md",
  className,
}: {
  probability: number;
  phrasing?: "short" | "about";
  showLeds?: boolean;
  tone?: "surface" | "band";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const t = useTranslations("scoreboard.chance");
  const chance = chanceOf(probability);
  if (!chance) return null;

  const leds = showLeds ? ledsOf(chance) : null;
  const text = written(chance, phrasing, t);
  const spoken = spokenOf(chance, t);
  const figure =
    size === "lg" ? "text-figure" : size === "md" ? "text-title" : "text-bet";

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      {leds ? (
        <ChanceLeds
          lit={leds.lit}
          total={leds.total}
          label={spoken}
          tone={tone}
          size={size === "lg" ? "md" : "sm"}
        />
      ) : null}
      <span
        aria-hidden={leds ? true : undefined}
        className={cn("score font-bold", figure)}
      >
        {text}
      </span>
      {leds ? null : <span className="sr-only">{spoken}</span>}
    </span>
  );
}

type Translate = ReturnType<typeof useTranslations<"scoreboard.chance">>;

function written(chance: Chance, phrasing: "short" | "about", t: Translate) {
  const about = phrasing === "about";
  switch (chance.kind) {
    case "outOfTen":
      return t(about ? "aboutOutOfTen" : "outOfTen", {
        count: chance.count,
        total: chance.total,
      });
    case "oneIn":
      return t(about ? "aboutOneIn" : "oneIn", { total: chance.total });
    case "rarerThan":
      return t(about ? "aboutRarerThan" : "rarerThan", {
        total: chance.total,
      });
  }
}

function spokenOf(chance: Chance, t: Translate) {
  switch (chance.kind) {
    case "outOfTen":
      return t("spokenOutOfTen", { count: chance.count, total: chance.total });
    case "oneIn":
      return t("spokenOneIn", { total: chance.total });
    case "rarerThan":
      return t("spokenRarerThan", { total: chance.total });
  }
}
