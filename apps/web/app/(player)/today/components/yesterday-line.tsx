import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { YesterdaySummary } from "@/components/scoreboard/ui/yesterday-summary";
import type { TodayScreen } from "@/domains/today/types/today";

/**
 * La ligne Hier, en haut d'Aujourd'hui (04 § 4, revue du 31/10) : le premier
 * produit en clair avec son ✓ ✗, puis « 4 gagnés sur 7 » ; un toucher ouvre
 * la feuille d'hier, où chaque produit est nommé. Le lundi, « Ta semaine »
 * et les jours gagnés sur joués. Rien hier : rien.
 */
export async function YesterdayLine({ today }: { today: TodayScreen }) {
  const t = await getTranslations("today");

  if (today.week) {
    // The hero's count in words, as on Résultats; the sheet holds the rest.
    const hero = today.week.products.find((p) => p.played > 0);
    if (!hero) return null;
    return (
      <Link
        href="/results/week"
        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md focus-visible:outline-2 focus-visible:outline-led-on"
      >
        <span className="text-meta text-band-muted">{t("week")}</span>
        <span className="text-body font-medium">
          {t(`shortNames.${hero.product}`)}
        </span>
        <span className="score text-bet font-semibold">
          {t("yesterdayCount", { won: hero.won, played: hero.played })}
        </span>
      </Link>
    );
  }

  if (today.yesterday.length === 0) return null;
  // The first product of the screen (the followed one first, the server
  // sorts) in words, then the count; the sheet names every product.
  const [first] = today.yesterday;
  if (!first) return null;
  const name = t(`shortNames.${first.product}`);
  const played = today.yesterday.filter(
    (item) => item.outcome === "won" || item.outcome === "lost",
  );
  const won = played.filter((item) => item.outcome === "won").length;
  return (
    <YesterdaySummary
      href="/results/yesterday"
      label={t("yesterday")}
      lead={{
        name: first.followedByMe ? t("yourProduct", { product: name }) : name,
        outcome: first.outcome,
      }}
      count={
        today.yesterday.length > 1
          ? t("yesterdayCount", { won, played: played.length })
          : null
      }
      outcomeLabels={{
        won: t("won"),
        lost: t("lost"),
        void: t("refunded"),
      }}
    />
  );
}
