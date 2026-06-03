import { AuthShell } from "../components/auth-shell";
import { RegisterForm } from "../components/register-form";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Créer un compte"
      subtitle="Créez votre accès pour exploiter les sélections du moteur."
      asideTitle="Commencez à investir avec méthode."
      asideText="Accédez aux sélections quotidiennes du moteur, aux matchs analysés et aux indices de performance par canal."
    >
      <RegisterForm />
    </AuthShell>
  );
}
