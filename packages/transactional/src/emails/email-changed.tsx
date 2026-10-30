import { Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type EmailChangedProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { headingStyle, hint, intro } from "../components/shared-styles";

/**
 * Envoyé à l'ANCIENNE adresse une fois le changement confirmé : si ce n'est
 * pas le joueur, il l'apprend là où il lit encore ses messages.
 */
export function EmailChangedEmail({ firstName, newEmail }: EmailChangedProps) {
  return (
    <EvCoreLayout preview="L'adresse de ton compte EVCore a changé">
      <Heading style={headingStyle()}>Ton adresse e-mail a changé</Heading>
      <Section>
        <Text style={intro}>
          Bonjour {firstName}, ton compte EVCore utilise désormais l&apos;adresse{" "}
          {newEmail}. Les prochains messages partiront vers elle.
        </Text>
        <Text style={hint}>
          Si ce n&apos;est pas toi, écris-nous tout de suite en répondant à ce
          message.
        </Text>
      </Section>
    </EvCoreLayout>
  );
}

export const renderEmailChanged = (props: EmailChangedProps) =>
  renderEmail(createElement(EmailChangedEmail, props));

export default function EmailChangedPreview() {
  return <EmailChangedEmail firstName="Fannan" newEmail="f***@exemple.com" />;
}
