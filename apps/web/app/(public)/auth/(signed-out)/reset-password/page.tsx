import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "../../components/auth-shell";
import { ResetPasswordForm } from "./components/reset-password-form";

export const metadata: Metadata = {
  title: "Nouveau mot de passe — EVCore",
  robots: { index: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Nouveau mot de passe"
      subtitle="Choisis un mot de passe d'au moins 8 caractères. Une phrase longue protège mieux qu'un mot compliqué."
      asideTitle="Réinitialise ton accès."
      asideText="Ce lien est valable 15 minutes. Une fois ton nouveau mot de passe défini, toutes tes sessions ouvertes sont déconnectées."
    >
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
