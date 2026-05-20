import { AuthShell } from "../components/auth-shell";
import { ForgotPasswordForm } from "./components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Récupérer l'accès"
      subtitle="Entrez votre email ou nom d'utilisateur. Si un compte correspond, vous recevrez un lien de réinitialisation."
      asideTitle="Reprenez le contrôle de votre compte."
      asideText="Si votre email n'est pas valide ou si vous avez configuré une application d'authentification, utilisez l'option TOTP pour réinitialiser votre mot de passe."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
