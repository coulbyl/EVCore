import { Button, Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type PlayerDigestProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import {
  button,
  buttonSection,
  headingStyle,
  hint,
  intro,
} from "../components/shared-styles";

/**
 * La matinée et la semaine par e-mail, quand le joueur a choisi « Par e-mail
 * aussi » (refonte 09 § 5) : le même titre et le même texte que la
 * notification (10 § 3), jamais de montant.
 */
export function PlayerDigestEmail({ title, body, url }: PlayerDigestProps) {
  return (
    <EvCoreLayout preview={body}>
      <Heading style={headingStyle()}>{title}</Heading>
      <Section>
        <Text style={intro}>{body}</Text>
      </Section>
      <Section style={buttonSection}>
        <Button href={url} style={button}>
          Ouvrir EVCore
        </Button>
      </Section>
      <Text style={hint}>
        Tu reçois cet e-mail parce que « Par e-mail aussi » est activé dans ton
        compte. Tu peux le couper depuis Compte › Notifications.
      </Text>
    </EvCoreLayout>
  );
}

export const renderPlayerDigest = (props: PlayerDigestProps) =>
  renderEmail(createElement(PlayerDigestEmail, props));

export default function PlayerDigestPreview() {
  return (
    <PlayerDigestEmail
      title="Ta matinée EVCore"
      body="Favori ✓ 1,24 · Combiné ✗. Aujourd'hui : Favori 1,28 · Combiné 1,41 · Cote 2 2,30."
      url="https://evcore.app/today"
    />
  );
}
