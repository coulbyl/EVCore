"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { playerFetch } from "@/lib/api/player-fetch";
import { LINK, PRIMARY, QUIET } from "@/components/scoreboard/ui/form-looks";
import { AuthField } from "../../components/auth-field";

/** « Renvoyer le code (dans 30 s) » (11 § 4). */
const RESEND_AFTER_S = 30;

export type VerifyLabels = {
  code: string;
  submit: string;
  later: string;
  resend: string;
  /** « (dans {seconds} s) », the number written in by the form. */
  resendIn: string;
  changeEmail: string;
  sendFailed: string;
  wrongCode: string;
};

/**
 * « Vérifie ton e-mail » (11 § 4, maquette Verification) : le code part à
 * l'ouverture, six chiffres (saisis seuls quand le téléphone lit l'e-mail),
 * « Renvoyer le code » après 30 s, « Changer d'e-mail » dans Compte, et
 * « Plus tard » mène à Aujourd'hui : on ne bloque pas le premier geste.
 */
export function VerifyEmailForm({ labels }: { labels: VerifyLabels }) {
  const [wait, setWait] = useState(RESEND_AFTER_S);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sent = useRef(false);

  async function send() {
    setError(null);
    setWait(RESEND_AFTER_S);
    try {
      await playerFetch("/auth/send-verification", { method: "POST" });
    } catch {
      // Not sent: « Renvoyer » is the way to retry, open at once.
      setWait(0);
      setError(labels.sendFailed);
    }
  }

  useEffect(() => {
    // Once, strict mode's second mount aside: one e-mail per opening.
    if (sent.current) return;
    sent.current = true;
    void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the first send only
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "")
      .replace(/\D/g, "")
      .slice(0, 6);
    setError(null);
    setBusy(true);
    try {
      await playerFetch("/auth/verify-email", {
        method: "POST",
        body: { code },
      });
      window.location.assign("/today");
    } catch {
      setError(labels.wrongCode);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-4">
      <AuthField
        label={labels.code}
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
        error={error ?? undefined}
      />
      <p className="flex flex-wrap items-center gap-x-2 text-body text-muted-foreground">
        <button
          type="button"
          onClick={() => void send()}
          disabled={wait > 0}
          className={`${LINK} disabled:text-muted-foreground disabled:no-underline`}
        >
          {labels.resend}
          {wait > 0
            ? ` ${labels.resendIn.replace("{seconds}", String(wait))}`
            : null}
        </button>
        <span aria-hidden>·</span>
        <Link href="/me/account" className={LINK}>
          {labels.changeEmail}
        </Link>
      </p>
      <button type="submit" disabled={busy} className={PRIMARY}>
        {labels.submit}
      </button>
      <Link
        href="/today"
        className={`${QUIET} inline-flex items-center justify-center`}
      >
        {labels.later}
      </Link>
    </form>
  );
}
