"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { playerFetch } from "@/lib/api/player-fetch";
import { FIELD, PRIMARY } from "@/components/scoreboard/ui/form-looks";

type Setup = { qrDataUrl: string; secret: string };

/**
 * « Double authentification » turned on (09 § 5, in place since B11): the
 * QR code and the key from the server, then the 6-digit code. Once on, the
 * sign-in asks for it.
 */
export function TwoFactorSetup({
  labels,
}: {
  labels: {
    start: string;
    scan: string;
    key: string;
    code: string;
    confirm: string;
    failed: string;
  };
}) {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");

  async function start() {
    setState("busy");
    try {
      setSetup(
        (await playerFetch<Setup>("/auth/setup-totp", {
          method: "POST",
        })) ?? null,
      );
      setState("idle");
    } catch {
      setState("failed");
    }
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    setState("busy");
    try {
      await playerFetch("/auth/confirm-totp", {
        method: "POST",
        body: { code: code.trim() },
      });
      setSetup(null);
      setState("idle");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  if (!setup) {
    return (
      <div className="flex flex-col gap-1 pb-2">
        <button
          type="button"
          onClick={start}
          disabled={state === "busy"}
          className={PRIMARY}
        >
          {labels.start}
        </button>
        {state === "failed" ? (
          <p role="alert" className="text-meta">
            {labels.failed}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <form onSubmit={confirm} className="flex flex-col gap-2 pb-2">
      <p className="text-meta text-muted-foreground">{labels.scan}</p>
      {/* A data URL made by the server: nothing for next/image to do. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={setup.qrDataUrl}
        alt=""
        width={180}
        height={180}
        className="self-start rounded-md bg-white p-2"
      />
      <p className="text-meta">
        {labels.key} : <span className="score break-all">{setup.secret}</span>
      </p>
      <label className="flex flex-col gap-1 text-meta text-muted-foreground">
        {labels.code}
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className={FIELD}
        />
      </label>
      <button type="submit" disabled={state === "busy"} className={PRIMARY}>
        {labels.confirm}
      </button>
      {state === "failed" ? (
        <p role="alert" className="text-meta">
          {labels.failed}
        </p>
      ) : null}
    </form>
  );
}
