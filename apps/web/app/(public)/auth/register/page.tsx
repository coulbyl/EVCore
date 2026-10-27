import type { Metadata } from "next";
import { AuthShell } from "../components/auth-shell";
import { RegisterForm } from "../components/register-form";

export const metadata: Metadata = {
  title: "Créer un compte — EVCore",
  alternates: { canonical: "/auth/register" },
};

export default function RegisterPage() {
  return (
    <AuthShell
      title="Créer un compte"
      subtitle="Gratuit, réservé aux 18+. Deux minutes pour lire tes premiers matchs."
      asideTitle="Avant de parier, lis le match."
      asideText="Les coupons et sélections du jour, les matchs analysés et ce que chaque canal annonce face à ce qui arrive vraiment."
    >
      <RegisterForm />
    </AuthShell>
  );
}
