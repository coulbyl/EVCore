import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthScreen } from "../../components/auth-screen";
import { ResetPasswordForm } from "./components/reset-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("playerAuth");
  return {
    title: `${t("reset.title")} — EVCore`,
    robots: { index: false },
  };
}

/** Le nouveau mot de passe, ouvert par le lien de l'e-mail (11 § 5). */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const [t, query] = await Promise.all([
    getTranslations("playerAuth"),
    searchParams,
  ]);
  const token = typeof query.token === "string" ? query.token : null;
  return (
    <AuthScreen
      title={t("reset.title")}
      back={{ href: "/auth/login", label: t("signIn") }}
    >
      <ResetPasswordForm
        token={token}
        labels={{
          password: t("reset.password"),
          hint: t("register.passwordHint"),
          submit: t("reset.submit"),
          tooShort: t("errors.password"),
          expired: t("reset.expired"),
          askAgain: t("reset.askAgain"),
          failed: t("errors.failed"),
        }}
      />
    </AuthScreen>
  );
}
