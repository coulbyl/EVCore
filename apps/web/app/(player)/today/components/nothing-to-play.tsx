import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { TodayScreen } from "@/domains/today/types/today";
import { ProductRows } from "./product-rows";

/**
 * Aucun coupon aujourd'hui (04 § 5, maquette RienAJouer), dans une carte
 * comme un état voulu, jamais une ligne seule qui ressemble à un écran pas
 * chargé.
 *
 * - Le moteur s'est abstenu : « Aujourd'hui, on passe notre tour » et la
 *   raison de chaque produit, avec les mots du moteur.
 * - Aucune abstention non plus : une panne (générateur, cotes absentes ;
 *   les coupons sont composés la veille à 17 h). On le dit honnêtement,
 *   sans heure ni promesse.
 *
 * Dans les deux cas, une suite : les matchs du jour à lire, nos résultats.
 */
export async function NothingToPlay({ today }: { today: TodayScreen }) {
  const t = await getTranslations("today");
  const abstained = today.absences.length > 0;

  return (
    <>
      <section
        aria-labelledby="nothing-title"
        className="flex flex-col gap-1 rounded-[0.875rem] border border-border bg-card px-4 pt-4 pb-1 text-card-foreground"
      >
        <h2 id="nothing-title" className="score text-title font-semibold">
          {abstained ? t("nothingTitle") : t("outageTitle")}
        </h2>
        {abstained ? (
          <ProductRows
            coupons={[]}
            absences={today.absences}
            followedInProgress={[]}
            underNothingTitle
          />
        ) : (
          <p role="status" className="pb-2 text-body text-muted-foreground">
            {t("outageBody")}
          </p>
        )}
        <CardLink href="/matches" label={t("seeMatches")} />
        <CardLink href="/results" label={t("seeResults")} />
      </section>
      {today.followedInProgress.length > 0 ? (
        <ProductRows
          coupons={[]}
          absences={[]}
          followedInProgress={today.followedInProgress}
        />
      ) : null}
    </>
  );
}

function CardLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center justify-between gap-3 border-t border-border text-body font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      {label}
      <ChevronRight
        aria-hidden
        className="size-[1.125rem] text-icon-subtle"
        strokeWidth={2}
      />
    </Link>
  );
}
