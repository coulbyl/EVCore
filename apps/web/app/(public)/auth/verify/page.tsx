import { redirect } from "next/navigation";
import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";
import { isAccountVerified } from "@/domains/auth/types/auth";
import { AuthShell } from "../components/auth-shell";
import { VerifyChoiceForm } from "./components/verify-choice-form";

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
      title="Sécurisez votre compte"
      subtitle="Choisissez comment vérifier votre identité. C'est obligatoire pour accéder au dashboard."
      asideTitle="Un compte protégé, c'est un compte récupérable."
      asideText="En vérifiant votre email ou en connectant une application d'authentification, vous vous assurez de toujours pouvoir récupérer l'accès à votre compte."
    >
      <VerifyChoiceForm />
    </AuthShell>
  );
}
