"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
} from "@evcore/ui";
import {
  confirmEmailChange,
  requestEmailChange,
} from "@/domains/auth/use-cases/change-email";

type Step = "request" | "confirm";

/**
 * Changer d'adresse en deux temps : la nouvelle adresse et le mot de passe,
 * puis le code envoyé à cette nouvelle adresse. L'ancienne est prévenue une
 * fois le changement fait (2026-10-28 ; avant, l'adresse ne se changeait
 * qu'en écrivant à l'équipe).
 */
export function EmailChangeDialog({
  onChanged,
}: {
  onChanged: (email: string) => void;
}) {
  const t = useTranslations("account.emailChange");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("request");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("request");
    setNewEmail("");
    setPassword("");
    setCode("");
    setError(null);
    setPending(false);
  }

  const canRequest = newEmail.includes("@") && password.length >= 8;
  const canConfirm = /^\d{6}$/.test(code);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      if (step === "request") {
        if (!canRequest) return;
        await requestEmailChange({ newEmail: newEmail.trim(), password });
        setPassword("");
        setStep("confirm");
      } else {
        if (!canConfirm) return;
        const { email } = await confirmEmailChange(code);
        onChanged(email);
        setOpen(false);
        reset();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-11 shrink-0 px-3 text-sm"
          data-testid="email-change-trigger"
        >
          {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md bg-panel-strong">
        <form onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription className="text-sm leading-6">
              {step === "request"
                ? t("requestDescription")
                : t("confirmDescription", { email: newEmail.trim() })}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-3">
            {step === "request" ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="email-change-new"
                    className="text-sm font-medium text-foreground"
                  >
                    {t("newEmailLabel")}
                  </label>
                  <Input
                    id="email-change-new"
                    type="email"
                    autoComplete="email"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="email-change-password"
                    className="text-sm font-medium text-foreground"
                  >
                    {t("passwordLabel")}
                  </label>
                  <Input
                    id="email-change-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11"
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="email-change-code"
                  className="text-sm font-medium text-foreground"
                >
                  {t("codeLabel")}
                </label>
                <Input
                  id="email-change-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, ""))
                  }
                  className="h-11 tracking-[0.4em]"
                />
                <button
                  type="button"
                  className="min-h-11 w-fit text-sm font-medium text-accent underline underline-offset-4"
                  onClick={() => {
                    setCode("");
                    setError(null);
                    setStep("request");
                  }}
                >
                  {t("restart")}
                </button>
              </div>
            )}
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter className="mt-5 gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-11"
              onClick={() => setOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              className="h-11 gap-2"
              disabled={
                pending || (step === "request" ? !canRequest : !canConfirm)
              }
            >
              {pending ? <Loader2 size={14} className="animate-spin" /> : null}
              {step === "request" ? t("send") : t("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
