import { AuthShell } from "../components/auth-shell";
import { LoginForm } from "../components/login-form";

export default function LoginPage() {
  return (
    <AuthShell
      title="Connexion"
      subtitle="Connectez-vous pour retrouver votre espace et vos tickets."
      asideTitle="Retrouvez vos matchs, vos sélections et vos tickets au même endroit."
      asideText="Un point d'entrée sobre pour revenir à l'analyse, consulter vos tickets et poursuivre votre journée sans détour."
    >
      <LoginForm />
    </AuthShell>
  );
}
