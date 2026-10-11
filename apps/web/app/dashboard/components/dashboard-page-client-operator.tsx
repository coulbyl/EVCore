"use client";

import { Page, PageContent, Skeleton } from "@evcore/ui";
import { Announcements } from "@/components/announcements";
import { useDashboardAnnouncements } from "@/domains/announcements/use-cases/get-dashboard-announcements";
import { TodayCoupons } from "./home/today-coupons";
import { TodayPicks } from "./home/today-picks";
import { YesterdayCoupons } from "./home/yesterday-coupons";
import { MySlipsSummary } from "./home/my-slips-summary";
import { WeeklyBrief } from "./weekly-brief";

/**
 * Accueil d'un opérateur : une seule question, « qu'est-ce que je fais
 * aujourd'hui ? ». Le coupon du jour d'abord, les sélections du jour en
 * langage clair, puis hier, mes coupons et le point hebdomadaire. Ni filtre
 * de période, ni calibration des canaux, ni classements : ils vivent dans
 * Mesures historiques et Mes coupons (revue UX du 2026-10-11, P0-3).
 */
export function DashboardPageClientOperator() {
  const announcementsQuery = useDashboardAnnouncements();

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-5">
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

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
            <div className="flex min-w-0 flex-col gap-6">
              <TodayCoupons />
              <TodayPicks />
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              <YesterdayCoupons />
              <MySlipsSummary />
              <WeeklyBrief />
            </div>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
