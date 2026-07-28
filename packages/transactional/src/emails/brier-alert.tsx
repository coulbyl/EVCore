import { Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type BrierAlertProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { palette } from "../components/palette";
import { headingStyle, label, value } from "../components/shared-styles";

const styles = {
  warn: { color: palette.status.caution, fontSize: "13px", margin: "0" },
} as const;

export function BrierAlertEmail({ seasonId, brierScore }: BrierAlertProps) {
  return (
    <EvCoreLayout
      preview={`Brier Score Alert — Saison ${seasonId}: ${brierScore.toFixed(4)}`}
    >
      <Heading style={headingStyle(palette.status.warning)}>
        Brier Score Alert
      </Heading>
      <Section>
        <Text style={label}>Saison</Text>
        <Text style={value}>{seasonId}</Text>
        <Text style={label}>Brier score</Text>
        <Text style={value}>{brierScore.toFixed(4)}</Text>
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
