import { Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type EmailVerificationProps } from "../types";
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
  codeBox: {
    backgroundColor: palette.bg.code,
    border: `1px solid ${palette.border.default}`,
    borderRadius: "6px",
    letterSpacing: "8px",
    color: palette.brand,
    fontSize: "28px",
    fontWeight: "700",
    padding: "14px 20px",
    textAlign: "center" as const,
    margin: "0 0 20px",
  },
  expiry: {
    color: palette.text.subtle,
    fontSize: "12px",
    margin: 0,
  },
} as const;

export function EmailVerificationEmail({
  username,
  code,
  expiresInMinutes,
}: EmailVerificationProps) {
  return (
    <EvCoreLayout preview={`Code de vérification EVCore — ${code}`}>
      <Heading style={styles.heading}>Vérification de votre email</Heading>
      <Section>
        <Text style={styles.intro}>
          Bonjour {username}, utilisez le code ci-dessous pour vérifier votre
          adresse email et activer votre compte EVCore.
        </Text>
        <Text style={styles.codeBox}>{code}</Text>
        <Text style={styles.expiry}>
          Ce code est valable {expiresInMinutes} minutes. Ne le partagez pas.
        </Text>
      </Section>
    </EvCoreLayout>
  );
}

export const renderEmailVerification = (props: EmailVerificationProps) =>
  renderEmail(createElement(EmailVerificationEmail, props));

export default function EmailVerificationPreview() {
  return (
    <EmailVerificationEmail
      username="fannan"
      code="847291"
      expiresInMinutes={10}
    />
  );
}
