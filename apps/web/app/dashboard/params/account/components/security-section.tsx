"use client";

import { useState } from "react";
import { CheckCircle, Mail, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@evcore/ui";
import { useTranslations } from "next-intl";
import { SettingsSectionCard } from "./settings-section-card";
import { useCurrentUser } from "@/domains/auth/context/current-user-context";
import { sendVerificationEmail } from "@/domains/auth/use-cases/verify-email";
import Link from "next/link";

export function SecuritySection() {
  const t = useTranslations("account");
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
      setError(err instanceof Error ? err.message : t("codeSendError"));
    } finally {
      setSending(false);
    }
  }

  return (
    <SettingsSectionCard eyebrow={t("tabSecurity")} title={t("securityTitle")}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
          {isVerified ? (
            <CheckCircle className="mt-0.5 size-4 shrink-0 text-green-500" />
          ) : (
            <ShieldOff className="mt-0.5 size-4 shrink-0 text-destructive" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {isVerified ? t("accountVerified") : t("accountNotVerified")}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {user.mfaMethod === "TOTP"
                ? t("totpConfigured")
                : user.emailVerified
                  ? t("emailVerifiedMessage", { email: user.email })
                  : t("notVerifiedMessage")}
            </p>
          </div>
          {!isVerified ? (
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/params/account/securite/verification">
                {t("verifyAction")}
              </Link>
            </Button>
          ) : null}
        </div>

        {user.mfaMethod !== "TOTP" && (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {t("totpTitle")}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("totpDescription")}
              </p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/params/account/securite/verification">
                {t("configureAction")}
              </Link>
            </Button>
          </div>
        )}

        {user.emailVerified && user.mfaMethod !== "TOTP" && (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
            <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {t("verificationCodeTitle")}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("resendCodeDescription", { email: user.email })}
              </p>
              {sent ? (
                <p className="mt-1 text-xs text-green-600">
                  {t("codeSentMessage")}
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
              {sending ? t("sending") : sent ? t("sent") : t("resend")}
            </Button>
          </div>
        )}
      </div>
    </SettingsSectionCard>
  );
}
