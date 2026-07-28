import { Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type MarketSuspensionProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { palette } from "../components/palette";
import {
  badgeStyle,
  headingStyle,
  label,
  value,
} from "../components/shared-styles";

const styles = {
  info: { color: palette.text.secondary, fontSize: "13px", margin: "0" },
} as const;

export function MarketSuspensionEmail({
  market,
  roi,
  betCount,
}: MarketSuspensionProps) {
  const roiPct = (roi * 100).toFixed(2);
  return (
    <EvCoreLayout preview={`Marché suspendu — ${market}: ${roiPct}%`}>
      <Heading style={headingStyle(palette.status.critical)}>
        Marché Suspendu
      </Heading>
      <Text style={badgeStyle("alert")}>Auto-suspension</Text>
      <Section>
        <Text style={label}>Marché</Text>
        <Text style={value}>{market}</Text>
        <Text style={label}>ROI au moment de la suspension</Text>
        <Text style={value}>
          {roiPct}% sur {betCount} paris
        </Text>
        <Text style={styles.info}>
          Seuil de suspension : −15%. Le marché ne génère plus de ModelRun
          jusqu&apos;à réactivation manuelle.
        </Text>
      </Section>
    </EvCoreLayout>
  );
}

export const renderMarketSuspension = (props: MarketSuspensionProps) =>
  renderEmail(createElement(MarketSuspensionEmail, props));

export default function MarketSuspensionEmailPreview() {
  return (
    <MarketSuspensionEmail market="ONE_X_TWO" roi={-0.187} betCount={63} />
  );
}
