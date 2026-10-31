"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { AVATAR_CHOICES } from "@evcore/analysis-core";
import { playerFetch } from "@/lib/api/player-fetch";

/**
 * « Avatar » (31/10): every avatar, free, no badge to earn. A tap keeps
 * it on the account and the band shows it at once.
 */
export function AvatarChoice({
  initial,
  label,
}: {
  initial: string | null;
  label: string;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState(initial);

  async function choose(path: string) {
    const previous = chosen;
    setChosen(path);
    try {
      await playerFetch("/auth/me", {
        method: "PATCH",
        body: { avatarUrl: path },
      });
      router.refresh();
    } catch {
      setChosen(previous);
    }
  }

  return (
    <div className="flex flex-col gap-2 py-2">
      <span className="text-meta text-muted-foreground">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-5 gap-2"
      >
        {AVATAR_CHOICES.map((avatar) => {
          const on = avatar.path === chosen;
          return (
            <button
              key={avatar.path}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={avatar.label}
              onClick={() => void choose(avatar.path)}
              className={clsx(
                "aspect-square overflow-hidden rounded-full border-2 bg-muted transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                on ? "border-led-on" : "border-transparent hover:border-border",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- small local SVGs */}
              <img src={avatar.path} alt="" className="size-full" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
