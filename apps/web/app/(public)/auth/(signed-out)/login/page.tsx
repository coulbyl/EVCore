import type { Metadata } from "next";
import { AuthShell } from "../../components/auth-shell";
import { LoginForm } from "../../components/login-form";

export const metadata: Metadata = {
  title: "Connexion — EVCore",
  alternates: { canonical: "/auth/login" },
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Connexion"
      subtitle="Retrouve tes coupons du jour, tes matchs et ton suivi de mise."
      asideTitle="Tes coupons du jour, hier réglé, et où tu en es."
      asideText="Les sélections du moteur, les matchs analysés et ton résultat à mise fixe, sans détour."
    >
      <LoginForm />
    </AuthShell>
  );
}
