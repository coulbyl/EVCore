"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ShieldCheck } from "lucide-react";
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
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Choisissez votre méthode de vérification :
      </p>

      <button
        type="button"
        onClick={() => setChoice("email")}
        className="group flex items-start gap-4 rounded-xl border border-border bg-panel px-4 py-4 text-left transition-colors hover:border-accent/40 hover:bg-accent/5"
      >
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent/15">
          <Mail size={15} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            Vérification par email
          </p>
          <p className="mt-0.5 text-[0.8rem] leading-5 text-muted-foreground">
            Recevez un code à 6 chiffres sur votre adresse email.
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => setChoice("totp")}
        className="group flex items-start gap-4 rounded-xl border border-border bg-panel px-4 py-4 text-left transition-colors hover:border-accent/40 hover:bg-accent/5"
      >
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent/15">
          <ShieldCheck size={15} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            Application d&apos;authentification
          </p>
          <p className="mt-0.5 text-[0.8rem] leading-5 text-muted-foreground">
            Scannez un QR code avec Google Authenticator, Authy, etc.
          </p>
        </div>
      </button>

      <div className="border-t border-border pt-2">
        <Link
          href="/auth/login"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Me connecter avec un autre compte
        </Link>
      </div>
    </div>
  );
}
