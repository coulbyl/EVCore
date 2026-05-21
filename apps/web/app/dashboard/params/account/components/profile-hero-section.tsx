"use client";

import { useEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@evcore/ui";
import {
  Mail,
  AtSign,
  ShieldCheck,
  FingerprintPattern,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { useMyBadges } from "@/domains/gamification/use-cases/get-my-badges";
import { FREE_AVATARS, LOCKED_AVATARS } from "@/lib/avatars";
import {
  useCurrentUser,
  useSetCurrentUser,
} from "@/domains/auth/context/current-user-context";
import { clientApiRequest } from "@/lib/api/client-api";
import { updateIdentity } from "@/domains/auth/use-cases/update-identity";

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

type EditableField = "email" | "username" | null;

function EditableInfoRow({
  icon: Icon,
  label,
  value,
  editing,
  onStartEdit,
  onSave,
  onCancel,
  saving,
  error,
}: {
  icon: React.ElementType;
  label: string;
  field: EditableField;
  value: string;
  editing: boolean;
  onStartEdit: () => void;
  onSave: (val: string) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, value]);

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") onSave(draft);
    if (e.key === "Escape") onCancel();
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon size={13} className="shrink-0 text-muted-foreground" />
      <span className="w-20 shrink-0 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>

      {editing ? (
        <div className="flex flex-1 items-center gap-1.5 min-w-0">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            disabled={saving}
            className="flex-1 min-w-0 rounded-md border border-border bg-background px-2 py-0.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => onSave(draft)}
            disabled={saving || draft.trim() === ""}
            className="shrink-0 rounded-md p-1 text-accent hover:bg-accent/10 disabled:opacity-40"
            title="Enregistrer"
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted/40"
            title="Annuler"
          >
            <X size={14} />
          </button>
          {error && (
            <span className="text-[0.68rem] text-destructive whitespace-nowrap">
              {error}
            </span>
          )}
        </div>
      ) : (
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <span className="truncate text-sm text-foreground">{value}</span>
          <button
            type="button"
            onClick={onStartEdit}
            className="ml-auto shrink-0 rounded-md p-1 text-muted-foreground opacity-0 hover:opacity-100 group-hover:opacity-60 hover:text-foreground transition-opacity"
            title={`Modifier ${label.toLowerCase()}`}
          >
            <Pencil size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

export function ProfileHeroSection() {
  const currentUser = useCurrentUser();
  const setCurrentUser = useSetCurrentUser();

  const [selected, setSelected] = useState<string | null>(
    currentUser.avatarUrl,
  );
  const [avatarSaving, setAvatarSaving] = useState(false);

  const [editingField, setEditingField] = useState<EditableField>(null);
  const [fieldSaving, setFieldSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const { data: badges } = useMyBadges();
  const unlockedBadges = new Set(
    (badges ?? []).filter((b) => b.unlockedAt !== null).map((b) => b.code),
  );

  useEffect(() => {
    setSelected(currentUser.avatarUrl);
  }, [currentUser.avatarUrl]);

  async function handleSelectAvatar(avatarUrl: string) {
    if (avatarUrl === selected || avatarSaving) return;
    setSelected(avatarUrl);
    setAvatarSaving(true);
    try {
      await clientApiRequest("/auth/me", {
        method: "PATCH",
        body: { avatarUrl },
        fallbackErrorMessage: "Impossible de sauvegarder l'avatar.",
      });
      setCurrentUser({ ...currentUser, avatarUrl });
    } finally {
      setAvatarSaving(false);
    }
  }

  async function handleSaveField(field: "email" | "username", value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setFieldSaving(true);
    setFieldError(null);
    try {
      const updated = await updateIdentity({ [field]: trimmed });
      setCurrentUser({ ...currentUser, ...updated });
      setEditingField(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Une erreur est survenue.";
      setFieldError(msg);
    } finally {
      setFieldSaving(false);
    }
  }

  function startEdit(field: EditableField) {
    setFieldError(null);
    setEditingField(field);
  }

  function cancelEdit() {
    setFieldError(null);
    setEditingField(null);
  }

  return (
    <section className="lg:col-span-2 overflow-hidden rounded-[1.6rem] border border-border bg-panel-strong ev-shell-shadow">
      {/* Accent band */}
      <div className="h-1 w-full bg-gradient-to-r from-accent/30 via-accent/70 to-accent/30" />

      <div className="grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:gap-8 sm:p-7">
        {/* ── Left: avatar + picker ── */}
        <div className="flex flex-col items-center gap-4 sm:items-start">
          <div
            className={`transition-opacity ${avatarSaving ? "opacity-60" : "opacity-100"}`}
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
                  disabled={avatarSaving}
                  onClick={() => handleSelectAvatar(avatar.url)}
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
                    disabled={isLocked || avatarSaving}
                    onClick={() => !isLocked && handleSelectAvatar(avatar.url)}
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
          <div className="group divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
            <EditableInfoRow
              icon={Mail}
              label="Email"
              field="email"
              value={currentUser.email}
              editing={editingField === "email"}
              onStartEdit={() => startEdit("email")}
              onSave={(val) => handleSaveField("email", val)}
              onCancel={cancelEdit}
              saving={fieldSaving}
              error={editingField === "email" ? fieldError : null}
            />
            <EditableInfoRow
              icon={AtSign}
              label="Identifiant"
              field="username"
              value={`@${currentUser.username}`}
              editing={editingField === "username"}
              onStartEdit={() => startEdit("username")}
              onSave={(val) =>
                handleSaveField("username", val.replace(/^@/, ""))
              }
              onCancel={cancelEdit}
              saving={fieldSaving}
              error={editingField === "username" ? fieldError : null}
            />
            {currentUser.bio && (
              <div className="flex items-center gap-3 px-4 py-3">
                <FingerprintPattern
                  size={13}
                  className="shrink-0 text-muted-foreground"
                />
                <span className="w-20 shrink-0 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Biographie
                </span>
                <span className="truncate text-sm text-foreground">
                  {currentUser.bio}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
