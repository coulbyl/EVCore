import { Button, Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type PasswordResetProps } from "../types";
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
    margin: "0 0 20px",
  },
  buttonContainer: {
    margin: "0 0 20px",
    textAlign: "center" as const,
  },
  button: {
    backgroundColor: palette.brand,
    borderRadius: "6px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "14px",
    fontWeight: "600",
    padding: "12px 24px",
    textDecoration: "none",
  },
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
  expiry: {
    color: palette.text.subtle,
    fontSize: "12px",
    margin: "16px 0 0",
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
      <Heading style={styles.heading}>Réinitialisation du mot de passe</Heading>
      <Section>
        <Text style={styles.intro}>
          Bonjour {username},{" "}
          {isAdminGenerated
            ? "un administrateur a généré ce lien de réinitialisation pour vous."
            : "vous avez demandé à réinitialiser votre mot de passe EVCore."}{" "}
          Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
        </Text>
        <Section style={styles.buttonContainer}>
          <Button href={resetUrl} style={styles.button}>
            Réinitialiser mon mot de passe
          </Button>
        </Section>
        <Text style={styles.fallback}>
          Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
        </Text>
        <Text style={styles.link}>{resetUrl}</Text>
        <Text style={styles.expiry}>
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
