import { Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type WeightAdjustmentProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { palette } from "../components/palette";

const styles = {
  headingApply: {
    color: palette.status.success,
    fontSize: "20px",
    margin: "0 0 14px",
  },
  headingRollback: {
    color: palette.status.rollback,
    fontSize: "20px",
    margin: "0 0 14px",
  },
  badgeApply: {
    backgroundColor: palette.badge.success.bg,
    border: `1px solid ${palette.badge.success.border}`,
    borderRadius: "4px",
    color: palette.badge.success.text,
    display: "inline-block",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1px",
    margin: "0 0 16px",
    padding: "3px 8px",
  },
  badgeRollback: {
    backgroundColor: palette.badge.warning.bg,
    border: `1px solid ${palette.badge.warning.border}`,
    borderRadius: "4px",
    color: palette.badge.warning.text,
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
  metric: {
    color: palette.text.secondary,
    fontSize: "13px",
    margin: "0 0 6px",
  },
} as const;

export function WeightAdjustmentEmail({
  proposalId,
  isRollback,
  brierScore,
  meanError,
  rolledBackProposalId,
}: WeightAdjustmentProps) {
  const headingStyle = isRollback
    ? styles.headingRollback
    : styles.headingApply;
  const badgeStyle = isRollback ? styles.badgeRollback : styles.badgeApply;
  const title = isRollback
    ? "Rollback de Poids"
    : "Ajustement de Poids Auto-Appliqué";
  const preview = isRollback
    ? `Rollback — Proposal ${rolledBackProposalId ?? ""} annulé par ${proposalId}`
    : `Poids ajustés — Proposal ${proposalId}`;

  return (
    <EvCoreLayout preview={preview}>
      <Heading style={headingStyle}>{title}</Heading>
      <Text style={badgeStyle}>{isRollback ? "ROLLBACK" : "AUTO-APPLY"}</Text>
      <Section>
        <Text style={styles.label}>PROPOSAL ID</Text>
        <Text style={styles.value}>{proposalId}</Text>

        {isRollback && rolledBackProposalId != null && (
          <>
            <Text style={styles.label}>PROPOSAL ANNULÉ</Text>
            <Text style={styles.value}>{rolledBackProposalId}</Text>
          </>
        )}

        {!isRollback && brierScore != null && (
          <Text style={styles.metric}>
            Brier Score : {brierScore.toFixed(4)}
          </Text>
        )}
        {!isRollback && meanError != null && (
          <Text style={styles.metric}>Mean Error : {meanError.toFixed(4)}</Text>
        )}
      </Section>
    </EvCoreLayout>
  );
}

export const renderWeightAdjustment = (props: WeightAdjustmentProps) =>
  renderEmail(createElement(WeightAdjustmentEmail, props));

export default function WeightAdjustmentEmailPreview() {
  return (
    <WeightAdjustmentEmail
      proposalId="clx1a2b3c4d5e6f7g"
      isRollback={false}
      brierScore={0.2614}
      meanError={0.0312}
    />
  );
}
