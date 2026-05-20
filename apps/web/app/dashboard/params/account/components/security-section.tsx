"use client";

import { useState } from "react";
import { CheckCircle, Mail, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@evcore/ui";
import { SettingsSectionCard } from "./settings-section-card";
import { useCurrentUser } from "@/domains/auth/context/current-user-context";
import { sendVerificationEmail } from "@/domains/auth/use-cases/verify-email";
import Link from "next/link";

export function SecuritySection() {
  const user = useCurrentUser();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isVerified = user.emailVerified || user.totpVerified;

  async function handleResendVerification() {
    setSending(true);
    setError(null);
    try {
      await sendVerificationEmail();
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible d'envoyer le code.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <SettingsSectionCard
      eyebrow="Sécurité"
      title="Authentification & vérification"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
          {isVerified ? (
            <CheckCircle className="mt-0.5 size-4 shrink-0 text-green-500" />
          ) : (
            <ShieldOff className="mt-0.5 size-4 shrink-0 text-destructive" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {isVerified ? "Compte vérifié" : "Compte non vérifié"}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {user.mfaMethod === "TOTP"
                ? "Application d'authentification (TOTP) configurée."
                : user.emailVerified
                  ? `Email vérifié — ${user.email}`
                  : "Votre compte n'est pas encore vérifié. Certaines fonctionnalités sont inaccessibles."}
            </p>
          </div>
          {!isVerified ? (
            <Button size="sm" variant="outline" asChild>
              <Link href="/auth/verify">Vérifier →</Link>
            </Button>
          ) : null}
        </div>

        {user.mfaMethod !== "TOTP" && (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                Application d&apos;authentification
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Non configurée. Ajoutez une app TOTP pour sécuriser davantage
                votre compte et récupérer l&apos;accès sans email.
              </p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href="/auth/verify">Configurer →</Link>
            </Button>
          </div>
        )}

        {user.emailVerified && user.mfaMethod !== "TOTP" && (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
            <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                Code de vérification
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Renvoyer un code à {user.email}.
              </p>
              {sent ? (
                <p className="mt-1 text-xs text-green-600">
                  Code envoyé — vérifiez vos spams.
                </p>
              ) : error ? (
                <p className="mt-1 text-xs text-destructive">{error}</p>
              ) : null}
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={sending || sent}
              onClick={handleResendVerification}
            >
              {sending ? "Envoi…" : sent ? "Envoyé" : "Renvoyer"}
            </Button>
          </div>
        )}
      </div>
    </SettingsSectionCard>
  );
}
