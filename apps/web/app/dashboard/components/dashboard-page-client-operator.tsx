"use client";

import { Page, PageContent, Skeleton } from "@evcore/ui";
import { Announcements } from "@/components/announcements";
import { useDashboardAnnouncements } from "@/domains/announcements/use-cases/get-dashboard-announcements";
import { TodayCoupons } from "./home/today-coupons";
import { TodayPicks } from "./home/today-picks";
import { YesterdayCoupons } from "./home/yesterday-coupons";
import { MySlipsSummary } from "./home/my-slips-summary";
import { WeeklyBrief } from "./weekly-brief";
import { useTranslations } from "next-intl";

/**
 * Accueil d'un opérateur : trois questions, dans l'ordre où le joueur se les
 * pose sur son téléphone (revue UX du 2026-10-24, P1 n°3) : hier a-t-il
 * gagné ? qu'est-ce que je joue aujourd'hui ? suis-je en gain ou en perte ?
 * Sur téléphone : Hier, le coupon du jour, les sélections, Mes coupons, le
 * point hebdomadaire. Sur grand écran, deux colonnes (aujourd'hui à gauche,
 * hier et mon suivi à droite). Ni filtre de période, ni calibration des
 * canaux, ni classements : ils vivent dans Mesures historiques et Mes
 * coupons (revue UX du 2026-10-11, P0-3).
 */
export function DashboardPageClientOperator() {
  const t = useTranslations("dashboard.home");
  const announcementsQuery = useDashboardAnnouncements();

  return (
    <Page className="flex h-full flex-col">
      {/* pb-20 : le bouton flottant d'Eva (44–48 px, fixe en bas à droite)
          ne doit plus couvrir la dernière tuile une fois la page déroulée. */}
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 pb-20 sm:p-5 sm:pb-20 ev-shell-shadow">
        <div className="flex flex-col gap-5">
          {/* Un titre de page pour les lecteurs d'écran : la page n'avait que
              des h2 (détecteur, revue UX du 2026-10-24). */}
          <h1 className="sr-only">{t("pageTitle")}</h1>
          {announcementsQuery.isLoading ? (
            <Skeleton className="h-14 rounded-2xl" />
          ) : (
            <Announcements
              items={(announcementsQuery.data ?? []).map((item) => ({
                id: item.id,
                title: item.title,
                description: item.description,
                href: item.href ?? undefined,
                isRead: item.isRead,
              }))}
            />
          )}

          {/* Les colonnes sont `contents` sous lg : leurs blocs deviennent des
              cases de la grille et prennent l'ordre du téléphone ; à partir
              de lg elles redeviennent deux colonnes et l'ordre s'annule.
              `empty:hidden` : un bloc qui ne rend rien (Hier sans coupon,
              brief hors lundi) ne laisse pas d'espace. */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
              <div className="order-2 min-w-0 empty:hidden lg:order-none">
                <TodayCoupons />
              </div>
              <div className="order-3 min-w-0 empty:hidden lg:order-none">
                <TodayPicks />
              </div>
            </div>
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
              <div className="order-1 min-w-0 empty:hidden lg:order-none">
                <YesterdayCoupons />
              </div>
              <div className="order-4 min-w-0 empty:hidden lg:order-none">
                <MySlipsSummary />
              </div>
              <div className="order-5 min-w-0 empty:hidden lg:order-none">
                <WeeklyBrief />
              </div>
            </div>
          </div>

          {/* Mention de risque, sobre et toujours présente en bas de l'accueil
              (règles de rédaction, apps/web/PRODUCT.md). */}
          <p
            data-testid="home-risk-line"
            className="text-center text-xs text-muted-foreground"
          >
            {t("riskLine")}
          </p>
        </div>
      </PageContent>
    </Page>
  );
}
