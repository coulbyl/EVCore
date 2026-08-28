"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
  cn,
} from "@evcore/ui";
import { translateCompetition, translateCountry } from "@/lib/competition-i18n";
import { PINNED_LEAGUE_CODES, type LeagueOption } from "@/lib/league-filter";

/** Championship chips above the Décisions tabs: "Tous" + the grands
 * championnats present today, plus a "Plus" search covering every other
 * league in the day's data — never a static 68-league list, so there's
 * never a dead-end result. Selection lives in the URL (`?league=CODE`) one
 * level up, so it survives switching between "Par match" and "Par canal". */
export function LeagueFilterBar({
  options,
  selected,
  onSelect,
}: {
  options: LeagueOption[];
  selected: string | null;
  onSelect: (code: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const locale = useLocale();
  const t = useTranslations("decisions");

  const pinned = PINNED_LEAGUE_CODES.map((code) =>
    options.find((o) => o.code === code),
  ).filter((o): o is LeagueOption => o !== undefined);
  const pinnedCodes = new Set(pinned.map((o) => o.code));

  const selectedExtra =
    selected && !pinnedCodes.has(selected)
      ? options.find((o) => o.code === selected)
      : undefined;

  const rest = options
    .filter((o) => !pinnedCodes.has(o.code))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (options.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip active={selected === null} onClick={() => onSelect(null)}>
          {t("filters.all")}
        </Chip>
        {pinned.map((option) => (
          <Chip
            key={option.code}
            active={selected === option.code}
            onClick={() => onSelect(option.code)}
          >
            {translateCompetition(option.name, locale)}
          </Chip>
        ))}
        {selectedExtra && (
          <Chip active onClick={() => onSelect(null)}>
            {translateCompetition(selectedExtra.name, locale)}
          </Chip>
        )}
      </div>

      {rest.length > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-panel-strong px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                open && "border-accent/40 bg-accent-soft text-accent",
              )}
            >
              <Plus className="size-3.5" />
              {t("filters.moreLeagues")}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-0">
            <Command>
              <CommandInput placeholder={t("filters.searchLeague")} />
              <CommandList>
                <CommandEmpty>{t("filters.noLeagueResults")}</CommandEmpty>
                <CommandGroup>
                  {rest.map((option) => (
                    <CommandItem
                      key={option.code}
                      value={`${translateCompetition(option.name, locale)} ${
                        option.country
                          ? translateCountry(option.country, locale)
                          : ""
                      }`}
                      onSelect={() => {
                        onSelect(option.code);
                        setOpen(false);
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {translateCompetition(option.name, locale)}
                      </span>
                      {option.country && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {translateCountry(option.country, locale)}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-accent/40 bg-accent-soft text-accent font-semibold"
          : "border-border bg-panel-strong text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
