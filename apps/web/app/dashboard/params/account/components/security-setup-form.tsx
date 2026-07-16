"use client";

import { useState } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import { EmailVerifyFlow } from "@/app/(public)/auth/verify/components/email-verify-flow";
import { TotpSetupFlow } from "@/app/(public)/auth/verify/components/totp-setup-flow";

type Choice = "email" | "totp" | null;

export function SecuritySetupForm() {
  const [choice, setChoice] = useState<Choice>(null);

  if (choice === "email")
    return <EmailVerifyFlow onBack={() => setChoice(null)} />;
  if (choice === "totp")
    return <TotpSetupFlow onBack={() => setChoice(null)} />;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Choisissez votre méthode de vérification :
      </p>

      <button
        type="button"
        onClick={() => setChoice("email")}
        className="flex items-start gap-3 rounded-xl border border-border bg-background p-4 text-left hover:border-accent/50 hover:bg-accent/5 transition-colors"
      >
        <Mail className="mt-0.5 size-5 shrink-0 text-accent" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            Vérification par email
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Recevez un code à 6 chiffres sur votre adresse email.
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => setChoice("totp")}
        className="flex items-start gap-3 rounded-xl border border-border bg-background p-4 text-left hover:border-accent/50 hover:bg-accent/5 transition-colors"
      >
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            Application d&apos;authentification
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Scannez un QR code avec Google Authenticator, Authy, etc.
          </p>
        </div>
      </button>
    </div>
  );
}
