"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { playerFetch } from "@/lib/api/player-fetch";
import { LINK } from "./account-ui";

/** « Déconnecter les autres » (09 § 5): every device but this one. */
export function SignOutOthers({
  labels,
}: {
  labels: { action: string; done: string; failed: string };
}) {
  const router = useRouter();
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      const result = await playerFetch<{ signedOut: number }>(
        "/auth/sessions/sign-out-others",
        { method: "POST" },
      );
      setSaid(labels.done.replace("{count}", String(result?.signedOut ?? 0)));
      router.refresh();
    } catch {
      setSaid(labels.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex flex-col items-end">
      <button type="button" onClick={signOut} disabled={busy} className={LINK}>
        {labels.action}
      </button>
      {said ? (
        <span role="status" className="text-meta text-muted-foreground">
          {said}
        </span>
      ) : null}
    </span>
  );
}
