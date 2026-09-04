"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@evcore/ui";
import { translateCompetition, translateCountry } from "@/lib/competition-i18n";
import type { LeagueFacet } from "@/domains/channel-decision/types/channel-decision";

/** Championship filter above the Décisions/Arbitrage lenses — single-select,
 * one popover-picker button at every breakpoint (same pattern as the
 * Personnalisation rail on /dashboard/params/account), instead of a
 * scrollable chip strip fighting a separate "+Plus" button for space.
 * Selection lives in the URL (`?league=CODE`) one level up. `options` comes
 * from the cheap facets endpoint (ChannelDecisionRepository.findFacetRows),
 * not derived from the full decisions payload. */
export function LeagueFilterBar({
  options,
  selected,
  onSelect,
}: {
  options: LeagueFacet[];
  selected: string | null;
  onSelect: (code: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const locale = useLocale();
  const t = useTranslations("decisions");

  const selectedOption = selected
    ? options.find((o) => o.code === selected)
    : undefined;

  const sortedAll = [...options].sort((a, b) => a.name.localeCompare(b.name));

  if (options.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-2xl border border-border bg-panel-strong px-4 py-2.5 text-sm font-medium text-foreground md:w-auto"
        >
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="shrink-0 text-muted-foreground">
              {t("filters.leagueLabel")}
            </span>
            <span className="min-w-0 truncate">
              {selectedOption
                ? translateCompetition(selectedOption.name, locale)
                : t("filters.all")}
            </span>
          </span>
          <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[calc(100vw-2rem)] max-w-xs p-0">
        <Command>
          <CommandInput placeholder={t("filters.searchLeague")} />
          <CommandList>
            <CommandEmpty>{t("filters.noLeagueResults")}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={t("filters.all")}
                onSelect={() => {
                  onSelect(null);
                  setOpen(false);
                }}
              >
                {t("filters.all")}
              </CommandItem>
              {sortedAll.map((option) => (
                <CommandItem
                  key={option.code}
                  value={`${translateCompetition(option.name, locale)} ${translateCountry(option.country, locale)}`}
                  onSelect={() => {
                    onSelect(option.code);
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {translateCompetition(option.name, locale)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {translateCountry(option.country, locale)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
