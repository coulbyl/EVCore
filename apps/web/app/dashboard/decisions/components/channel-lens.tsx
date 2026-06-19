import { Tabs, TabsList, TabsTrigger, TabsContent, Empty } from "@evcore/ui";
import { useTranslations } from "next-intl";
import type { ChannelDecisionChannelGroupDto } from "@/domains/channel-decision/types/channel-decision";
import { channelLabel } from "./channel-constants";
import { ChannelSelectionRow } from "./channel-selection-row";

export function ChannelLens({
  channelGroups,
  locale,
}: {
  channelGroups: ChannelDecisionChannelGroupDto[];
  locale: string;
}) {
  const t = useTranslations("decisions");

  if (channelGroups.length === 0) {
    return (
      <Empty className="rounded-[1.6rem] border-border bg-background/20">
        Aucune sélection retenue pour cette date.
      </Empty>
    );
  }

  const defaultTab = channelGroups[0]!.channel;

  return (
    <Tabs
      key={channelGroups.map((e) => e.channel).join(",")}
      defaultValue={defaultTab}
      className="h-full min-h-0"
    >
      <div className="shrink-0 overflow-x-auto pb-1">
        <TabsList variant="line">
          {channelGroups.map(({ channel, decisions }) => (
            <TabsTrigger key={channel} value={channel}>
              {channelLabel(channel, t)}
              <span className="ml-1 tabular-nums text-[0.65rem] opacity-60">
                {decisions.length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {channelGroups.map(({ channel, decisions }) => (
        <TabsContent
          key={channel}
          value={channel}
          className="mt-3 min-h-0 overflow-hidden"
        >
          <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto pb-4 pr-1">
            {decisions.map((decision) => (
              <ChannelSelectionRow
                key={decision.id}
                decision={decision}
                locale={locale}
              />
            ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
