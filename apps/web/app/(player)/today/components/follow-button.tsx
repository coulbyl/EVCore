"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { clsx } from "clsx";
import { clientApiRequest } from "@/lib/api/client-api";

/**
 * « Suivre » (04 § 3) : un toucher, pas de confirmation. Suivi, le bouton
 * s'allège en « Suivi ✓ » ; un second toucher retire le suivi. Le serveur
 * refuse après le premier coup d'envoi : l'écran rechargé n'a alors plus de
 * bouton. Textes reçus du serveur (C0 : pas de next-intl côté client).
 */
export function FollowButton({
  couponId,
  followed,
  labels,
}: {
  couponId: string;
  followed: boolean;
  labels: { follow: string; followed: string; error: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function toggle() {
    setFailed(false);
    startTransition(async () => {
      try {
        await clientApiRequest(`/coupons/${couponId}/follow`, {
          method: followed ? "DELETE" : "POST",
        });
        router.refresh();
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={followed}
        className={clsx(
          "inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.625rem] px-4 text-bet font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60",
          followed
            ? "border border-border bg-card text-foreground hover:bg-muted"
            : "bg-primary text-primary-foreground hover:bg-primary/90",
        )}
      >
        {followed ? (
          <>
            {labels.followed}
            <Check aria-hidden className="size-4" strokeWidth={2.5} />
          </>
        ) : (
          labels.follow
        )}
      </button>
      {failed ? (
        <p role="alert" className="text-meta text-foreground">
          {labels.error}
        </p>
      ) : null}
    </div>
  );
}
