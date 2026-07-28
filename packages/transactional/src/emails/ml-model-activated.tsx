import { Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type MlModelActivatedProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { palette } from "../components/palette";
import {
  badgeStyle,
  headingStyle,
  label,
  metric,
  value,
} from "../components/shared-styles";

export function MlModelActivatedEmail({
  versionId,
  segment,
  algorithm,
  brierScore,
  calibrationError,
  roiSimulated,
  isRollback,
  rolledBackVersionId,
}: MlModelActivatedProps) {
  const headingColor = isRollback
    ? palette.status.rollback
    : palette.status.success;
  const title = isRollback ? "ML Model — Rollback" : "ML Model — Auto-Activé";
  const preview = isRollback
    ? `Rollback ML ${segment} — version ${rolledBackVersionId ?? ""} annulée`
    : `Nouveau modèle ML activé — ${segment} (${algorithm})`;

  return (
    <EvCoreLayout preview={preview}>
      <Heading style={headingStyle(headingColor)}>{title}</Heading>
      <Text style={badgeStyle(isRollback ? "warning" : "success")}>
        {isRollback ? "Rollback" : "Auto-switch"}
      </Text>
      <Section>
        <Text style={label}>Version ID</Text>
        <Text style={value}>{versionId}</Text>

        <Text style={label}>Segment</Text>
        <Text style={value}>{segment}</Text>

        <Text style={label}>Algorithme</Text>
        <Text style={value}>{algorithm}</Text>

        {isRollback && rolledBackVersionId != null && (
          <>
            <Text style={label}>Version annulée</Text>
            <Text style={value}>{rolledBackVersionId}</Text>
          </>
        )}

        {!isRollback && (
          <>
            <Text style={metric}>Brier Score : {brierScore.toFixed(4)}</Text>
            <Text style={metric}>
              Calibration Error : {calibrationError.toFixed(4)}
            </Text>
            <Text style={metric}>
              ROI simulé : {(roiSimulated * 100).toFixed(2)}%
            </Text>
          </>
        )}
      </Section>
    </EvCoreLayout>
  );
}

export const renderMlModelActivated = (props: MlModelActivatedProps) =>
  renderEmail(createElement(MlModelActivatedEmail, props));

export default function MlModelActivatedEmailPreview() {
  return (
    <MlModelActivatedEmail
      versionId="1087eb88-510f-48d8-91c6-9147bc234403"
      segment="CONF:ONE_X_TWO"
      algorithm="xgboost"
      brierScore={0.2201}
      calibrationError={0.0418}
      roiSimulated={0.0842}
      isRollback={false}
    />
  );
}
