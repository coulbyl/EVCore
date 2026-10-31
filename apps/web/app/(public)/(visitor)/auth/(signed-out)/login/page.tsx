import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthScreen } from "../../components/auth-screen";
import { LoginForm } from "../../components/login-form";

export const metadata: Metadata = {
  title: "Se connecter — EVCore",
  alternates: { canonical: "/auth/login" },
};

/** « Se connecter » (11 § 3, maquette Connexion). */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const [t, query] = await Promise.all([
    getTranslations("playerAuth"),
    searchParams,
  ]);
  return (
    <AuthScreen title={t("signIn")} back={{ href: "/", label: t("back") }}>
      <LoginForm
        resetDone={query.reset === "success"}
        labels={{
          email: t("fields.email"),
          password: t("fields.password"),
          show: t("login.show"),
          hide: t("login.hide"),
          submit: t("signIn"),
          submitting: t("login.submitting"),
          forgot: t("login.forgot"),
          register: t("login.register"),
          reset: t("login.resetDone"),
          code: t("login.code"),
          codeHint: t("login.codeHint"),
          codeSubmit: t("login.codeSubmit"),
          codeBack: t("login.codeBack"),
          errors: {
            wrong: t("errors.wrong"),
            locked: t("errors.locked"),
            failed: t("errors.failed"),
            code: t("errors.code"),
          },
        }}
      />
    </AuthScreen>
  );
}
