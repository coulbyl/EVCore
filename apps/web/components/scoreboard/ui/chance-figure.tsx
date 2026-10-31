import { useTranslations } from "next-intl";
import { cn } from "@evcore/ui/cn";
import { chanceOf, ledsOf, type Chance } from "@/helpers/scoreboard-format";
import { ChanceLeds } from "./chance-leds";

/**
 * Une chance écrite et allumée (13-style.md § 5) : « 8 sur 10 » avec ses
 * diodes, « 1 sur 3 », « moins de 1 sur 200 » (sans diodes au-delà de 20).
 *
 * `phrasing="about"` est la voix du ticket (07 § 3) : « environ 1 fois sur
 * 9 ». `phrasing="passes"` dit ce que le chiffre compte, là où le joueur
 * décide (le coupon, notre lecture) : « Passe 8 fois sur 10 ». Une
 * probabilité illisible n'affiche rien.
 */
export function ChanceFigure({
  probability,
  phrasing = "short",
  showLeds = true,
  tone = "surface",
  size = "md",
  lightUp = false,
  className,
}: {
  probability: number;
  phrasing?: Phrasing;
  showLeds?: boolean;
  tone?: "surface" | "band";
  size?: "sm" | "md" | "lg";
  /** Light the diodes up once on open (Aujourd'hui's hero, 13-style.md § 5). */
  lightUp?: boolean;
  className?: string;
}) {
  const t = useTranslations("scoreboard.chance");
  const chance = chanceOf(probability);
  if (!chance) return null;

  const leds = showLeds ? ledsOf(chance) : null;
  const text = written(chance, phrasing, t);
  const spoken = spokenOf(chance, t);
  // « Passe 8 fois sur 10 » is a phrase: it stays on one line a step below
  // the bare figure.
  const figure =
    size === "lg" && phrasing !== "passes"
      ? "text-figure"
      : size === "sm"
        ? "text-bet"
        : "text-title";

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      {leds ? (
        <ChanceLeds
          lit={leds.lit}
          total={leds.total}
          label={spoken}
          tone={tone}
          size={size === "lg" && phrasing !== "passes" ? "md" : "sm"}
          lightUp={lightUp}
        />
      ) : null}
      <span
        aria-hidden={leds ? true : undefined}
        className={cn("score font-bold whitespace-nowrap", figure)}
      >
        {text}
      </span>
      {leds ? null : <span className="sr-only">{spoken}</span>}
    </span>
  );
}

type Translate = ReturnType<typeof useTranslations<"scoreboard.chance">>;
type Phrasing = "short" | "about" | "passes";

function written(chance: Chance, phrasing: Phrasing, t: Translate) {
  if (phrasing === "passes") {
    const verb = (chunks: React.ReactNode) => (
      <span className="font-normal">{chunks}</span>
    );
    switch (chance.kind) {
      case "outOfTen":
        return t.rich("passesOutOfTen", {
          count: chance.count,
          total: chance.total,
          verb,
        });
      case "oneIn":
        return t.rich("passesOneIn", { total: chance.total, verb });
      case "rarerThan":
        return t.rich("passesRarerThan", { total: chance.total, verb });
    }
  }
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
