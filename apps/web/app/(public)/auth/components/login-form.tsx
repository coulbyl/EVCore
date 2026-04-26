"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input } from "@evcore/ui";
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
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      {error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">
          Email ou username
        </span>
        <Input
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="h-11 rounded-lg border-border bg-background text-sm text-foreground"
          placeholder="amine ou amine@evcore.app"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">
          Mot de passe
        </span>
        <Input
          required
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 rounded-lg border-border bg-background text-sm text-foreground"
          placeholder="••••••••"
        />
      </label>

      <Button
        type="submit"
        className="h-11 w-full justify-center rounded-lg"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Connexion..." : "Se connecter"}
      </Button>

      <p className="text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <Link href="/auth/register" className="font-medium text-accent">
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
