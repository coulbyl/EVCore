import { Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type RoiAlertProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { palette } from "../components/palette";

const styles = {
  heading: {
    color: palette.status.alert,
    fontSize: "20px",
    margin: "0 0 14px",
  },
  label: {
    color: palette.text.label,
    fontSize: "11px",
    letterSpacing: "1px",
    margin: "0 0 2px",
  },
  value: {
    color: palette.text.primary,
    fontSize: "15px",
    fontWeight: "600",
    margin: "0 0 12px",
  },
  hint: { color: palette.status.caution, fontSize: "13px", margin: "0" },
} as const;

export function RoiAlertEmail({ market, roi, betCount }: RoiAlertProps) {
  const roiPct = (roi * 100).toFixed(2);
  return (
    <EvCoreLayout preview={`ROI Alert — ${market}: ${roiPct}%`}>
      <Heading style={styles.heading}>ROI Alert</Heading>
      <Section>
        <Text style={styles.label}>MARCHÉ</Text>
        <Text style={styles.value}>{market}</Text>
        <Text style={styles.label}>ROI ACTUEL</Text>
        <Text style={styles.value}>
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
