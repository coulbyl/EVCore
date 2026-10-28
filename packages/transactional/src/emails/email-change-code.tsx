import { Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type EmailChangeCodeProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { palette } from "../components/palette";
import {
  headingStyle,
  hint,
  insetBlock,
  intro,
} from "../components/shared-styles";

const styles = {
  code: {
    ...insetBlock,
    color: palette.brand,
    fontSize: "26px",
    fontWeight: "700",
    letterSpacing: "8px",
    margin: "0 0 20px",
    padding: "14px 20px",
    textAlign: "center" as const,
  },
} as const;

/** Envoyé à la NOUVELLE adresse : elle doit prouver qu'elle est à toi. */
export function EmailChangeCodeEmail({
  username,
  code,
  expiresInMinutes,
}: EmailChangeCodeProps) {
  return (
    <EvCoreLayout preview={`Code pour ta nouvelle adresse EVCore — ${code}`}>
      <Heading style={headingStyle()}>Confirme ta nouvelle adresse</Heading>
      <Section>
        <Text style={intro}>
          Bonjour {username}, tu as demandé à utiliser cette adresse pour ton
          compte EVCore. Saisis ce code dans l&apos;application pour confirmer.
        </Text>
        <Text style={styles.code}>{code}</Text>
        <Text style={hint}>
          Ce code est valable {expiresInMinutes} minutes. Si tu n&apos;as rien
          demandé, ignore ce message : ton adresse ne changera pas.
        </Text>
      </Section>
    </EvCoreLayout>
  );
}

export const renderEmailChangeCode = (props: EmailChangeCodeProps) =>
  renderEmail(createElement(EmailChangeCodeEmail, props));

export default function EmailChangeCodePreview() {
  return (
    <EmailChangeCodeEmail
      username="fannan"
      code="847291"
      expiresInMinutes={10}
    />
  );
}
