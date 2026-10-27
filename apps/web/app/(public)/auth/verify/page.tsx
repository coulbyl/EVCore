import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";
import { isAccountVerified } from "@/domains/auth/types/auth";
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

  if (isAccountVerified(session.user)) {
    redirect("/dashboard");
  }

  return (
    <AuthShell
      title="Sécurise ton compte"
      subtitle="Choisis comment vérifier ton identité. C'est la dernière étape avant ton tableau de bord."
      asideTitle="Un compte protégé, c'est un compte récupérable."
      asideText="En vérifiant ton e-mail ou en connectant une application d'authentification, tu t'assures de toujours pouvoir récupérer l'accès à ton compte."
    >
      <VerifyChoiceForm />
    </AuthShell>
  );
}
