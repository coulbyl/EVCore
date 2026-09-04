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
  placeholder,
  addLabel,
  removeLabel,
  saveLabel,
  cancelLabel,
  saveError,
}: {
  label: string;
  consentLabel: string;
  placeholder: string;
  addLabel: string;
  removeLabel: string;
  saveLabel: string;
  cancelLabel: string;
  saveError: string;
}) {
  const currentUser = useCurrentUser();
  const setCurrentUser = useSetCurrentUser();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

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
      <span className="w-20 shrink-0 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>

      {!currentUser.phoneNumberConsentGiven ? (
        <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
          <span className="min-w-0 text-xs text-muted-foreground">
            {consentLabel}
          </span>
          <Switch
            checked={false}
            onCheckedChange={(checked) => {
              void setConsent(checked);
              if (checked) startEdit();
            }}
            disabled={busy}
          />
        </div>
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
            className="shrink-0 rounded-md p-1 text-accent hover:bg-accent/10 disabled:opacity-40"
            title={saveLabel}
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            disabled={busy}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted/40"
            title={cancelLabel}
          >
            <X size={14} />
          </button>
          {error && (
            <span className="text-[0.68rem] text-destructive whitespace-nowrap">
              {error}
            </span>
          )}
        </div>
      ) : hasNumber ? (
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <span className="truncate text-sm text-foreground">
            {currentUser.phoneNumber}
          </span>
          <button
            type="button"
            onClick={startEdit}
            className="ml-auto shrink-0 rounded-md p-1 text-muted-foreground opacity-0 hover:opacity-100 group-hover:opacity-60 hover:text-foreground transition-opacity"
            title={saveLabel}
          >
            <Pencil size={11} />
          </button>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
          <button
            type="button"
            onClick={startEdit}
            className="text-xs font-semibold text-accent hover:underline"
          >
            {addLabel}
          </button>
          <button
            type="button"
            onClick={() => void setConsent(false)}
            disabled={busy}
            className="shrink-0 text-[0.68rem] text-muted-foreground hover:text-foreground"
          >
            {removeLabel}
          </button>
        </div>
      )}
    </div>
  );
}
