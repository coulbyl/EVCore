"use client";

import Link from "next/link";
import { useState } from "react";
import { PlayerFetchError, playerFetch } from "@/lib/api/player-fetch";
import { applyLocaleFromSession } from "@/domains/auth/use-cases/apply-locale";
import type { AuthSession } from "@/domains/auth/types/auth";
import { PRIMARY } from "@/components/scoreboard/ui/form-looks";
import { AuthCheck, AuthField } from "./auth-field";

export type RegisterLabels = {
  firstName: string;
  email: string;
  password: string;
  passwordHint: string;
  age: string;
  termsBefore: string;
  termsLink: string;
  submit: string;
  submitting: string;
  haveAccount: string;
  signIn: string;
  errors: {
    firstName: string;
    email: string;
    password: string;
    tick: string;
    taken: string;
    failed: string;
  };
};

type Errors = Partial<
  Record<"firstName" | "email" | "password" | "age" | "terms" | "form", string>
>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * « Créer mon compte » (11 § 2, maquette Inscription) : prénom, e-mail, mot
 * de passe, les deux cases jamais pré-cochées. Chaque erreur sous son
 * champ ; un e-mail déjà inscrit propose de se connecter. Ensuite la
 * vérification de l'e-mail, qu'on peut passer.
 */
export function RegisterForm({ labels }: { labels: RegisterLabels }) {
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [taken, setTaken] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const firstName = String(data.get("firstName") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const found: Errors = {};
    if (!firstName) found.firstName = labels.errors.firstName;
    if (!EMAIL.test(email)) found.email = labels.errors.email;
    if (password.length < 8) found.password = labels.errors.password;
    if (!data.get("age")) found.age = labels.errors.tick;
    if (!data.get("terms")) found.terms = labels.errors.tick;
    setErrors(found);
    setTaken(false);
    const first = Object.keys(found)[0];
    if (first) {
      form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const answer = await playerFetch<{ session: AuthSession }>(
        "/auth/register",
        {
          method: "POST",
          body: {
            firstName,
            email,
            password,
            confirmAge: true,
            acceptTerms: true,
          },
        },
      );
      if (answer) applyLocaleFromSession(answer.session);
      window.location.assign("/auth/verify");
    } catch (error) {
      const status = error instanceof PlayerFetchError ? error.status : 0;
      if (status === 409) {
        setTaken(true);
      } else if (status === 400) {
        // The first name and the password are checked here as the server
        // does: what it still refuses is the address (IsEmail).
        setErrors({ email: labels.errors.email });
      } else {
        setErrors({ form: labels.errors.failed });
      }
      setBusy(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <AuthField
        label={labels.firstName}
        name="firstName"
        autoComplete="given-name"
        maxLength={50}
        error={errors.firstName}
      />
      <AuthField
        label={labels.email}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        error={
          taken ? (
            <>
              {labels.errors.taken} ·{" "}
              <Link href="/auth/login" className="underline underline-offset-4">
                {labels.signIn}
              </Link>
            </>
          ) : (
            errors.email
          )
        }
      />
      <AuthField
        label={labels.password}
        name="password"
        type="password"
        autoComplete="new-password"
        maxLength={128}
        hint={labels.passwordHint}
        error={errors.password}
      />
      <div className="flex flex-col gap-1 border-t border-border pt-3">
        <AuthCheck name="age" error={errors.age}>
          {labels.age}
        </AuthCheck>
        <AuthCheck name="terms" error={errors.terms}>
          {labels.termsBefore}{" "}
          <Link
            href="/cgu"
            target="_blank"
            className="underline underline-offset-4"
          >
            {labels.termsLink}
          </Link>
        </AuthCheck>
      </div>
      <button type="submit" disabled={busy} className={PRIMARY}>
        {busy ? labels.submitting : labels.submit}
      </button>
      {errors.form ? (
        <p role="alert" className="text-meta font-medium">
          {errors.form}
        </p>
      ) : null}
      <p className="text-center text-body text-muted-foreground">
        {labels.haveAccount}{" "}
        <Link
          href="/auth/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {labels.signIn}
        </Link>
      </p>
    </form>
  );
}
