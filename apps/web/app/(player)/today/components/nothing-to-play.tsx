import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { TodayScreen } from "@/domains/today/types/today";
import { ProductRows } from "./product-rows";

/**
 * Aucun coupon aujourd'hui (04 § 5, maquette RienAJouer). S'abstenir est
 * un résultat : chaque produit dit pourquoi, avec les mots du moteur, sans
 * texte d'excuse, et le lien mène aux matchs du jour.
 *
 * Aucune abstention non plus : ce n'est pas un choix du moteur mais une
 * panne (générateur, cotes 1xBet absentes ; les coupons sont composés la
 * veille à 17 h). Une ligne, jamais d'heure ni de compte à rebours.
 */
export async function NothingToPlay({ today }: { today: TodayScreen }) {
  const t = await getTranslations("today");

  if (today.absences.length === 0) {
    return (
      <>
        <p role="status" className="py-3 text-body text-muted-foreground">
          {t("noCouponYet")}
        </p>
        <ProductRows
          coupons={[]}
          absences={[]}
          followedInProgress={today.followedInProgress}
        />
      </>
    );
  }

  return (
    <section
      aria-labelledby="nothing-title"
      className="flex flex-col gap-1 rounded-[0.875rem] border border-border bg-card px-4 pt-4 pb-1 text-card-foreground"
    >
      <h2 id="nothing-title" className="score text-title font-semibold">
        {t("nothingTitle")}
      </h2>
      <ProductRows
        coupons={[]}
        absences={today.absences}
        followedInProgress={today.followedInProgress}
        underNothingTitle
      />
      <Link
        href="/matches"
        className="flex min-h-14 items-center justify-between gap-3 border-t border-border text-body font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        {t("seeMatches")}
        <ChevronRight
          aria-hidden
          className="size-[1.125rem] text-icon-subtle"
          strokeWidth={2}
        />
      </Link>
    </section>
  );
}
