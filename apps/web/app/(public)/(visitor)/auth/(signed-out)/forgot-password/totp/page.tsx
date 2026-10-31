import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthScreen } from "../../../components/auth-screen";
import { ForgotPasswordTotpForm } from "./components/forgot-password-totp-form";

export const metadata: Metadata = {
  title: "Mot de passe oublié — EVCore",
  robots: { index: false },
};

/** Le mot de passe oublié, avec l'application d'authentification (11 § 5). */
export default async function ForgotPasswordTotpPage() {
  const t = await getTranslations("playerAuth");
  return (
    <AuthScreen
      title={t("forgot.title")}
      back={{ href: "/auth/forgot-password", label: t("back") }}
      intro={t("forgot.appIntro")}
    >
      <ForgotPasswordTotpForm
        labels={{
          email: t("fields.email"),
          code: t("forgot.appCode"),
          password: t("reset.password"),
          hint: t("register.passwordHint"),
          submit: t("reset.submit"),
          tooShort: t("errors.password"),
          wrong: t("errors.appWrong"),
          locked: t("errors.locked"),
          failed: t("errors.failed"),
        }}
      />
    </AuthScreen>
  );
}
