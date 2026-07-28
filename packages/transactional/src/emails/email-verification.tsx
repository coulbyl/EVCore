import { Heading, Section, Text } from "@react-email/components";
import { createElement } from "react";
import { renderEmail } from "../render";
import { type EmailVerificationProps } from "../types";
import { EvCoreLayout } from "../components/evcore-layout";
import { palette } from "../components/palette";
import { headingStyle, hint, insetBlock, intro } from "../components/shared-styles";

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

export function EmailVerificationEmail({
  username,
  code,
  expiresInMinutes,
}: EmailVerificationProps) {
  return (
    <EvCoreLayout preview={`Code de vérification EVCore — ${code}`}>
      <Heading style={headingStyle()}>Vérification de votre email</Heading>
      <Section>
        <Text style={intro}>
          Bonjour {username}, utilisez le code ci-dessous pour vérifier votre
          adresse email et activer votre compte EVCore.
        </Text>
        <Text style={styles.code}>{code}</Text>
        <Text style={hint}>
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
