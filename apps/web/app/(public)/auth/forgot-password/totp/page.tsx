import type { Metadata } from "next";
import { AuthShell } from "../../components/auth-shell";
import { ForgotPasswordTotpForm } from "./components/forgot-password-totp-form";

export const metadata: Metadata = {
  title: "Réinitialiser le mot de passe — EVCore",
  robots: { index: false },
};

export default function ForgotPasswordTotpPage() {
  return (
    <AuthShell
      title="Réinitialiser le mot de passe"
      subtitle="Indique ton identifiant et le code affiché dans ton application d'authentification (Google Authenticator, Authy…)."
      asideTitle="Récupère ton compte sans e-mail."
      asideText="Ton application génère un code unique toutes les 30 secondes. Il prouve que tu as accès à l'appareil configuré à l'inscription."
    >
      <ForgotPasswordTotpForm />
    </AuthShell>
  );
}
