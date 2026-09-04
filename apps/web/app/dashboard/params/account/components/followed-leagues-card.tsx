"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Skeleton, InputGroup, InputGroupAddon, InputGroupInput } from "@evcore/ui";
import { Search } from "lucide-react";
import {
  translateCompetition,
  translateCountry,
} from "@/lib/competition-i18n";
import {
  useFollowLeague,
  useLeagueCatalog,
  usePersonalization,
  useUnfollowLeague,
} from "@/domains/personalization/use-cases/use-personalization";
import type { LeagueCatalogItem } from "@/domains/personalization/types/personalization";
import { SettingsSectionCard } from "./settings-section-card";

type CountryGroup = {
  country: string;
  countryLabel: string;
  leagues: (LeagueCatalogItem & { label: string })[];
};

function groupByCountry(
  catalog: LeagueCatalogItem[],
  locale: string,
): CountryGroup[] {
  const byCountry = new Map<string, CountryGroup>();
  for (const league of catalog) {
    const countryLabel = translateCountry(league.country, locale);
    const group = byCountry.get(league.country) ?? {
      country: league.country,
      countryLabel,
      leagues: [],
    };
    group.leagues.push({
      ...league,
      label: translateCompetition(league.name, locale),
    });
    byCountry.set(league.country, group);
  }
  const groups = [...byCountry.values()];
  for (const group of groups) {
    group.leagues.sort((a, b) => a.label.localeCompare(b.label));
  }
  groups.sort((a, b) => a.countryLabel.localeCompare(b.countryLabel));
  return groups;
}

export function FollowedLeaguesCard() {
  const t = useTranslations("account.personalization");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const { data: personalization, isLoading: loadingPersonalization } =
    usePersonalization();
  const { data: catalog, isLoading: loadingCatalog } = useLeagueCatalog();
  const { mutate: follow } = useFollowLeague();
  const { mutate: unfollow } = useUnfollowLeague();

  const followedCodes = new Set(
    (personalization?.followedLeagues ?? []).map((l) => l.code),
  );

  const groups = useMemo(() => {
    const all = groupByCountry(catalog ?? [], locale);
    const query = search.trim().toLowerCase();
    if (!query) return all;
    return all
      .map((group) => ({
        ...group,
        leagues: group.leagues.filter(
          (l) =>
            l.label.toLowerCase().includes(query) ||
            group.countryLabel.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.leagues.length > 0);
  }, [catalog, locale, search]);

  const isLoading = loadingPersonalization || loadingCatalog;

  return (
    <SettingsSectionCard
      eyebrow={t("leaguesTitle")}
      description={t("leaguesSubtitle", { count: followedCodes.size })}
    >
      {isLoading ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      ) : (catalog?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">{t("leaguesEmpty")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <InputGroup>
            <InputGroupAddon>
              <Search className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder={t("leaguesSearchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </InputGroup>

          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("leaguesNoResults")}
            </p>
          ) : (
            <div className="flex max-h-[26rem] flex-col gap-4 overflow-y-auto pr-1">
              {groups.map((group) => (
                <div key={group.country} className="flex flex-col gap-2">
                  <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    {group.countryLabel}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.leagues.map((league) => {
                      const isFollowed = followedCodes.has(league.code);
                      return (
                        <button
                          key={league.code}
                          type="button"
                          onClick={() =>
                            isFollowed
                              ? unfollow(league.code)
                              : follow(league.code)
                          }
                          className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                            isFollowed
                              ? "border-accent/40 bg-accent-soft font-semibold text-accent"
                              : "border-border bg-panel-strong text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {isFollowed ? "✓ " : ""}
                          {league.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </SettingsSectionCard>
  );
}
