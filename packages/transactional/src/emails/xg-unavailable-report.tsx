import { Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type XgUnavailableReportProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { palette } from "../components/palette";
import { headingStyle, insetBlock, label, note, value } from "../components/shared-styles";

export function XgUnavailableReportEmail({
  season,
  unavailableCount,
  externalIds,
}: XgUnavailableReportProps) {
  return (
    <EvCoreLayout
      preview={`Stats Sync — ${unavailableCount} fixtures sans xG (${season})`}
    >
      <Heading style={headingStyle(palette.status.warning)}>
        xG Unavailable — Rapport de contrôle
      </Heading>
      <Section>
        <Text style={label}>Saison</Text>
        <Text style={value}>{season}</Text>
        <Text style={label}>Fixtures marquées xgUnavailable</Text>
        <Text style={value}>{unavailableCount}</Text>
        <Text style={note}>
          Ces fixtures n&apos;ont retourné aucune statistique depuis
          API-Football. Vérifier qu&apos;il s&apos;agit bien de matchs annulés,
          AWD ou sans données historiques. Si une fixture valide apparaît dans
          la liste, réinitialiser manuellement son flag.
        </Text>
        <Text style={label}>External IDs</Text>
        <Text style={insetBlock}>{externalIds.join("\n")}</Text>
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
