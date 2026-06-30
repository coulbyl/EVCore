"use client";

import {
  TableCard,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@evcore/ui";
import { useTranslations } from "next-intl";
import { ChannelBacktestTab } from "./channel-backtest-tab";
import { ModelCalibrationTab } from "./model-calibration-tab";
import { TuningTab } from "./tuning-tab";

/**
 * The analytical core of the performance page: per-channel backtest, model
 * calibration and offline threshold tuning — all reading the engine's own
 * outputs (`channel_selection` / `model_run.features`). Each tab is run on
 * demand and its last result is cached locally.
 */
export function ChannelAnalysisSection() {
  const t = useTranslations("performancePage");

  return (
    <TableCard title={t("analysis")} subtitle={t("analysisHint")}>
      <div className="p-4 sm:p-5">
        <Tabs defaultValue="channels">
          <TabsList className="mb-5">
            <TabsTrigger value="channels">{t("tabChannels")}</TabsTrigger>
            <TabsTrigger value="tuning">{t("tabTuning")}</TabsTrigger>
            <TabsTrigger value="calibration">{t("tabCalibration")}</TabsTrigger>
          </TabsList>
          <TabsContent value="channels">
            <ChannelBacktestTab />
          </TabsContent>
          <TabsContent value="tuning">
            <TuningTab />
          </TabsContent>
          <TabsContent value="calibration">
            <ModelCalibrationTab />
          </TabsContent>
        </Tabs>
      </div>
    </TableCard>
  );
}
