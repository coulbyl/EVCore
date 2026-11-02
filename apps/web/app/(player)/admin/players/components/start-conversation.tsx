"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { playerFetch } from "@/lib/api/player-fetch";

/**
 * « Lui écrire » on a player who never wrote (12-admin.md § 3): the
 * conversation is opened (or found) server-side, then its thread shows.
 */
export function StartConversation({
  userId,
  labels,
}: {
  userId: string;
  labels: { write: string; failed: string };
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");

  async function start() {
    setState("busy");
    try {
      const conversation = await playerFetch<{ id: string }>(
        "/admin/support/conversations",
        { method: "POST", body: { userId } },
      );
      if (!conversation) throw new Error("no conversation");
      router.push(`/admin/messages/${conversation.id}`);
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => void start()}
        disabled={state === "busy"}
        className="flex min-h-12 items-center border-y border-border text-start text-body font-medium disabled:opacity-50"
      >
        {labels.write} ›
      </button>
      {state === "failed" ? (
        <p role="alert" className="text-meta text-loss">
          {labels.failed}
        </p>
      ) : null}
    </div>
  );
}
