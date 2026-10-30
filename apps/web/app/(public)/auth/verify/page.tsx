import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";
import { AuthShell } from "../components/auth-shell";
import { VerifyChoiceForm } from "./components/verify-choice-form";

export const metadata: Metadata = {
  title: "Sécuriser ton compte — EVCore",
  robots: { index: false },
};

export default async function VerifyPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth/login");
  }

  // L'e-mail, et lui seul : une application d'authentification ne vérifie
  // pas l'adresse où partent les e-mails (09 § 7).
  if (session.user.emailVerified) {
    redirect("/dashboard");
  }

  return (
    <AuthShell
      title="Sécurise ton compte"
      subtitle="Vérifie ton e-mail pour recevoir nos e-mails et pouvoir récupérer ton compte. Tu peux le faire plus tard depuis ton compte."
      asideTitle="Un compte protégé, c'est un compte récupérable."
      asideText="En vérifiant ton e-mail ou en connectant une application d'authentification, tu t'assures de toujours pouvoir récupérer l'accès à ton compte."
    >
      <VerifyChoiceForm hasAuthenticator={session.user.totpVerified} />
    </AuthShell>
  );
}
