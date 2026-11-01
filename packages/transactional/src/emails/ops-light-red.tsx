import { Button, Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type OpsLightRedProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { palette } from "../components/palette";
import {
  headingStyle,
  insetBlock,
  label,
  value,
} from "../components/shared-styles";

const styles = {
  line: {
    ...insetBlock,
    borderColor: palette.badge.alert.border,
    color: palette.badge.alert.text,
    margin: "0 0 8px",
  },
} as const;

/**
 * Sent once when a light of the admin turns red (12-admin.md § 1): which
 * one, since when, its red lines, and the admin home to act.
 */
export function OpsLightRedEmail({
  light,
  since,
  lines,
  url,
}: OpsLightRedProps) {
  return (
    <EvCoreLayout preview={`${light} au rouge`}>
      <Heading style={headingStyle(palette.status.alert)}>
        {light} au rouge
      </Heading>
      <Section>
        <Text style={label}>Depuis</Text>
        <Text style={value}>{since}</Text>
        <Text style={label}>À faire</Text>
        {lines.map((line) => (
          <Text key={line} style={styles.line}>
            {line}
          </Text>
        ))}
        <Button href={url}>Ouvrir l’accueil admin</Button>
      </Section>
    </EvCoreLayout>
  );
}

export const renderOpsLightRed = (props: OpsLightRedProps) =>
  renderEmail(createElement(OpsLightRedEmail, props));

export default function OpsLightRedEmailPreview() {
  return (
    <OpsLightRedEmail
      light="Moteur"
      since="01/11 17:30"
      lines={["Aucun coupon pour demain, 02/11"]}
      url="https://evcore.app/admin"
    />
  );
}
