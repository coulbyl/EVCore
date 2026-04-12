"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@evcore/ui";
import { register } from "@/domains/auth/use-cases/register";

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await register({
        email,
        username,
        fullName,
        password,
        bio: bio.trim() ? bio : undefined,
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de créer le compte.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          Email
        </span>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-accent"
          placeholder="amine@evcore.app"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          Username
        </span>
        <input
          required
          minLength={3}
          maxLength={32}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-accent"
          placeholder="amine"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          Nom complet
        </span>
        <input
          required
          minLength={2}
          maxLength={80}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-accent"
          placeholder="Amine Diallo"
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
          placeholder="8 caractères minimum"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          Bio
        </span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={280}
          rows={3}
          className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-accent"
          placeholder="Optionnel"
        />
      </label>

      <Button
        type="submit"
        className="h-11 w-full justify-center rounded-lg"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Création..." : "Créer un compte"}
      </Button>

      <p className="text-sm text-slate-500">
        Déjà inscrit ?{" "}
        <Link href="/auth/login" className="font-medium text-accent">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
