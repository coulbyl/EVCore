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
  Lock,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { UserAvatar } from "@/components/user-avatar";
import { useMyBadges } from "@/domains/gamification/use-cases/get-my-badges";
import { FREE_AVATARS, LOCKED_AVATARS } from "@/lib/avatars";
import {
  useCurrentUser,
  useSetCurrentUser,
} from "@/domains/auth/context/current-user-context";
import { clientApiRequest } from "@/lib/api/client-api";
import { updateIdentity } from "@/domains/auth/use-cases/update-identity";
import { PhoneNumberRow } from "./phone-number-row";

type EditableField = "username" | null;

function ReadOnlyInfoRow({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon size={13} className="shrink-0 text-muted-foreground" />
      <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{value}</span>
        {hint ? (
          <span className="block text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}

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
  editLabel,
  saveLabel,
  cancelLabel,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  editing: boolean;
  onStartEdit: () => void;
  onSave: (val: string) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  editLabel: string;
  saveLabel: string;
  cancelLabel: string;
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
      <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
            aria-label={saveLabel}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-accent hover:bg-accent/10 disabled:opacity-40"
          >
            <Check size={16} />
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label={cancelLabel}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/40"
          >
            <X size={16} />
          </button>
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
      ) : (
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <span className="truncate text-sm text-foreground">{value}</span>
          {/* Toujours visible : au toucher, un crayon qui n'apparaît qu'au
              survol n'existe pas (revue UX du 2026-10-27, P2-8). */}
          <button
            type="button"
            onClick={onStartEdit}
            aria-label={editLabel}
            className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Pencil size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export function ProfileHeroSection() {
  const t = useTranslations("account");
  const currentUser = useCurrentUser();
  const setCurrentUser = useSetCurrentUser();

  const [selected, setSelected] = useState<string | null>(
    currentUser.avatarUrl,
  );
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

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
    const previous = selected;
    setSelected(avatarUrl);
    setAvatarSaving(true);
    setAvatarError(null);
    try {
      await clientApiRequest("/auth/me", {
        method: "PATCH",
        body: { avatarUrl },
        fallbackErrorMessage: t("avatarSaveError"),
      });
      setCurrentUser({ ...currentUser, avatarUrl });
    } catch {
      // L'échec était silencieux : l'avatar changeait à l'écran sans être
      // enregistré (revue UX du 2026-10-27, P2-7).
      setSelected(previous);
      setAvatarError(t("avatarSaveError"));
    } finally {
      setAvatarSaving(false);
    }
  }

  async function handleSaveField(field: "username", value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setFieldSaving(true);
    setFieldError(null);
    try {
      const updated = await updateIdentity({ [field]: trimmed });
      setCurrentUser({ ...currentUser, ...updated });
      setEditingField(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("genericError");
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
      {/* Colonnes bornées (minmax 0) : sans elles, la bande d'avatars
          élargissait la colonne et rognait les cartes sur téléphone. */}
      <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8 sm:p-7">
        {/* ── Left: avatar + picker ── */}
        <div className="flex min-w-0 flex-col items-center gap-4 sm:items-start">
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
            <p className="text-center text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-left">
              {t("avatar")}
            </p>
            {/* Le bord droit s'estompe : la bande continue au-delà de
                l'écran, et rien ne le disait (revue UX du 2026-10-11,
                P2-16). */}
            {/* Sur grand écran, les avatars passent à la ligne : la bande
                n'en montrait que 7 sur 10 à côté d'un grand vide. */}
            <div className="flex gap-1 overflow-x-auto pb-1 pr-6 [mask-image:linear-gradient(to_right,black_calc(100%_-_2.5rem),transparent)] sm:max-w-sm sm:flex-wrap sm:overflow-visible sm:pr-0 sm:[mask-image:none]">
              {FREE_AVATARS.map((avatar) => (
                <button
                  key={avatar.url}
                  type="button"
                  disabled={avatarSaving}
                  onClick={() => handleSelectAvatar(avatar.url)}
                  aria-label={avatar.label}
                  aria-pressed={selected === avatar.url}
                  className={`flex size-11 shrink-0 items-center justify-center rounded-full transition-all ${
                    selected === avatar.url
                      ? "ring-2 ring-accent ring-offset-2 ring-offset-panel-strong"
                      : "opacity-70 hover:opacity-100"
                  }`}
                  title={avatar.label}
                >
                  <UserAvatar
                    avatarUrl={avatar.url}
                    username={avatar.label}
                    size={34}
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
                    aria-label={avatar.label}
                    className={`relative flex size-11 shrink-0 items-center justify-center rounded-full transition-all ${
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
                      size={34}
                    />
                    {isLocked && (
                      <span className="absolute right-0 top-0 inline-flex size-4 items-center justify-center rounded-full bg-panel-strong text-muted-foreground">
                        <Lock size={10} aria-hidden />
                      </span>
                    )}
                  </button>
                );

                if (isLocked && avatar.requiredBadge) {
                  return (
                    <Tooltip key={avatar.url}>
                      <TooltipTrigger asChild>{btn}</TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        {t("requires")}{" "}
                        {t.has(`badgeNames.${avatar.requiredBadge}`)
                          ? t(`badgeNames.${avatar.requiredBadge}`)
                          : avatar.requiredBadge}
                      </TooltipContent>
                    </Tooltip>
                  );
                }
                return btn;
              })}
            </div>
            {avatarError ? (
              <p role="alert" className="text-xs text-destructive">
                {avatarError}
              </p>
            ) : null}
          </div>
        </div>

        {/* ── Right: identity + info ── */}
        <div className="flex flex-col justify-between gap-5">
          {/* Identity */}
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground">
              {currentUser.fullName}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                @{currentUser.username}
              </span>
              {/* « Opérateur » se lit « bookmaker » chez un parieur : le
                  rôle ne s'affiche qu'aux admins (revue UX du 2026-10-27). */}
              {currentUser.role === "ADMIN" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/12 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-accent">
                  <ShieldCheck size={12} />
                  {t("roles.ADMIN")}
                </span>
              ) : null}
            </div>
          </div>

          {/* Info rows */}
          <div className="group divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
            {/* L'adresse ne se change plus en ligne : sans mot de passe ni
                code envoyé à la nouvelle adresse, le changement retirait la
                vérification sans prévenir (revue UX du 2026-10-27, P2-8). */}
            <ReadOnlyInfoRow
              icon={Mail}
              label={t("email")}
              value={currentUser.email}
              hint={t("emailChangeHint")}
            />
            <EditableInfoRow
              icon={AtSign}
              label={t("username")}
              value={`@${currentUser.username}`}
              editing={editingField === "username"}
              onStartEdit={() => startEdit("username")}
              onSave={(val) =>
                handleSaveField("username", val.replace(/^@/, ""))
              }
              onCancel={cancelEdit}
              saving={fieldSaving}
              error={editingField === "username" ? fieldError : null}
              editLabel={t("editField", {
                field: t("username").toLowerCase(),
              })}
              saveLabel={t("save")}
              cancelLabel={t("cancel")}
            />
            <PhoneNumberRow
              label={t("phone")}
              consentLabel={t("phoneConsentLabel")}
              noneLabel={t("phoneNone")}
              placeholder={t("phonePlaceholder")}
              addLabel={t("phoneAdd")}
              removeLabel={t("phoneRemove")}
              saveLabel={t("save")}
              cancelLabel={t("cancel")}
              editLabel={t("editField", { field: t("phone").toLowerCase() })}
              saveError={t("phoneSaveError")}
            />
            {currentUser.bio ? (
              <ReadOnlyInfoRow
                icon={FingerprintPattern}
                label={t("bio")}
                value={currentUser.bio}
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
