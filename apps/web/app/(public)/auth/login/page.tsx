import { AuthShell } from "../components/auth-shell";
import { LoginForm } from "../components/login-form";

export default function LoginPage() {
  return (
    <AuthShell
      title="Connexion"
      subtitle="Connectez-vous pour retrouver vos sélections et votre suivi d'investissement."
      asideTitle="Retrouvez vos sélections du jour, vos matchs et vos indices en un coup d'œil."
      asideText="Un accès direct à la sélection du moteur, aux matchs analysés et à vos indices de performance — sans détour."
    >
      <LoginForm />
    </AuthShell>
  );
}
