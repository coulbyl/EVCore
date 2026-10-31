import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthScreen } from "../../components/auth-screen";
import { RegisterForm } from "../../components/register-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("playerAuth");
  return {
    title: `${t("register.title")} — EVCore`,
    alternates: { canonical: "/auth/register" },
  };
}

/** « Créer mon compte » (11 § 2, maquette Inscription). */
export default async function RegisterPage() {
  const t = await getTranslations("playerAuth");
  return (
    <AuthScreen
      title={t("register.title")}
      back={{ href: "/", label: t("back") }}
    >
      <RegisterForm
        labels={{
          firstName: t("fields.firstName"),
          email: t("fields.email"),
          password: t("fields.password"),
          passwordHint: t("register.passwordHint"),
          age: t("register.age"),
          termsBefore: t("register.termsBefore"),
          termsLink: t("register.termsLink"),
          submit: t("register.title"),
          submitting: t("register.submitting"),
          haveAccount: t("register.haveAccount"),
          signIn: t("signIn"),
          errors: {
            firstName: t("errors.firstName"),
            email: t("errors.email"),
            password: t("errors.password"),
            tick: t("errors.tick"),
            taken: t("errors.taken"),
            failed: t("errors.registerFailed"),
          },
        }}
      />
    </AuthScreen>
  );
}
