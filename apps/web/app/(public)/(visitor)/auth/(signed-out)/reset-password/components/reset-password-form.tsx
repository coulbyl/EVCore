"use client";

import Link from "next/link";
import { useState } from "react";
import { PlayerFetchError, playerFetch } from "@/lib/api/player-fetch";
import { LINK, PRIMARY } from "@/components/scoreboard/ui/form-looks";
import { AuthField } from "../../../components/auth-field";

export type ResetLabels = {
  password: string;
  hint: string;
  submit: string;
  tooShort: string;
  expired: string;
  askAgain: string;
  failed: string;
};

/**
 * Le troisième écran du mot de passe oublié (11 § 5), ouvert par le lien de
 * l'e-mail : le nouveau mot de passe, puis la connexion, qui le dit. Le
 * serveur ferme toutes les sessions ouvertes.
 */
export function ResetPasswordForm({
  token,
  labels,
}: {
  token: string | null;
  labels: ResetLabels;
}) {
  const [error, setError] = useState<"short" | "expired" | "failed" | null>(
    token ? null : "expired",
  );
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(
      new FormData(event.currentTarget).get("password") ?? "",
    );
    if (password.length < 8) {
      setError("short");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await playerFetch("/auth/reset-password", {
        method: "POST",
        body: { token, newPassword: password },
      });
      window.location.assign("/auth/login?reset=success");
    } catch (caught) {
      setError(
        caught instanceof PlayerFetchError && caught.status === 400
          ? "expired"
          : "failed",
      );
      setBusy(false);
    }
  }

  if (error === "expired") {
    return (
      <div className="flex flex-col gap-3">
        <p role="alert" className="text-body font-medium">
          {labels.expired}
        </p>
        <Link href="/auth/forgot-password" className={`${LINK} self-start`}>
          {labels.askAgain}
        </Link>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <AuthField
        label={labels.password}
        name="password"
        type="password"
        autoComplete="new-password"
        maxLength={128}
        autoFocus
        hint={labels.hint}
        error={error === "short" ? labels.tooShort : undefined}
      />
      <button type="submit" disabled={busy} className={PRIMARY}>
        {labels.submit}
      </button>
      {error === "failed" ? (
        <p role="alert" className="text-meta font-medium">
          {labels.failed}
        </p>
      ) : null}
    </form>
  );
}
