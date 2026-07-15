import { Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type SupportMessageProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { palette } from "../components/palette";

const styles = {
  heading: {
    color: palette.text.primary,
    fontSize: "20px",
    margin: "0 0 12px",
  },
  intro: {
    color: palette.text.secondary,
    fontSize: "14px",
    lineHeight: "22px",
    margin: "0 0 16px",
  },
  preview: {
    backgroundColor: palette.bg.surface,
    borderRadius: "6px",
    color: palette.text.primary,
    fontSize: "14px",
    lineHeight: "20px",
    margin: 0,
    padding: "12px 16px",
    whiteSpace: "pre-wrap" as const,
  },
} as const;

export function SupportMessageEmail({
  recipientKind,
  fromUsername,
  preview,
}: SupportMessageProps) {
  const heading =
    recipientKind === "ADMIN"
      ? `Nouveau message de ${fromUsername}`
      : "Nouvelle réponse de l'équipe EVCore";
  const intro =
    recipientKind === "ADMIN"
      ? `${fromUsername} a envoyé un message dans le support EVCore.`
      : "L'équipe EVCore vous a répondu. Ouvrez l'application pour continuer la conversation.";

  return (
    <EvCoreLayout preview={heading}>
      <Heading style={styles.heading}>{heading}</Heading>
      <Section>
        <Text style={styles.intro}>{intro}</Text>
        <Text style={styles.preview}>{preview}</Text>
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
