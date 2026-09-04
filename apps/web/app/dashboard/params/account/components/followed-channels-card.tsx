"use client";

import { useState } from "react";
import * as HoverCard from "@radix-ui/react-hover-card";
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
  Skeleton,
} from "@evcore/ui";
import { Plus } from "lucide-react";
import {
  useDiscoverChannels,
  useFollowChannel,
  usePersonalization,
  useUnfollowChannel,
} from "@/domains/personalization/use-cases/use-personalization";
import { channelLabel } from "@/app/dashboard/decisions/components/channel-constants";
import { ChannelStatusBadge } from "@/components/channel-status-badge";
import type { ChannelStatus } from "@/domains/dashboard/types/dashboard";
import type { StrategyChannel } from "@/domains/channel-decision/types/channel-decision";
import { SettingsSectionCard } from "./settings-section-card";

function formatSince(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function FollowedChannelsCard() {
  const t = useTranslations("account.personalization");
  const locale = useLocale();
  const [discoverOpen, setDiscoverOpen] = useState(false);

  const { data: personalization, isLoading } = usePersonalization();
  const { data: discoverable, isLoading: loadingDiscover } =
    useDiscoverChannels(discoverOpen);
  const { mutate: follow } = useFollowChannel();
  const { mutate: unfollow } = useUnfollowChannel();

  // One flat list, sorted by reliability — no "Prouvés"/"En observation"
  // split (removed 2026-09-04): calibration is a spectrum (GREEN/ORANGE/RED/
  // INSUFFICIENT_DATA), not a two-tier admission gate, and at current volumes
  // the "watch" bucket was catching nearly every channel, not a genuine
  // in-between tier.
  const STATUS_RANK: Record<ChannelStatus, number> = {
    GREEN: 0,
    ORANGE: 1,
    RED: 2,
    INSUFFICIENT_DATA: 3,
    INACTIVE: 4,
  };
  const visible = (discoverable ?? [])
    .filter((c) => !c.followed)
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);

  return (
    <SettingsSectionCard>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <p className="text-base font-semibold tracking-tight text-foreground">
            {t("channelsTitle")}
          </p>
        </div>

        <Popover open={discoverOpen} onOpenChange={setDiscoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-panel-strong px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="size-3.5" />
              {t("discoverButton")}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <Command>
              <CommandInput placeholder={t("discoverSearchPlaceholder")} />
              <CommandList>
                {loadingDiscover ? (
                  <div className="flex flex-col gap-2 p-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <>
                    <CommandEmpty>{t("discoverEmpty")}</CommandEmpty>
                    <CommandGroup>
                      {visible.map((item) => (
                        <CommandItem
                          key={item.channel}
                          value={channelLabel(item.channel as StrategyChannel, locale)}
                          onSelect={() => follow(item.channel)}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {channelLabel(item.channel as StrategyChannel, locale)}
                          </span>
                          <DiscoverStatusBadge
                            status={item.status}
                            sampleSize={item.sampleSize}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
              <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                {t("discoverTip")}
              </p>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">{t("channelsHint")}</p>

      <div className="mt-4 flex flex-col gap-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))
        ) : (personalization?.followedChannels.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("channelsEmpty")}
          </p>
        ) : (
          personalization!.followedChannels.map((item) => (
            <div
              key={item.channel}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-2.5"
            >
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {channelLabel(item.channel as StrategyChannel, locale)}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t("since", { date: formatSince(item.since, locale) })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => unfollow(item.channel)}
                className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("unfollow")}
              </button>
            </div>
          ))
        )}
      </div>
    </SettingsSectionCard>
  );
}

/** Same qualitative-verdict pattern as Decisions/Arbitrage's CalibrationBadge
 * (channel-row.tsx) — plain-language HoverCard, no raw ratio/n= notation in
 * the visible text ("0.97× · n=2000" reads as internal jargon to a lambda
 * user). Distinct component (not a direct reuse) because it judges the
 * channel over the whole 90-day discover window rather than one
 * (channel, competition) pair, so the tooltip copy differs. INSUFFICIENT_DATA
 * renders nothing, same rationale as the pick-row badge: a badge that almost
 * always reads "insuffisant" carries no signal. */
function DiscoverStatusBadge({
  status,
  sampleSize,
}: {
  status: ChannelStatus;
  sampleSize: number;
}) {
  const t = useTranslations("account.personalization");
  const [open, setOpen] = useState(false);

  if (status === "INSUFFICIENT_DATA") return null;

  const detail = t("discoverStatusTooltip", { status, n: sampleSize });

  return (
    <HoverCard.Root
      open={open}
      onOpenChange={setOpen}
      openDelay={200}
      closeDelay={100}
    >
      <HoverCard.Trigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="inline-flex shrink-0 focus:outline-none"
        >
          <ChannelStatusBadge
            status={status}
            className="px-1.5 py-0 text-[0.62rem]"
          />
        </button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          sideOffset={8}
          onEscapeKeyDown={() => setOpen(false)}
          onPointerDownOutside={() => setOpen(false)}
          className="z-50 w-64 rounded-2xl border border-border bg-panel p-3 text-xs text-foreground shadow-lg"
        >
          {detail}
          <HoverCard.Arrow className="fill-panel" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
