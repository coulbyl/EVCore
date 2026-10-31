"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { playerFetch } from "@/lib/api/player-fetch";
import { useOnline } from "@/components/scoreboard/states/use-online";

/**
 * « Suivre » (04 § 3) : un toucher, pas de confirmation. Suivi, le bouton
 * s'allège en « Suivi ✓ » ; un second toucher retire le suivi. Le serveur
 * refuse après le premier coup d'envoi : l'écran rechargé n'a alors plus de
 * bouton. Hors ligne, il est grisé (10 § 2). Textes reçus du serveur (C0 :
 * pas de next-intl côté client).
 */
export function FollowButton({
  couponId,
  followed,
  labels,
  followedMark,
}: {
  couponId: string;
  followed: boolean;
  labels: { follow: string; followed: string; error: string };
  /** « ✓ », rendered on the server: lucide stays out of the client bundle. */
  followedMark: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const online = useOnline();

  function toggle() {
    setFailed(false);
    startTransition(async () => {
      try {
        await playerFetch(`/coupons/${couponId}/follow`, {
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
        disabled={pending || !online}
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
            {followedMark}
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
