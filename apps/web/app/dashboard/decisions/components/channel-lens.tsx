import { Tabs, TabsList, TabsTrigger, TabsContent, Empty } from "@evcore/ui";
import { useTranslations } from "next-intl";
import type { ChannelDecisionDto } from "@/domains/channel-decision/types/channel-decision";
import { CHANNEL_ORDER, channelLabel } from "./channel-constants";
import { ChannelSelectionRow } from "./channel-selection-row";

export function ChannelLens({
  decisions,
  locale,
}: {
  decisions: ChannelDecisionDto[];
  locale: string;
}) {
  const t = useTranslations("decisions");
  // Selected decisions grouped by channel, in canonical order.
  const selectedByChannel = CHANNEL_ORDER.map((channel) => ({
    channel,
    rows: decisions.filter(
      (d) => d.channel === channel && d.status === "SELECTED",
    ),
  })).filter((entry) => entry.rows.length > 0);

  if (selectedByChannel.length === 0) {
    return (
      <Empty className="rounded-[1.6rem] border-border bg-background/20">
        Aucune sélection retenue pour cette date.
      </Empty>
    );
  }

  const defaultTab = selectedByChannel[0]!.channel;

  return (
    <Tabs
      key={selectedByChannel.map((e) => e.channel).join(",")}
      defaultValue={defaultTab}
    >
      <div className="overflow-x-auto">
        <TabsList variant="line">
          {selectedByChannel.map(({ channel, rows }) => (
            <TabsTrigger key={channel} value={channel}>
              {channelLabel(channel, t)}
              <span className="ml-1 tabular-nums text-[0.65rem] opacity-60">
                {rows.length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {selectedByChannel.map(({ channel, rows }) => (
        <TabsContent key={channel} value={channel} className="mt-4">
          <div className="flex flex-col gap-2">
            {rows.map((decision) => (
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
