import { Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type XgUnavailableReportProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { palette } from "../components/palette";

const styles = {
  heading: {
    color: palette.status.warning ?? palette.status.alert,
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
  note: {
    color: palette.text.label,
    fontSize: "13px",
    margin: "0 0 16px",
  },
  idList: {
    backgroundColor: palette.bg.code,
    borderRadius: "4px",
    color: palette.text.primary,
    fontSize: "12px",
    lineHeight: "20px",
    margin: "0",
    padding: "10px 12px",
    whiteSpace: "pre-wrap" as const,
  },
} as const;

export function XgUnavailableReportEmail({
  season,
  unavailableCount,
  externalIds,
}: XgUnavailableReportProps) {
  return (
    <EvCoreLayout
      preview={`Stats Sync — ${unavailableCount} fixtures sans xG (${season})`}
    >
      <Heading style={styles.heading}>
        xG Unavailable — Rapport de contrôle
      </Heading>
      <Section>
        <Text style={styles.label}>SAISON</Text>
        <Text style={styles.value}>{season}</Text>
        <Text style={styles.label}>FIXTURES MARQUÉES xgUnavailable</Text>
        <Text style={styles.value}>{unavailableCount}</Text>
        <Text style={styles.note}>
          Ces fixtures n&apos;ont retourné aucune statistique depuis
          API-Football. Vérifier qu&apos;il s&apos;agit bien de matchs annulés,
          AWD ou sans données historiques. Si une fixture valide apparaît dans
          la liste, réinitialiser manuellement son flag.
        </Text>
        <Text style={styles.label}>EXTERNAL IDS</Text>
        <Text style={styles.idList}>{externalIds.join("\n")}</Text>
      </Section>
    </EvCoreLayout>
  );
}

export const renderXgUnavailableReport = (props: XgUnavailableReportProps) =>
  renderEmail(createElement(XgUnavailableReportEmail, props));

export default function XgUnavailableReportPreview() {
  return (
    <XgUnavailableReportEmail
      season="2022-23"
      unavailableCount={3}
      externalIds={[1208110, 1208222, 1208333]}
    />
  );
}
