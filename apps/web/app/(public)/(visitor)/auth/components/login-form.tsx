"use client";

import Link from "next/link";
import { useState } from "react";
import { PlayerFetchError, playerFetch } from "@/lib/api/player-fetch";
import { applyLocaleFromSession } from "@/domains/auth/use-cases/apply-locale";
import { safeNextPath } from "@/domains/auth/helpers/safe-next-path";
import { homePathFor } from "@/domains/auth/routing/auth-routing";
import type { AuthSession } from "@/domains/auth/types/auth";
import { PRIMARY, QUIET } from "@/components/scoreboard/ui/form-looks";
import { AuthField } from "./auth-field";

export type LoginLabels = {
  email: string;
  password: string;
  show: string;
  hide: string;
  submit: string;
  submitting: string;
  forgot: string;
  register: string;
  reset: string;
  code: string;
  codeHint: string;
  codeSubmit: string;
  codeBack: string;
  errors: {
    wrong: string;
    locked: string;
    failed: string;
    code: string;
  };
};

type LoginAnswer =
  | { session: AuthSession }
  | { totpRequired: true; challenge: string };

/**
 * « Se connecter » (11 § 3, maquette Connexion) : l'e-mail (un ancien nom
 * d'utilisateur passe aussi, sans le dire), le mot de passe et « afficher ».
 * L'erreur en une ligne sous le bouton, les champs gardés. Avec une
 * application d'authentification, un écran de plus : six chiffres.
 */
export function LoginForm({
  labels,
  resetDone,
}: {
  labels: LoginLabels;
  /** Back from a new password (11 § 5): said once, above the fields. */
  resetDone: boolean;
}) {
  const [shown, setShown] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function signedIn(session: AuthSession | undefined) {
    if (session) applyLocaleFromSession(session);
    // L'écran demandé avant la connexion (proxy.ts), s'il est interne.
    const next = safeNextPath(
      new URLSearchParams(window.location.search).get("next"),
    );
    window.location.assign(
      next ?? homePathFor(session?.user.role ?? "OPERATOR"),
    );
  }

  function failure(caught: unknown, wrong: string) {
    const status = caught instanceof PlayerFetchError ? caught.status : 0;
    setError(
      status === 401 || status === 400
        ? wrong
        : status === 429
          ? labels.errors.locked
          : labels.errors.failed,
    );
    setBusy(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    setBusy(true);
    try {
      const answer = await playerFetch<LoginAnswer>("/auth/login", {
        method: "POST",
        body: {
          identifier: String(data.get("identifier") ?? "").trim(),
          password: String(data.get("password") ?? ""),
        },
      });
      if (answer && "challenge" in answer) {
        setChallenge(answer.challenge);
        setBusy(false);
        return;
      }
      signedIn(answer?.session);
    } catch (caught) {
      failure(caught, labels.errors.wrong);
    }
  }

  async function submitCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const code = digitsOf(new FormData(form).get("code"));
    setError(null);
    setBusy(true);
    try {
      const answer = await playerFetch<{ session: AuthSession }>(
        "/auth/login/totp",
        { method: "POST", body: { challenge, code } },
      );
      signedIn(answer?.session);
    } catch (caught) {
      form.reset();
      failure(caught, labels.errors.code);
    }
  }

  if (challenge) {
    return (
      <form onSubmit={submitCode} className="flex flex-col gap-4">
        <AuthField
          label={labels.code}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          hint={labels.codeHint}
        />
        <button type="submit" disabled={busy} className={PRIMARY}>
          {labels.codeSubmit}
        </button>
        {error ? (
          <p role="alert" className="text-meta font-medium">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setChallenge(null);
            setError(null);
          }}
          className={QUIET}
        >
          {labels.codeBack}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {resetDone ? (
        <p role="status" className="text-body font-medium">
          {labels.reset}
        </p>
      ) : null}
      <AuthField
        label={labels.email}
        name="identifier"
        type="text"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        required
      />
      <AuthField
        label={labels.password}
        name="password"
        type={shown ? "text" : "password"}
        autoComplete="current-password"
        required
        aside={
          <button
            type="button"
            onClick={() => setShown((value) => !value)}
            aria-pressed={shown}
            className={QUIET}
          >
            {shown ? labels.hide : labels.show}
          </button>
        }
      />
      <button type="submit" disabled={busy} className={PRIMARY}>
        {busy ? labels.submitting : labels.submit}
      </button>
      {error ? (
        <p role="alert" className="text-meta font-medium">
          {error}
        </p>
      ) : null}
      <p className="flex flex-wrap justify-center gap-x-2 text-body text-muted-foreground">
        <Link
          href="/auth/forgot-password"
          className="underline-offset-4 hover:underline"
        >
          {labels.forgot}
        </Link>
        <span aria-hidden>·</span>
        <Link
          href="/auth/register"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {labels.register}
        </Link>
      </p>
    </form>
  );
}

/** The six digits of a code, whatever spaces the player typed. */
function digitsOf(value: FormDataEntryValue | null): string {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 6);
}
