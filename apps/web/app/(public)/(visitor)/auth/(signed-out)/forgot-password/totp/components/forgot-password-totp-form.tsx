"use client";

import { useState } from "react";
import { PlayerFetchError, playerFetch } from "@/lib/api/player-fetch";
import { PRIMARY } from "@/components/scoreboard/ui/form-looks";
import { AuthField } from "../../../../components/auth-field";

export type TotpResetLabels = {
  email: string;
  code: string;
  password: string;
  hint: string;
  submit: string;
  tooShort: string;
  wrong: string;
  locked: string;
  failed: string;
};

/**
 * Sans accès à l'e-mail, avec l'application d'authentification (11 § 5) :
 * l'e-mail, le code à six chiffres, le nouveau mot de passe. Puis la
 * connexion, qui le dit.
 */
export function ForgotPasswordTotpForm({
  labels,
}: {
  labels: TotpResetLabels;
}) {
  const [error, setError] = useState<string | null>(null);
  const [short, setShort] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const code = String(data.get("code") ?? "")
      .replace(/\D/g, "")
      .slice(0, 6);
    const password = String(data.get("password") ?? "");
    setShort(password.length < 8);
    if (password.length < 8) return;
    setError(null);
    setBusy(true);
    try {
      await playerFetch("/auth/reset-password/totp", {
        method: "POST",
        body: {
          identifier: email,
          totpCode: code,
          newPassword: password,
        },
      });
      window.location.assign("/auth/login?reset=success");
    } catch (caught) {
      const status = caught instanceof PlayerFetchError ? caught.status : 0;
      setError(
        status === 401 || status === 400
          ? labels.wrong
          : status === 429
            ? labels.locked
            : labels.failed,
      );
      form.querySelector<HTMLInputElement>('[name="code"]')?.select();
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <AuthField
        label={labels.email}
        name="email"
        enterKeyHint="next"
        type="text"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        required
      />
      <AuthField
        label={labels.code}
        name="code"
        enterKeyHint="next"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
      />
      <AuthField
        label={labels.password}
        name="password"
        enterKeyHint="go"
        type="password"
        autoComplete="new-password"
        maxLength={128}
        required
        hint={labels.hint}
        error={short ? labels.tooShort : undefined}
      />
      <button type="submit" disabled={busy} className={PRIMARY}>
        {labels.submit}
      </button>
      {error ? (
        <p role="alert" className="text-meta font-medium">
          {error}
        </p>
      ) : null}
    </form>
  );
}
