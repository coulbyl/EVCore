import { AuthShell } from "../components/auth-shell";
import { RegisterForm } from "../components/register-form";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Créer un compte"
      subtitle="Créez votre accès pour préparer et suivre vos coupons."
      asideTitle="Un accès simple pour commencer à travailler sur vos sélections."
      asideText="Créez votre compte, ouvrez votre espace et commencez à construire vos coupons depuis les matchs analysés."
    >
      <RegisterForm />
    </AuthShell>
  );
}
