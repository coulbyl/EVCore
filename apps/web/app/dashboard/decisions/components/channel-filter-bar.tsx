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
import type { ChannelFacet } from "@/domains/channel-decision/types/channel-decision";
import { channelLabel } from "./channel-constants";

/** Channel/view switcher — single-select, one popover-picker button at every
 * breakpoint (same pattern as LeagueFilterBar). Replaces the old segmented
 * "Par match"/"Par canal" toggle and the separate "Par canal" tab strip —
 * clicking a channel here both switches which content is displayed AND
 * narrows the backend fetch to that one channel (`?active=CODE`), there's no
 * separate "which channels to filter" concept anymore. `options` keeps the
 * meaningful channel order from the backend (facetChannelOrder), not
 * re-sorted alphabetically like leagues. */
export function ChannelFilterBar({
  options,
  selected,
  onSelect,
}: {
  options: ChannelFacet[];
  selected: string | null;
  onSelect: (channel: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("decisions");
  const locale = useLocale();

  const selectedOption = selected
    ? options.find((o) => o.channel === selected)
    : undefined;

  if (options.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-2xl border border-border bg-panel-strong px-4 py-2.5 text-sm font-medium text-foreground md:w-auto"
        >
          <span className="min-w-0 truncate">
            {selectedOption ? channelLabel(selectedOption.channel, locale) : t("lens.matches")}
          </span>
          <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[calc(100vw-2rem)] max-w-xs p-0">
        <Command>
          <CommandInput placeholder={t("filters.searchChannel")} />
          <CommandList>
            <CommandEmpty>{t("filters.noChannelResults")}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={t("lens.matches")}
                onSelect={() => {
                  onSelect(null);
                  setOpen(false);
                }}
              >
                {t("lens.matches")}
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.channel}
                  value={channelLabel(option.channel, locale)}
                  onSelect={() => {
                    onSelect(option.channel);
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {channelLabel(option.channel, locale)}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {option.count}
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
