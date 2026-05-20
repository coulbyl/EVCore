import { AuthShell } from "../../components/auth-shell";
import { ForgotPasswordTotpForm } from "./components/forgot-password-totp-form";

export default function ForgotPasswordTotpPage() {
  return (
    <AuthShell
      title="Réinitialiser avec TOTP"
      subtitle="Entrez votre identifiant et le code de votre application d'authentification pour choisir un nouveau mot de passe."
      asideTitle="Récupérez votre compte sans email."
      asideText="Votre application TOTP (Google Authenticator, Authy…) génère un code unique toutes les 30 secondes. Il prouve que vous avez accès à l'appareil configuré."
    >
      <ForgotPasswordTotpForm />
    </AuthShell>
  );
}
