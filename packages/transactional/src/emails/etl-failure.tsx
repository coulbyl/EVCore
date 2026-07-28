import { Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type EtlFailureProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { palette } from "../components/palette";
import {
  headingStyle,
  insetBlock,
  label,
  value,
} from "../components/shared-styles";

const styles = {
  errorBox: {
    ...insetBlock,
    borderColor: palette.badge.alert.border,
    color: palette.badge.alert.text,
  },
} as const;

export function EtlFailureEmail({
  queue,
  jobName,
  errorMessage,
}: EtlFailureProps) {
  return (
    <EvCoreLayout preview={`ETL Failure — ${queue} / ${jobName}`}>
      <Heading style={headingStyle(palette.status.alert)}>ETL Failure</Heading>
      <Section>
        <Text style={label}>Queue</Text>
        <Text style={value}>{queue}</Text>
        <Text style={label}>Job</Text>
        <Text style={value}>{jobName}</Text>
        <Text style={label}>Erreur</Text>
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
