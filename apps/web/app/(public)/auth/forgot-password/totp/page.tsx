import { AuthShell } from "../../components/auth-shell";
import { ForgotPasswordTotpForm } from "./components/forgot-password-totp-form";

export default function ForgotPasswordTotpPage() {
  return (
    <AuthShell
      title="Réinitialiser le mot de passe"
      subtitle="Entrez votre identifiant et le code affiché dans votre application d'authentification (Google Authenticator, Authy…)."
      asideTitle="Récupérez votre compte sans email."
      asideText="Votre application génère un code unique toutes les 30 secondes. Il prouve que vous avez accès à l'appareil configuré lors de l'inscription."
    >
      <ForgotPasswordTotpForm />
    </AuthShell>
  );
}
