import { Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type MlModelActivatedProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { palette } from "../components/palette";

const styles = {
  headingActivate: {
    color: palette.status.success,
    fontSize: "20px",
    margin: "0 0 14px",
  },
  headingRollback: {
    color: palette.status.rollback,
    fontSize: "20px",
    margin: "0 0 14px",
  },
  badgeActivate: {
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
  const headingStyle = isRollback ? styles.headingRollback : styles.headingActivate;
  const badgeStyle = isRollback ? styles.badgeRollback : styles.badgeActivate;
  const title = isRollback ? "ML Model — Rollback" : "ML Model — Auto-Activé";
  const preview = isRollback
    ? `Rollback ML ${segment} — version ${rolledBackVersionId ?? ""} annulée`
    : `Nouveau modèle ML activé — ${segment} (${algorithm})`;

  return (
    <EvCoreLayout preview={preview}>
      <Heading style={headingStyle}>{title}</Heading>
      <Text style={badgeStyle}>{isRollback ? "ROLLBACK" : "AUTO-SWITCH"}</Text>
      <Section>
        <Text style={styles.label}>VERSION ID</Text>
        <Text style={styles.value}>{versionId}</Text>

        <Text style={styles.label}>SEGMENT</Text>
        <Text style={styles.value}>{segment}</Text>

        <Text style={styles.label}>ALGORITHME</Text>
        <Text style={styles.value}>{algorithm}</Text>

        {isRollback && rolledBackVersionId != null && (
          <>
            <Text style={styles.label}>VERSION ANNULÉE</Text>
            <Text style={styles.value}>{rolledBackVersionId}</Text>
          </>
        )}

        {!isRollback && (
          <>
            <Text style={styles.metric}>Brier Score : {brierScore.toFixed(4)}</Text>
            <Text style={styles.metric}>Calibration Error : {calibrationError.toFixed(4)}</Text>
            <Text style={styles.metric}>ROI simulé : {(roiSimulated * 100).toFixed(2)}%</Text>
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
