"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { playerFetch } from "@/lib/api/player-fetch";
import {
  FIELD,
  LINK,
  PRIMARY,
  QUIET,
} from "@/components/scoreboard/ui/form-looks";

/**
 * The e-mail (09 § 5): changed with the password, then a code sent to the
 * new address (`/auth/me/email/request`, `/confirm`, since 2026-10-28).
 */
export function EmailChange({
  email,
  verifiedText,
  labels,
}: {
  email: string;
  verifiedText: string;
  labels: {
    edit: string;
    newEmail: string;
    password: string;
    sendCode: string;
    code: string;
    confirm: string;
    cancel: string;
    failed: string;
  };
}) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "request" | "confirm">("idle");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setFailed(false);
    try {
      await action();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (step === "idle") {
    return (
      <div className="flex min-h-12 items-center justify-between gap-3">
        <p className="flex min-w-0 flex-col">
          <span className="truncate text-body font-medium">{email}</span>
          <span className="text-meta text-muted-foreground">
            {verifiedText}
          </span>
        </p>
        <button
          type="button"
          onClick={() => setStep("request")}
          aria-label={`${labels.edit} : e-mail`}
          className={LINK}
        >
          {labels.edit}
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 py-1"
      onSubmit={(event) => {
        event.preventDefault();
        if (step === "request") {
          void run(async () => {
            await playerFetch("/auth/me/email/request", {
              method: "POST",
              body: { newEmail: newEmail.trim(), password },
            });
            setStep("confirm");
          });
        } else {
          void run(async () => {
            await playerFetch("/auth/me/email/confirm", {
              method: "POST",
              body: { code: code.trim() },
            });
            setStep("idle");
            router.refresh();
          });
        }
      }}
    >
      {step === "request" ? (
        <>
          <label className="flex flex-col gap-1 text-meta text-muted-foreground">
            {labels.newEmail}
            <input
              type="email"
              required
              autoComplete="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1 text-meta text-muted-foreground">
            {labels.password}
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={FIELD}
            />
          </label>
        </>
      ) : (
        <label className="flex flex-col gap-1 text-meta text-muted-foreground">
          {labels.code}
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className={FIELD}
          />
        </label>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={PRIMARY}>
          {step === "request" ? labels.sendCode : labels.confirm}
        </button>
        <button type="button" onClick={() => setStep("idle")} className={QUIET}>
          {labels.cancel}
        </button>
      </div>
      {failed ? (
        <p role="alert" className="text-meta">
          {labels.failed}
        </p>
      ) : null}
    </form>
  );
}
