import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ScoreLine,
  type ScoreItem,
} from "@/components/scoreboard/ui/score-line";
import type { TodayScreen } from "@/domains/today/types/today";

/**
 * La ligne Hier, en haut d'Aujourd'hui (04 § 4) : un code par produit qui a
 * joué, dans l'ordre de l'écran, le coupon suivi d'abord (le serveur trie).
 * Le lundi, « Ta semaine » et les jours gagnés sur joués. Rien hier : rien.
 * Un toucher mène à Résultats.
 */
export async function YesterdayLine({ today }: { today: TodayScreen }) {
  const t = await getTranslations("today");

  if (today.week) {
    const products = today.week.products.filter((p) => p.played > 0);
    if (products.length === 0) return null;
    return (
      <Link
        href="/results"
        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md focus-visible:outline-2 focus-visible:outline-led-on"
      >
        <span className="text-meta text-band-muted">{t("week")}</span>
        <span className="score flex flex-wrap gap-x-4 text-bet font-semibold">
          {products.map((p) => (
            <span key={p.product}>
              <span aria-hidden>
                {t(`codes.${p.product}`)} {p.won}/{p.played}
              </span>
              <span className="sr-only">
                {t("weekProduct", {
                  product: t(`shortNames.${p.product}`),
                  won: p.won,
                  played: p.played,
                })}
              </span>
            </span>
          ))}
        </span>
      </Link>
    );
  }

  if (today.yesterday.length === 0) return null;
  const items: ScoreItem[] = today.yesterday.map((item) => {
    const name = t(`shortNames.${item.product}`);
    return {
      code: item.followedByMe
        ? t("yourProduct", { product: t(`codes.${item.product}`) })
        : t(`codes.${item.product}`),
      label: item.followedByMe ? t("yourProduct", { product: name }) : name,
      outcome: item.outcome,
    };
  });
  return (
    <Link
      href="/results"
      className="flex flex-wrap items-baseline gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-led-on"
    >
      <span className="text-meta text-band-muted">{t("yesterday")}</span>
      {/* Sans nom de liste : le lien se lit « Hier Favori : gagné… ». */}
      <ScoreLine items={items} />
    </Link>
  );
}
