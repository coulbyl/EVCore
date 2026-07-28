import { Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type SupportMessageProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { headingStyle, insetBlock, intro } from "../components/shared-styles";

export function SupportMessageEmail({
  recipientKind,
  fromUsername,
  preview,
}: SupportMessageProps) {
  const heading =
    recipientKind === "ADMIN"
      ? `Nouveau message de ${fromUsername}`
      : "Nouvelle réponse de l'équipe EVCore";
  const introText =
    recipientKind === "ADMIN"
      ? `${fromUsername} a envoyé un message dans le support EVCore.`
      : "L'équipe EVCore vous a répondu. Ouvrez l'application pour continuer la conversation.";

  return (
    <EvCoreLayout preview={heading}>
      <Heading style={headingStyle()}>{heading}</Heading>
      <Section>
        <Text style={intro}>{introText}</Text>
        <Text style={insetBlock}>{preview}</Text>
      </Section>
    </EvCoreLayout>
  );
}

export const renderSupportMessage = (props: SupportMessageProps) =>
  renderEmail(createElement(SupportMessageEmail, props));

export default function SupportMessagePreview() {
  return (
    <SupportMessageEmail
      recipientKind="ADMIN"
      fromUsername="fannan"
      preview="Bonjour, je suis intéressé par le palier Business, comment ça marche ?"
    />
  );
}
