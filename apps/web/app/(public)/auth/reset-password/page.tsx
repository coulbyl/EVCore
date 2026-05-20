import { Suspense } from "react";
import { AuthShell } from "../components/auth-shell";
import { ResetPasswordForm } from "./components/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Nouveau mot de passe"
      subtitle="Choisissez un mot de passe solide d'au moins 8 caractères."
      asideTitle="Réinitialisez votre accès."
      asideText="Ce lien est valable 15 minutes. Après avoir défini votre nouveau mot de passe, toutes vos sessions actives seront déconnectées."
    >
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
