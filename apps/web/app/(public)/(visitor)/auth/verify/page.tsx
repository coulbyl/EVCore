import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { homePathFor } from "@/domains/auth/routing/auth-routing";
import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";
import { AuthScreen } from "../components/auth-screen";
import { VerifyEmailForm } from "./components/verify-email-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("playerAuth");
  return {
    title: `${t("verify.title")} — EVCore`,
    robots: { index: false },
  };
}

/**
 * Juste après l'inscription, ou depuis Compte (11 § 4). L'e-mail seul : la
 * double authentification n'est plus dans ce parcours, elle se propose
 * dans Compte (11 § 6).
 */
export default async function VerifyPage() {
  const [session, t] = await Promise.all([
    getCurrentSession(),
    getTranslations("playerAuth"),
  ]);
  if (!session) redirect("/auth/login");
  if (session.user.emailVerified) redirect(homePathFor(session.user.role));

  return (
    <AuthScreen
      title={t("verify.title")}
      back={{ href: "/today", label: t("back") }}
      intro={t("verify.intro", { email: session.user.email })}
    >
      <VerifyEmailForm
        labels={{
          code: t("verify.code"),
          submit: t("verify.submit"),
          later: t("verify.later"),
          resend: t("verify.resend"),
          resendIn: t.raw("verify.resendIn") as string,
          changeEmail: t("verify.changeEmail"),
          sendFailed: t("verify.sendFailed"),
          wrongCode: t("errors.code"),
        }}
      />
    </AuthScreen>
  );
}
