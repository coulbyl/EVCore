import { Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type WeightAdjustmentProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { palette } from "../components/palette";
import { badgeStyle, headingStyle, label, metric, value } from "../components/shared-styles";

export function WeightAdjustmentEmail({
  proposalId,
  isRollback,
  brierScore,
  meanError,
  rolledBackProposalId,
}: WeightAdjustmentProps) {
  const headingColor = isRollback
    ? palette.status.rollback
    : palette.status.success;
  const title = isRollback
    ? "Rollback de Poids"
    : "Ajustement de Poids Auto-Appliqué";
  const preview = isRollback
    ? `Rollback — Proposal ${rolledBackProposalId ?? ""} annulé par ${proposalId}`
    : `Poids ajustés — Proposal ${proposalId}`;

  return (
    <EvCoreLayout preview={preview}>
      <Heading style={headingStyle(headingColor)}>{title}</Heading>
      <Text style={badgeStyle(isRollback ? "warning" : "success")}>
        {isRollback ? "Rollback" : "Auto-apply"}
      </Text>
      <Section>
        <Text style={label}>Proposal ID</Text>
        <Text style={value}>{proposalId}</Text>

        {isRollback && rolledBackProposalId != null && (
          <>
            <Text style={label}>Proposal annulé</Text>
            <Text style={value}>{rolledBackProposalId}</Text>
          </>
        )}

        {!isRollback && brierScore != null && (
          <Text style={metric}>Brier Score : {brierScore.toFixed(4)}</Text>
        )}
        {!isRollback && meanError != null && (
          <Text style={metric}>Mean Error : {meanError.toFixed(4)}</Text>
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
