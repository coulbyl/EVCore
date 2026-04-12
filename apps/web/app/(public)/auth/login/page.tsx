import { AuthShell } from "../components/auth-shell";
import { LoginForm } from "../components/login-form";

export default function LoginPage() {
  return (
    <AuthShell
      title="Connexion"
      subtitle="Connectez-vous pour accéder au dashboard EVCore et à vos bet slips."
      asideTitle="Analysez, sélectionnez et gérez vos bets depuis un seul espace."
      asideText="Le web s'appuie sur les sessions backend EVCore. La session est conservée côté serveur via un cookie httpOnly et le dashboard reste protégé par proxy."
    >
      <LoginForm />
    </AuthShell>
  );
}
