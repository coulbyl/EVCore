import { Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type BrierAlertProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { palette } from "../components/palette";

const styles = {
  heading: {
    color: palette.status.warning,
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
  warn: { color: palette.status.caution, fontSize: "13px", margin: "0" },
} as const;

export function BrierAlertEmail({ seasonId, brierScore }: BrierAlertProps) {
  return (
    <EvCoreLayout
      preview={`Brier Score Alert — Saison ${seasonId}: ${brierScore.toFixed(4)}`}
    >
      <Heading style={styles.heading}>Brier Score Alert</Heading>
      <Section>
        <Text style={styles.label}>SAISON</Text>
        <Text style={styles.value}>{seasonId}</Text>
        <Text style={styles.label}>BRIER SCORE</Text>
        <Text style={styles.value}>{brierScore.toFixed(4)}</Text>
        <Text style={styles.warn}>
          Seuil d&apos;alerte : 0.25. Une calibration automatique peut être
          déclenchée si les conditions sont réunies (≥ 50 paris, délai de 7
          jours respecté).
        </Text>
      </Section>
    </EvCoreLayout>
  );
}

export const renderBrierAlert = (props: BrierAlertProps) =>
  renderEmail(createElement(BrierAlertEmail, props));

export default function BrierAlertEmailPreview() {
  return <BrierAlertEmail seasonId="2024-2025" brierScore={0.2731} />;
}
