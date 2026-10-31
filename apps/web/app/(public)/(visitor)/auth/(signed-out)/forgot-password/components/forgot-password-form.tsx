"use client";

import Link from "next/link";
import { useState } from "react";
import { playerFetch } from "@/lib/api/player-fetch";
import { LINK, PRIMARY } from "@/components/scoreboard/ui/form-looks";
import { AuthField } from "../../../components/auth-field";

export type ForgotLabels = {
  email: string;
  submit: string;
  /** « On a envoyé un lien à {email} » once sent; the address written in. */
  sent: string;
  sentNote: string;
  resend: string;
  withApp: string;
  noAccess: string;
  writeTeam: string;
  failed: string;
};

/**
 * Le mot de passe oublié, premier et deuxième écrans (11 § 5) : l'e-mail,
 * puis « regarde tes e-mails ». Le troisième est le nouveau mot de passe,
 * ouvert par le lien reçu. Le serveur répond pareil qu'un compte existe ou
 * non : l'écran aussi. Sans accès à l'e-mail : le code de l'application
 * d'authentification, ou un e-mail à l'équipe (Messages demande d'être
 * connecté).
 */
export function ForgotPasswordForm({
  labels,
  supportEmail,
}: {
  labels: ForgotLabels;
  supportEmail: string;
}) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** The address typed, or the one already sent to for « Renvoyer ». */
  async function send(email: string) {
    setError(null);
    setBusy(true);
    try {
      await playerFetch("/auth/forgot-password", {
        method: "POST",
        body: { identifier: email },
      });
      setSentTo(email);
    } catch {
      setError(labels.failed);
    } finally {
      setBusy(false);
    }
  }

  const help = (
    <div className="flex flex-col gap-1 border-t border-border pt-3 text-body text-muted-foreground">
      <Link href="/auth/forgot-password/totp" className={LINK}>
        {labels.withApp}
      </Link>
      <p>
        {labels.noAccess}{" "}
        <a href={`mailto:${supportEmail}`} className={LINK}>
          {labels.writeTeam}
        </a>
      </p>
    </div>
  );

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="text-body">
          {labels.sent.replace("{email}", sentTo)}
        </p>
        <p className="text-body text-muted-foreground">{labels.sentNote}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void send(sentTo)}
          className={`${LINK} self-start`}
        >
          {labels.resend}
        </button>
        {error ? (
          <p role="alert" className="text-meta font-medium">
            {error}
          </p>
        ) : null}
        {help}
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void send(String(data.get("email") ?? "").trim());
      }}
      className="flex flex-col gap-4"
    >
      <AuthField
        label={labels.email}
        name="email"
        enterKeyHint="go"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        error={error ?? undefined}
      />
      <button type="submit" disabled={busy} className={PRIMARY}>
        {labels.submit}
      </button>
      {help}
    </form>
  );
}
