"use client";

import { useState } from "react";
import { Phone, Pencil, Check, X } from "lucide-react";
import { Switch } from "@evcore/ui";
import { clientApiRequest } from "@/lib/api/client-api";
import {
  useCurrentUser,
  useSetCurrentUser,
} from "@/domains/auth/context/current-user-context";

/**
 * Consentement explicite avant toute collecte (décision produit 2026-09-04,
 * TODO.md "pas de numéro de téléphone collecté") : le champ numéro n'existe
 * même pas tant que l'interrupteur n'est pas activé — jamais une case
 * cochée après coup pour justifier un champ déjà rempli. Désactiver le
 * consentement efface le numéro stocké côté serveur (AuthService.updateMe).
 */
export function PhoneNumberRow({
  label,
  consentLabel,
  noneLabel,
  placeholder,
  addLabel,
  removeLabel,
  saveLabel,
  cancelLabel,
  editLabel,
  saveError,
}: {
  label: string;
  consentLabel: string;
  noneLabel: string;
  placeholder: string;
  addLabel: string;
  removeLabel: string;
  saveLabel: string;
  cancelLabel: string;
  editLabel: string;
  saveError: string;
}) {
  const currentUser = useCurrentUser();
  const setCurrentUser = useSetCurrentUser();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Le consentement (six lignes) ne s'affiche qu'à la demande : au repos, la
  // ligne dit « Non renseigné · Ajouter mon numéro » (revue UX du
  // 2026-10-11, P2-16).
  const [askingConsent, setAskingConsent] = useState(false);

  const hasNumber = currentUser.phoneNumber !== null;

  async function setConsent(checked: boolean) {
    setBusy(true);
    setError(null);
    try {
      await clientApiRequest("/auth/me", {
        method: "PATCH",
        body: { phoneNumberConsentGiven: checked },
        fallbackErrorMessage: saveError,
      });
      setCurrentUser({
        ...currentUser,
        phoneNumberConsentGiven: checked,
        ...(checked ? {} : { phoneNumber: null }),
      });
    } finally {
      setBusy(false);
    }
  }

  function startEdit() {
    setError(null);
    setDraft(currentUser.phoneNumber ?? "");
    setEditing(true);
  }

  function cancelEdit() {
    setError(null);
    setEditing(false);
    // Consent was just turned on for a first-time number and never saved —
    // closing the input without a number would otherwise leave a dangling
    // "consented, no number" state with nothing left to interact with.
    if (!hasNumber) void setConsent(false);
  }

  async function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await clientApiRequest("/auth/me", {
        method: "PATCH",
        body: { phoneNumber: trimmed },
        fallbackErrorMessage: saveError,
      });
      setCurrentUser({ ...currentUser, phoneNumber: trimmed });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : saveError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Phone size={13} className="shrink-0 text-muted-foreground" />
      <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>

      {!currentUser.phoneNumberConsentGiven ? (
        askingConsent ? (
          <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
            <span className="min-w-0 text-xs text-muted-foreground">
              {consentLabel}
            </span>
            <Switch
              checked={false}
              onCheckedChange={(checked) => {
                setAskingConsent(false);
                void setConsent(checked);
                if (checked) startEdit();
              }}
              disabled={busy}
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
            <span className="hidden truncate text-sm text-muted-foreground sm:inline">
              {noneLabel}
            </span>
            <button
              type="button"
              onClick={() => setAskingConsent(true)}
              className="min-h-11 shrink-0 text-sm font-semibold text-accent hover:underline"
            >
              {addLabel}
            </button>
          </div>
        )
      ) : editing ? (
        <div className="flex flex-1 items-center gap-1.5 min-w-0">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSave();
              if (e.key === "Escape") cancelEdit();
            }}
            placeholder={placeholder}
            disabled={busy}
            className="flex-1 min-w-0 rounded-md border border-border bg-background px-2 py-0.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy || draft.trim() === ""}
            aria-label={saveLabel}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-accent hover:bg-accent/10 disabled:opacity-40"
          >
            <Check size={16} />
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            disabled={busy}
            aria-label={cancelLabel}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/40"
          >
            <X size={16} />
          </button>
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
      ) : hasNumber ? (
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <span className="truncate text-sm text-foreground">
            {currentUser.phoneNumber}
          </span>
          <button
            type="button"
            onClick={startEdit}
            aria-label={editLabel}
            className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Pencil size={14} />
          </button>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
          <button
            type="button"
            onClick={startEdit}
            className="min-h-11 text-sm font-semibold text-accent hover:underline"
          >
            {addLabel}
          </button>
          <button
            type="button"
            onClick={() => void setConsent(false)}
            disabled={busy}
            className="min-h-11 shrink-0 text-xs text-muted-foreground hover:text-foreground"
          >
            {removeLabel}
          </button>
        </div>
      )}
    </div>
  );
}
