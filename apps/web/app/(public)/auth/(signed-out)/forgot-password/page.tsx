import type { Metadata } from "next";
import { AuthShell } from "../../components/auth-shell";
import { ForgotPasswordForm } from "./components/forgot-password-form";

export const metadata: Metadata = {
  title: "Récupérer l'accès — EVCore",
  alternates: { canonical: "/auth/forgot-password" },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Récupérer l'accès"
      subtitle="Indique ton e-mail ou ton nom d'utilisateur. Si un compte correspond, tu recevras un lien de réinitialisation."
      asideTitle="Reprends la main sur ton compte."
      asideText="Si ton e-mail n'est plus valide ou si tu as configuré une application d'authentification, utilise l'option par code d'application pour réinitialiser ton mot de passe."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
