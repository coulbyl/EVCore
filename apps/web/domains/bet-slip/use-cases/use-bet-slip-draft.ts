"use client";

import { useState, useEffect, useCallback } from "react";
import {
  draftItemKey,
  type BetSlipDraft,
  type BetSlipDraftItem,
} from "../types/bet-slip";

const STORAGE_KEY = "evcore:bet-slip-draft";
const DEFAULT_UNIT_STAKE = 4000;
const DEFAULT_TYPE: BetSlipDraft["type"] = "SIMPLE";

function emptyDraft(): BetSlipDraft {
  return { items: [], unitStake: DEFAULT_UNIT_STAKE, type: DEFAULT_TYPE };
}

function normalizeDraft(draft: Partial<BetSlipDraft>): BetSlipDraft {
  const items = Array.isArray(draft.items) ? draft.items : [];
  return {
    items,
    unitStake:
      typeof draft.unitStake === "number"
        ? draft.unitStake
        : DEFAULT_UNIT_STAKE,
    type: draft.type === "COMBO" && items.length >= 2 ? "COMBO" : "SIMPLE",
  };
}

function loadDraft(): BetSlipDraft {
  if (typeof window === "undefined") return emptyDraft();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDraft();
    return normalizeDraft(JSON.parse(raw) as Partial<BetSlipDraft>);
  } catch {
    return emptyDraft();
  }
}

function saveDraft(draft: BetSlipDraft): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // localStorage non disponible
  }
}

export function useBetSlipDraft() {
  const [draft, setDraftState] = useState<BetSlipDraft>({
    items: [],
    unitStake: DEFAULT_UNIT_STAKE,
    type: DEFAULT_TYPE,
  });

  // Hydrate from localStorage after mount to avoid SSR/client mismatch
  useEffect(() => {
    setDraftState(loadDraft());
  }, []);

  // Sync depuis d'autres onglets
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setDraftState(loadDraft());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setDraft = useCallback(
    (updater: (prev: BetSlipDraft) => BetSlipDraft) => {
      setDraftState((prev) => {
        const next = updater(prev);
        const normalized = normalizeDraft(next);
        saveDraft(normalized);
        return normalized;
      });
    },
    [],
  );

  const addItem = useCallback(
    (item: BetSlipDraftItem) => {
      setDraft((prev) => {
        const key = draftItemKey(item);
        if (prev.items.some((i) => draftItemKey(i) === key)) return prev;
        return { ...prev, items: [...prev.items, item] };
      });
    },
    [setDraft],
  );

  /** Retire l'item dont la clé correspond (betId pour MODEL, clé composite pour USER). */
  const removeItem = useCallback(
    (key: string) => {
      setDraft((prev) => ({
        ...prev,
        items: prev.items.filter((i) => draftItemKey(i) !== key),
      }));
    },
    [setDraft],
  );

  const setStakeOverride = useCallback(
    (key: string, stake: number | null) => {
      setDraft((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          draftItemKey(i) === key ? { ...i, stakeOverride: stake } : i,
        ),
      }));
    },
    [setDraft],
  );

  const setUnitStake = useCallback(
    (stake: number) => {
      setDraft((prev) => ({ ...prev, unitStake: stake }));
    },
    [setDraft],
  );

  const setType = useCallback(
    (type: BetSlipDraft["type"]) => {
      setDraft((prev) => ({ ...prev, type }));
    },
    [setDraft],
  );

  const clearDraft = useCallback(() => {
    setDraft(() => emptyDraft());
  }, [setDraft]);

  /** Vérifie si la clé donnée correspond à un item dans le brouillon. */
  const isInSlip = useCallback(
    (key: string) => draft.items.some((i) => draftItemKey(i) === key),
    [draft.items],
  );

  return {
    draft,
    addItem,
    removeItem,
    setStakeOverride,
    setUnitStake,
    setType,
    clearDraft,
    isInSlip,
  };
}
