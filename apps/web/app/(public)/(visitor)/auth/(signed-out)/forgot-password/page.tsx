import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LEGAL_ENTITY } from "../../../../(legal)/legal-entity";
import { AuthScreen } from "../../components/auth-screen";
import { ForgotPasswordForm } from "./components/forgot-password-form";

export const metadata: Metadata = {
  title: "Mot de passe oublié — EVCore",
  alternates: { canonical: "/auth/forgot-password" },
};

/** Le mot de passe oublié, l'e-mail puis le lien envoyé (11 § 5). */
export default async function ForgotPasswordPage() {
  const t = await getTranslations("playerAuth");
  return (
    <AuthScreen
      title={t("forgot.title")}
      back={{ href: "/auth/login", label: t("signIn") }}
      intro={t("forgot.intro")}
    >
      <ForgotPasswordForm
        supportEmail={LEGAL_ENTITY.contactEmail}
        labels={{
          email: t("fields.email"),
          submit: t("forgot.submit"),
          sent: t.raw("forgot.sent") as string,
          sentNote: t("forgot.sentNote"),
          resend: t("forgot.resend"),
          withApp: t("forgot.withApp"),
          noAccess: t("forgot.noAccess"),
          writeTeam: t("forgot.writeTeam"),
          failed: t("errors.failed"),
        }}
      />
    </AuthScreen>
  );
}
