import { Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type MarketSuspensionProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { palette } from "../components/palette";

const { alert: alertBadge } = palette.badge;

const styles = {
  heading: {
    color: palette.status.critical,
    fontSize: "20px",
    margin: "0 0 14px",
  },
  badge: {
    backgroundColor: alertBadge.bg,
    border: `1px solid ${alertBadge.border}`,
    borderRadius: "4px",
    color: alertBadge.text,
    display: "inline-block",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1px",
    margin: "0 0 16px",
    padding: "3px 8px",
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
      <Heading style={styles.heading}>Marché Suspendu</Heading>
      <Text style={styles.badge}>AUTO-SUSPENSION</Text>
      <Section>
        <Text style={styles.label}>MARCHÉ</Text>
        <Text style={styles.value}>{market}</Text>
        <Text style={styles.label}>ROI AU MOMENT DE LA SUSPENSION</Text>
        <Text style={styles.value}>
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
