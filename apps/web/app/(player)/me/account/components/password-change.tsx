"use client";

import { useState } from "react";
import { playerFetch } from "@/lib/api/player-fetch";
import { FIELD, PRIMARY } from "./account-ui";

/**
 * « Mot de passe » (09 § 5): the current one, then the new one. Every
 * session closes, this one too: back to the sign-in page.
 */
export function PasswordChange({
  labels,
}: {
  labels: {
    current: string;
    next: string;
    submit: string;
    note: string;
    failed: string;
  };
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");

  async function change(event: React.FormEvent) {
    event.preventDefault();
    setState("busy");
    try {
      await playerFetch("/auth/me/password", {
        method: "POST",
        body: { currentPassword: current, newPassword: next },
      });
      window.location.assign("/auth/login");
    } catch {
      setState("failed");
    }
  }

  return (
    <form onSubmit={change} className="flex flex-col gap-2 pb-2">
      <label className="flex flex-col gap-1 text-meta text-muted-foreground">
        {labels.current}
        <input
          type="password"
          required
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          className={FIELD}
        />
      </label>
      <label className="flex flex-col gap-1 text-meta text-muted-foreground">
        {labels.next}
        <input
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
          className={FIELD}
        />
      </label>
      <p className="text-meta text-muted-foreground">{labels.note}</p>
      <button type="submit" disabled={state === "busy"} className={PRIMARY}>
        {labels.submit}
      </button>
      {state === "failed" ? (
        <p role="alert" className="text-meta">
          {labels.failed}
        </p>
      ) : null}
    </form>
  );
}
