"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EvButton } from "@evcore/ui";
import { login } from "@/domains/auth/use-cases/login";

export function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ identifier, password });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Identifiants invalides.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          Email ou username
        </span>
        <input
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-accent"
          placeholder="amine ou amine@evcore.app"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          Mot de passe
        </span>
        <input
          required
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-accent"
          placeholder="••••••••"
        />
      </label>

      <EvButton
        type="submit"
        className="h-11 w-full justify-center rounded-lg"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Connexion..." : "Se connecter"}
      </EvButton>

      <p className="text-sm text-slate-500">
        Pas encore de compte ?{" "}
        <Link href="/auth/register" className="font-medium text-accent">
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
