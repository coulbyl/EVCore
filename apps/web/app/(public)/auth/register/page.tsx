import { AuthShell } from "../components/auth-shell";
import { RegisterForm } from "../components/register-form";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Créer un compte"
      subtitle="Créez votre accès opérateur pour préparer et suivre vos slips."
      asideTitle="Un compte opérateur, une session backend, un espace dashboard protégé."
      asideText="Le compte créé ici ouvre une session côté backend dès l'inscription. Vous pouvez ensuite construire vos slips simples depuis les fixtures scorées."
    >
      <RegisterForm />
    </AuthShell>
  );
}
