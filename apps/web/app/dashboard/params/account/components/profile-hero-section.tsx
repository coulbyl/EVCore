"use client";

import { useEffect, useState } from "react";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@evcore/ui";
import { Mail, AtSign, ShieldCheck, FingerprintPattern } from "lucide-react";
import { clientApiRequest } from "@/lib/api/client-api";
import { UserAvatar } from "@/components/user-avatar";
import { useMyBadges } from "@/domains/gamification/use-cases/get-my-badges";
import { FREE_AVATARS, LOCKED_AVATARS } from "@/lib/avatars";
import {
  useCurrentUser,
  useSetCurrentUser,
} from "@/domains/auth/context/current-user-context";

const BADGE_NAME: Record<string, string> = {
  vol_50: "50 paris réglés",
  vol_150: "150 paris réglés",
  streak_5: "Série × 5",
  calibre: "Brier Score < 0.20",
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  OPERATOR: "Opérateur",
};

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon size={13} className="shrink-0 text-muted-foreground" />
      <span className="w-20 shrink-0 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className="truncate text-sm text-foreground">{value}</span>
    </div>
  );
}

export function ProfileHeroSection() {
  const currentUser = useCurrentUser();
  const setCurrentUser = useSetCurrentUser();
  const [selected, setSelected] = useState<string | null>(
    currentUser.avatarUrl,
  );
  const [saving, setSaving] = useState(false);
  const { data: badges } = useMyBadges();
  const unlockedBadges = new Set(
    (badges ?? []).filter((b) => b.unlockedAt !== null).map((b) => b.code),
  );

  useEffect(() => {
    setSelected(currentUser.avatarUrl);
  }, [currentUser.avatarUrl]);

  async function handleSelect(avatarUrl: string) {
    if (avatarUrl === selected || saving) return;
    setSelected(avatarUrl);
    setSaving(true);
    try {
      await clientApiRequest("/auth/me", {
        method: "PATCH",
        body: { avatarUrl },
        fallbackErrorMessage: "Impossible de sauvegarder l'avatar.",
      });
      setCurrentUser({ ...currentUser, avatarUrl });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="lg:col-span-2 overflow-hidden rounded-[1.6rem] border border-border bg-panel-strong ev-shell-shadow">
      {/* Accent band */}
      <div className="h-1 w-full bg-gradient-to-r from-accent/30 via-accent/70 to-accent/30" />

      <div className="grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:gap-8 sm:p-7">
        {/* ── Left: avatar + picker ── */}
        <div className="flex flex-col items-center gap-4 sm:items-start">
          <div
            className={`transition-opacity ${saving ? "opacity-60" : "opacity-100"}`}
          >
            <UserAvatar
              avatarUrl={selected}
              username={currentUser.username}
              size={80}
            />
          </div>

          {/* Compact horizontal picker */}
          <div className="flex flex-col gap-2 w-full sm:w-auto">
            <p className="text-center text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-left">
              Avatar
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {FREE_AVATARS.map((avatar) => (
                <button
                  key={avatar.url}
                  type="button"
                  disabled={saving}
                  onClick={() => handleSelect(avatar.url)}
                  className={`shrink-0 rounded-full transition-all ${
                    selected === avatar.url
                      ? "ring-2 ring-accent ring-offset-2 ring-offset-panel-strong"
                      : "opacity-70 hover:opacity-100"
                  }`}
                  title={avatar.label}
                >
                  <UserAvatar
                    avatarUrl={avatar.url}
                    username={avatar.label}
                    size={30}
                  />
                </button>
              ))}

              <div className="mx-1 w-px self-stretch bg-border" />

              {LOCKED_AVATARS.map((avatar) => {
                const isLocked = avatar.requiredBadge
                  ? !unlockedBadges.has(avatar.requiredBadge)
                  : false;

                const btn = (
                  <button
                    key={avatar.url}
                    type="button"
                    disabled={isLocked || saving}
                    onClick={() => !isLocked && handleSelect(avatar.url)}
                    className={`relative shrink-0 rounded-full transition-all ${
                      isLocked
                        ? "cursor-not-allowed grayscale opacity-40"
                        : selected === avatar.url
                          ? "ring-2 ring-accent ring-offset-2 ring-offset-panel-strong"
                          : "opacity-70 hover:opacity-100"
                    }`}
                    title={avatar.label}
                  >
                    <UserAvatar
                      avatarUrl={avatar.url}
                      username={avatar.label}
                      size={30}
                    />
                    {isLocked && (
                      <span className="absolute -right-0.5 -top-0.5 text-[0.5rem] leading-none">
                        🔒
                      </span>
                    )}
                  </button>
                );

                if (isLocked && avatar.requiredBadge) {
                  return (
                    <Tooltip key={avatar.url}>
                      <TooltipTrigger asChild>{btn}</TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        Requiert :{" "}
                        {BADGE_NAME[avatar.requiredBadge] ??
                          avatar.requiredBadge}
                      </TooltipContent>
                    </Tooltip>
                  );
                }
                return btn;
              })}
            </div>
          </div>
        </div>

        {/* ── Right: identity + info ── */}
        <div className="flex flex-col justify-between gap-5">
          {/* Identity */}
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {currentUser.fullName}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                @{currentUser.username}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/12 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-accent">
                <ShieldCheck size={10} />
                {ROLE_LABEL[currentUser.role] ?? currentUser.role}
              </span>
            </div>
          </div>

          {/* Info rows */}
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
            <InfoRow icon={Mail} label="Email" value={currentUser.email} />
            <InfoRow
              icon={AtSign}
              label="Identifiant"
              value={`@${currentUser.username}`}
            />
            {currentUser.bio && (
              <InfoRow
                icon={FingerprintPattern}
                label="Biographie"
                value={currentUser.bio}
              />
            )}
          </div>

          {/* Password */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" disabled>
              Modifier le mot de passe
            </Button>
            <span className="text-xs text-muted-foreground">
              Disponible prochainement
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
