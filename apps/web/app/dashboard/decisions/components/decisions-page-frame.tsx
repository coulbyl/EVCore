"use client";

import { useState } from "react";
import { ShieldCheck, SlidersHorizontal, Target } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Page,
  PageContent,
  PageHeader,
  PageHeaderActions,
  Skeleton,
} from "@evcore/ui";
import { DateNav } from "@/components/date-nav";
import { FormationHelpLink } from "@/components/formation-help-link";
import { FiltersPopover } from "@/components/filters-popover";

export function DecisionsPageFrame({
  children,
  contentScroll = "page",
  date,
  emptyDescription,
  emptyTitle,
  hasData,
  isError,
  isLoading,
  onDateChange,
  filters,
  displayControls,
  activeFilterCount,
}: {
  children: React.ReactNode;
  contentScroll?: "page" | "child";
  date: string;
  emptyDescription: string;
  emptyTitle: string;
  hasData: boolean;
  isError: boolean;
  isLoading: boolean;
  onDateChange: (iso: string) => void;
  // League switcher + channel/view switcher (LeagueFilterBar,
  // ChannelFilterBar) — single-select, side by side on desktop, stacked in
  // a column on mobile, inside the PageHeader bar itself.
  filters: React.ReactNode;
  // Display controls (group-by, …) — on desktop behind a small popover next
  // to the date, on mobile inside the single filters drawer with the league
  // and channel pickers.
  displayControls?: React.ReactNode;
  // Number of non-default filters set, shown on the mobile « Filtres »
  // button so collapsing them never hides that state.
  activeFilterCount?: number;
}) {
  const t = useTranslations("decisions");
  const pageOwnsScroll = contentScroll === "page";
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const hasFilters = filters !== null || displayControls !== undefined;

  return (
    <Page className="flex h-full flex-col">
      {/* Une seule ligne en mobile : « Filtres » avec son compteur, la date
          au centre, l'aide à droite. Le bloc empilé (ligue, canal, affichage,
          date, aide) prenait 60 % du premier écran et le premier match
          n'arrivait qu'au second (revue UX du 2026-10-11, P1-5). En desktop
          les sélecteurs restent en ligne. */}
      <PageHeader>
        {/* Titre pour les lecteurs d'écran : la barre reste sur une ligne en
            mobile, le premier match doit rester dans le premier écran. */}
        <h1 className="sr-only">{t("pageTitle")}</h1>
        <div className="hidden min-w-0 flex-1 md:flex md:items-center md:gap-3">
          {filters}
        </div>
        <PageHeaderActions className="w-full flex-nowrap lg:w-auto">
          {hasFilters && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMobileFiltersOpen(true)}
              className="relative h-11 shrink-0 gap-1.5 text-xs md:hidden"
              data-testid="decisions-filters-button"
            >
              <SlidersHorizontal size={13} />
              {t("filters.allFilters")}
              {activeFilterCount ? (
                <span className="rounded-full bg-accent/15 px-1.5 text-xs font-semibold tabular-nums text-accent">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
          )}
          {displayControls !== undefined && (
            <div className="hidden md:block">
              <FiltersPopover
                label={t("filters.displayLabel")}
                active={(activeFilterCount ?? 0) > 0}
              >
                {displayControls}
              </FiltersPopover>
            </div>
          )}
          <DateNav
            date={date}
            onChange={onDateChange}
            className="min-w-0 flex-1 justify-center"
          />
          <FormationHelpLink
            slug="lire-un-pronostic"
            label={t("helpLink")}
            tourId="decisions-help"
          />
        </PageHeaderActions>
      </PageHeader>

      {hasFilters && (
        <Drawer
          open={mobileFiltersOpen}
          onOpenChange={setMobileFiltersOpen}
          direction="bottom"
        >
          <DrawerContent className="z-50 flex max-h-[85dvh] flex-col rounded-t-3xl bg-panel outline-none">
            <DrawerHeader>
              <DrawerTitle>{t("filters.allFilters")}</DrawerTitle>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-6">
              {filters}
              {displayControls}
            </div>
          </DrawerContent>
        </Drawer>
      )}

      <PageContent
        className={`min-h-0 flex-1 p-4 sm:p-5 ev-shell-shadow ${
          pageOwnsScroll ? "overflow-y-auto" : "overflow-hidden"
        }`}
      >
        <div
          className={
            pageOwnsScroll ? "min-h-full" : "flex h-full min-h-0 flex-col"
          }
        >
          {isLoading && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-2xl" />
              ))}
            </div>
          )}

          {isError && (
            <Empty className="rounded-[1.6rem] border-border bg-background/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ShieldCheck className="size-5" />
                </EmptyMedia>
                <EmptyTitle>Chargement impossible</EmptyTitle>
                <EmptyDescription>
                  Erreur de chargement. Réessayez plus tard.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {!isLoading && !isError && !hasData && (
            <Empty className="rounded-[1.6rem] border-border bg-background/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Target className="size-5" />
                </EmptyMedia>
                <EmptyTitle>{emptyTitle}</EmptyTitle>
                <EmptyDescription>{emptyDescription}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {!isLoading && !isError && hasData && children}
        </div>
      </PageContent>
    </Page>
  );
}
