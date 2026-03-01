import { Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type EtlFailureProps } from "../types";
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
  errorBox: {
    backgroundColor: palette.bg.code,
    border: `1px solid ${palette.badge.alert.border}`,
    borderRadius: "4px",
    color: palette.badge.alert.text,
    fontSize: "12px",
    lineHeight: "18px",
    margin: "0",
    padding: "10px 12px",
    wordBreak: "break-all" as const,
  },
} as const;

export function EtlFailureEmail({
  queue,
  jobName,
  errorMessage,
}: EtlFailureProps) {
  return (
    <EvCoreLayout preview={`ETL Failure — ${queue} / ${jobName}`}>
      <Heading style={styles.heading}>ETL Failure</Heading>
      <Section>
        <Text style={styles.label}>QUEUE</Text>
        <Text style={styles.value}>{queue}</Text>
        <Text style={styles.label}>JOB</Text>
        <Text style={styles.value}>{jobName}</Text>
        <Text style={styles.label}>ERREUR</Text>
        <Text style={styles.errorBox}>{errorMessage}</Text>
      </Section>
    </EvCoreLayout>
  );
}

export const renderEtlFailure = (props: EtlFailureProps) =>
  renderEmail(createElement(EtlFailureEmail, props));

export default function EtlFailureEmailPreview() {
  return (
    <EtlFailureEmail
      queue="fixtures"
      jobName="fetch-fixtures-ligue1"
      errorMessage="Error: connect ECONNREFUSED 127.0.0.1:6379 — Redis connection failed after 3 attempts"
    />
  );
}
