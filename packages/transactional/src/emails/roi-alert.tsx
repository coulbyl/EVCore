import { Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type RoiAlertProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { palette } from "../components/palette";
import { headingStyle, label, value } from "../components/shared-styles";

const styles = {
  hint: { color: palette.status.caution, fontSize: "13px", margin: "0" },
} as const;

export function RoiAlertEmail({ market, roi, betCount }: RoiAlertProps) {
  const roiPct = (roi * 100).toFixed(2);
  return (
    <EvCoreLayout preview={`ROI Alert — ${market}: ${roiPct}%`}>
      <Heading style={headingStyle(palette.status.alert)}>ROI Alert</Heading>
      <Section>
        <Text style={label}>Marché</Text>
        <Text style={value}>{market}</Text>
        <Text style={label}>ROI actuel</Text>
        <Text style={value}>
          {roiPct}% sur {betCount} paris
        </Text>
        <Text style={styles.hint}>
          Seuil d&apos;alerte : −10%. Surveillance renforcée.
        </Text>
      </Section>
    </EvCoreLayout>
  );
}

export const renderRoiAlert = (props: RoiAlertProps) =>
  renderEmail(createElement(RoiAlertEmail, props));

// Preview data for the React Email dev server
export default function RoiAlertEmailPreview() {
  return <RoiAlertEmail market="ONE_X_TWO" roi={-0.142} betCount={55} />;
}
