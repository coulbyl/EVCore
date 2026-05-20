"use client";

import { useState } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import { Button } from "@evcore/ui";
import { EmailVerifyFlow } from "./email-verify-flow";
import { TotpSetupFlow } from "./totp-setup-flow";

type Choice = "email" | "totp" | null;

export function VerifyChoiceForm() {
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

      <Button
        variant="ghost"
        size="sm"
        className="mt-1 text-xs text-muted-foreground"
        asChild
      >
        <a href="/auth/login">Me connecter avec un autre compte</a>
      </Button>
    </div>
  );
}
