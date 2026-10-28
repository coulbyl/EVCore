import { Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type EmailChangeTakenProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { headingStyle, hint, intro } from "../components/shared-styles";

/**
 * Envoyé à une adresse déjà rattachée à un compte quand quelqu'un demande à
 * l'utiliser : l'application répond pareil dans les deux cas, pour qu'on ne
 * puisse pas tester quelles adresses ont un compte (2026-10-29).
 */
export function EmailChangeTakenEmail({ requestedBy }: EmailChangeTakenProps) {
  return (
    <EvCoreLayout preview="Cette adresse a déjà un compte EVCore">
      <Heading style={headingStyle()}>Cette adresse a déjà un compte</Heading>
      <Section>
        <Text style={intro}>
          Le compte {requestedBy} a demandé à utiliser cette adresse, mais elle
          est déjà rattachée à un compte EVCore. Rien n&apos;a changé.
        </Text>
        <Text style={hint}>
          Si c&apos;est toi, connecte-toi avec cette adresse. Sinon, tu peux
          ignorer ce message.
        </Text>
      </Section>
    </EvCoreLayout>
  );
}

export const renderEmailChangeTaken = (props: EmailChangeTakenProps) =>
  renderEmail(createElement(EmailChangeTakenEmail, props));

export default function EmailChangeTakenPreview() {
  return <EmailChangeTakenEmail requestedBy="@fannan" />;
}
