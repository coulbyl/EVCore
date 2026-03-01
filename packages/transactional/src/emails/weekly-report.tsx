import { Column, Heading, Row, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type WeeklyReportProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { palette } from "../components/palette";

const styles = {
  heading: { color: palette.status.info, fontSize: "20px", margin: "0 0 6px" },
  period: { color: palette.text.subtle, fontSize: "12px", margin: "0 0 20px" },
  metricLabel: {
    color: palette.text.label,
    fontSize: "11px",
    letterSpacing: "1px",
    margin: "0 0 4px",
  },
  metricValue: {
    color: palette.text.primary,
    fontSize: "22px",
    fontWeight: "700",
    margin: "0",
  },
  positive: {
    color: palette.status.success,
    fontSize: "22px",
    fontWeight: "700",
    margin: "0",
  },
  negative: {
    color: palette.status.alert,
    fontSize: "22px",
    fontWeight: "700",
    margin: "0",
  },
} as const;

export function WeeklyReportEmail({
  roiOneXTwo,
  betsPlaced,
  brierScore,
  periodStart,
  periodEnd,
}: WeeklyReportProps) {
  const roiPct = (roiOneXTwo * 100).toFixed(2);
  const roiStyle = roiOneXTwo >= 0 ? styles.positive : styles.negative;
  const roiSign = roiOneXTwo >= 0 ? "+" : "";

  return (
    <EvCoreLayout
      preview={`Rapport hebdo — ROI ${roiSign}${roiPct}% — ${betsPlaced} paris`}
    >
      <Heading style={styles.heading}>Rapport Hebdomadaire</Heading>
      <Text style={styles.period}>
        {periodStart.slice(0, 10)} → {periodEnd.slice(0, 10)}
      </Text>
      <Section>
        <Row>
          <Column style={{ paddingRight: "16px" }}>
            <Text style={styles.metricLabel}>ROI (1X2)</Text>
            <Text style={roiStyle}>
              {roiSign}
              {roiPct}%
            </Text>
          </Column>
          <Column style={{ paddingRight: "16px" }}>
            <Text style={styles.metricLabel}>PARIS JOUÉS</Text>
            <Text style={styles.metricValue}>{betsPlaced}</Text>
          </Column>
          <Column>
            <Text style={styles.metricLabel}>BRIER SCORE</Text>
            <Text style={styles.metricValue}>{brierScore.toFixed(4)}</Text>
          </Column>
        </Row>
      </Section>
    </EvCoreLayout>
  );
}

export const renderWeeklyReport = (props: WeeklyReportProps) =>
  renderEmail(createElement(WeeklyReportEmail, props));

export default function WeeklyReportEmailPreview() {
  return (
    <WeeklyReportEmail
      roiOneXTwo={0.0412}
      betsPlaced={87}
      brierScore={0.2214}
      periodStart="2025-03-03"
      periodEnd="2025-03-09"
    />
  );
}
