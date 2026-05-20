import { AuthShell } from "../components/auth-shell";
import { VerifyChoiceForm } from "./components/verify-choice-form";

export default function VerifyPage() {
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
