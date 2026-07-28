import { Button, Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type PasswordResetProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { palette } from "../components/palette";
import {
  button,
  buttonSection,
  headingStyle,
  hint,
  intro,
} from "../components/shared-styles";

const styles = {
  fallback: {
    color: palette.text.subtle,
    fontSize: "12px",
    lineHeight: "18px",
    margin: "0 0 4px",
  },
  link: {
    color: palette.text.subtle,
    fontSize: "11px",
    wordBreak: "break-all" as const,
    margin: 0,
  },
} as const;

export function PasswordResetEmail({
  username,
  resetUrl,
  expiresInMinutes,
  isAdminGenerated,
}: PasswordResetProps) {
  return (
    <EvCoreLayout preview="Réinitialisation de votre mot de passe EVCore">
      <Heading style={headingStyle()}>Réinitialisation du mot de passe</Heading>
      <Section>
        <Text style={intro}>
          Bonjour {username},{" "}
          {isAdminGenerated
            ? "un administrateur a généré ce lien de réinitialisation pour vous."
            : "vous avez demandé à réinitialiser votre mot de passe EVCore."}{" "}
          Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
        </Text>
        <Section style={buttonSection}>
          <Button href={resetUrl} style={button}>
            Réinitialiser mon mot de passe
          </Button>
        </Section>
        <Text style={styles.fallback}>
          Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
        </Text>
        <Text style={styles.link}>{resetUrl}</Text>
        <Text style={hint}>
          Ce lien expire dans {expiresInMinutes} minutes.
        </Text>
      </Section>
    </EvCoreLayout>
  );
}

export const renderPasswordReset = (props: PasswordResetProps) =>
  renderEmail(createElement(PasswordResetEmail, props));

export default function PasswordResetPreview() {
  return (
    <PasswordResetEmail
      username="fannan"
      resetUrl="https://evcore.app/auth/reset-password?token=abc123"
      expiresInMinutes={15}
      isAdminGenerated={false}
    />
  );
}
