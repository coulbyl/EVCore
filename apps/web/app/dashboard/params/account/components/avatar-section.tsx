"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@evcore/ui";
import { clientApiRequest } from "@/lib/api/client-api";
import { UserAvatar } from "@/components/user-avatar";
import { useMyBadges } from "@/domains/gamification/use-cases/get-my-badges";
import { AVATAR_OPTIONS, FREE_AVATARS, LOCKED_AVATARS } from "@/lib/avatars";
import {
  useCurrentUser,
  useSetCurrentUser,
} from "@/domains/auth/context/current-user-context";
import { SettingsSectionCard } from "./settings-section-card";

const BADGE_NAME: Record<string, string> = {
  vol_50: "50 paris réglés",
  vol_150: "150 paris réglés",
  streak_5: "Série × 5",
  calibre: "Brier Score < 0.20",
};

export function AvatarSection({
  currentAvatarUrl,
  username,
}: {
  currentAvatarUrl: string | null;
  username: string;
}) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const setCurrentUser = useSetCurrentUser();
  const [selected, setSelected] = useState<string | null>(currentAvatarUrl);
  const [saving, setSaving] = useState(false);
  const { data: badges } = useMyBadges();
  const unlockedBadges = new Set(
    (badges ?? []).filter((b) => b.unlockedAt !== null).map((b) => b.code),
  );

  async function handleSelect(avatarUrl: string) {
    if (avatarUrl === selected) return;
    setSelected(avatarUrl);
    setSaving(true);
    try {
      await clientApiRequest("/auth/me", {
        method: "PATCH",
        body: { avatarUrl },
        fallbackErrorMessage: "Impossible de sauvegarder l'avatar.",
      });
      setCurrentUser({ ...currentUser, avatarUrl });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSectionCard
      eyebrow="Compte"
      title="Avatar"
      description="Choisissez votre personnage. Certains sont débloqués via les badges."
    >
      <div className="mb-4 flex justify-center">
        <UserAvatar avatarUrl={selected} username={username} size={72} />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Disponibles
        </p>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
          {FREE_AVATARS.map((avatar) => (
            <AvatarChip
              key={avatar.url}
              avatar={avatar}
              isSelected={selected === avatar.url}
              isLocked={false}
              saving={saving}
              onSelect={handleSelect}
            />
          ))}
        </div>

        <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Verrouillés
        </p>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {LOCKED_AVATARS.map((avatar) => {
            const isLocked = avatar.requiredBadge
              ? !unlockedBadges.has(avatar.requiredBadge)
              : false;

            const chip = (
              <AvatarChip
                key={avatar.url}
                avatar={avatar}
                isSelected={selected === avatar.url}
                isLocked={isLocked}
                saving={saving}
                onSelect={handleSelect}
              />
            );

            if (isLocked && avatar.requiredBadge) {
              return (
                <Tooltip key={avatar.url}>
                  <TooltipTrigger asChild>{chip}</TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Requiert :{" "}
                    {BADGE_NAME[avatar.requiredBadge] ?? avatar.requiredBadge}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return chip;
          })}
        </div>
      </div>
    </SettingsSectionCard>
  );
}

function AvatarChip({
  avatar,
  isSelected,
  isLocked,
  saving,
  onSelect,
}: {
  avatar: (typeof AVATAR_OPTIONS)[number];
  isSelected: boolean;
  isLocked: boolean;
  saving: boolean;
  onSelect: (url: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={isLocked || saving}
      onClick={() => onSelect(avatar.url)}
      className={`relative flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-colors ${
        isSelected
          ? "border-accent bg-accent/10"
          : isLocked
            ? "cursor-not-allowed border-border bg-panel opacity-50 grayscale"
            : "border-border bg-panel hover:border-accent/50"
      }`}
    >
      <UserAvatar avatarUrl={avatar.url} username={avatar.label} size={40} />
      <span className="text-center text-[0.62rem] font-medium leading-tight text-muted-foreground">
        {avatar.label}
      </span>
      {isLocked && (
        <span className="absolute right-1 top-1 text-[0.6rem]">🔒</span>
      )}
    </button>
  );
}
