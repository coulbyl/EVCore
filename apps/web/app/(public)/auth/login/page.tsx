import { AuthShell } from "../components/auth-shell";
import { LoginForm } from "../components/login-form";

export default function LoginPage() {
  return (
    <AuthShell
      title="Connexion"
      subtitle="Connectez-vous pour retrouver votre espace et vos coupons."
      asideTitle="Retrouvez vos matchs, vos sélections et vos coupons au même endroit."
      asideText="Un point d'entrée sobre pour revenir à l'analyse, consulter vos coupons et poursuivre votre journée sans détour."
    >
      <LoginForm />
    </AuthShell>
  );
}
