"use client";

import { useState } from "react";
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
import { SettingsSectionCard } from "./settings-section-card";
import { formatCalibrationRatio } from "./personalization-constants";

function formatSince(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function FollowedChannelsCard() {
  const t = useTranslations("account.personalization");
  const tChannels = useTranslations("decisions.channels");
  const locale = useLocale();
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [discoverTab, setDiscoverTab] = useState<"proven" | "watch">(
    "proven",
  );

  const { data: personalization, isLoading } = usePersonalization();
  const { data: discoverable, isLoading: loadingDiscover } =
    useDiscoverChannels(discoverOpen);
  const { mutate: follow } = useFollowChannel();
  const { mutate: unfollow } = useUnfollowChannel();

  function channelLabel(channel: string): string {
    try {
      return tChannels(`${channel}.label`);
    } catch {
      return channel;
    }
  }

  const proven = (discoverable ?? []).filter((c) => c.proven && !c.followed);
  const watch = (discoverable ?? []).filter((c) => !c.proven && !c.followed);
  const visible = discoverTab === "proven" ? proven : watch;

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
              <div className="flex gap-1 border-b border-border px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => setDiscoverTab("proven")}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    discoverTab === "proven"
                      ? "bg-accent-soft text-accent"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("discoverProven")}
                </button>
                <button
                  type="button"
                  onClick={() => setDiscoverTab("watch")}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    discoverTab === "watch"
                      ? "bg-accent-soft text-accent"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("discoverWatch")} ({watch.length})
                </button>
              </div>
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
                          value={channelLabel(item.channel)}
                          onSelect={() => follow(item.channel)}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {channelLabel(item.channel)}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatCalibrationRatio(item.calibrationRatio)} ·
                            n={item.sampleSize}
                          </span>
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
                  {channelLabel(item.channel)}
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
