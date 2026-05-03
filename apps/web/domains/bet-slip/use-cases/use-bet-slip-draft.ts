"use client";

import { useState, useEffect, useCallback } from "react";
import { useCurrentUser } from "@/domains/auth/context/current-user-context";
import type { AuthSessionUser } from "@/domains/auth/types/auth";
import { useBankrollBalance } from "@/domains/bankroll/use-cases/get-bankroll-balance";
import {
  draftItemKey,
  type BetSlipDraft,
  type BetSlipDraftItem,
} from "../types/bet-slip";

const STORAGE_KEY = "evcore:bet-slip-draft";
const DEFAULT_UNIT_STAKE = 4000;
const DEFAULT_TYPE: BetSlipDraft["type"] = "SIMPLE";

function emptyDraft(unitStake = DEFAULT_UNIT_STAKE): BetSlipDraft {
  return { items: [], unitStake, type: DEFAULT_TYPE };
}

function resolveInitialUnit(
  session: AuthSessionUser | null,
  currentBalance: number | null,
): number {
  if (!session?.unitMode) return DEFAULT_UNIT_STAKE;
  if (session.unitMode === "FIXED" && session.unitAmount) {
    return Number(session.unitAmount);
  }
  if (
    session.unitMode === "PCT" &&
    session.unitPercent &&
    currentBalance !== null
  ) {
    return Math.round(currentBalance * Number(session.unitPercent));
  }
  return DEFAULT_UNIT_STAKE;
}

function normalizeDraft(
  draft: Partial<BetSlipDraft>,
  fallbackUnitStake: number,
): BetSlipDraft {
  const items = Array.isArray(draft.items) ? draft.items : [];
  const hasExplicitStake = typeof draft.unitStake === "number";
  return {
    items,
    unitStake:
      hasExplicitStake && items.length > 0
        ? (draft.unitStake as number)
        : fallbackUnitStake,
    type: draft.type === "COMBO" && items.length >= 2 ? "COMBO" : "SIMPLE",
  };
}

function loadDraft(fallbackUnitStake: number): BetSlipDraft {
  if (typeof window === "undefined") return emptyDraft(fallbackUnitStake);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDraft(fallbackUnitStake);
    return normalizeDraft(
      JSON.parse(raw) as Partial<BetSlipDraft>,
      fallbackUnitStake,
    );
  } catch {
    return emptyDraft(fallbackUnitStake);
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
  const currentUser = useCurrentUser();
  const shouldLoadBalance = currentUser.unitMode === "PCT";
  const bankrollQuery = useBankrollBalance(shouldLoadBalance);
  const currentBalance =
    bankrollQuery.data?.balance !== undefined
      ? Number.parseFloat(bankrollQuery.data.balance)
      : null;
  const initialUnitStake = resolveInitialUnit(currentUser, currentBalance);
  const [draft, setDraftState] = useState<BetSlipDraft>(() =>
    emptyDraft(initialUnitStake),
  );

  // Hydrate from localStorage after mount to avoid SSR/client mismatch
  useEffect(() => {
    if (shouldLoadBalance && bankrollQuery.isPending && !bankrollQuery.data) {
      return;
    }
    setDraftState(loadDraft(initialUnitStake));
  }, [
    bankrollQuery.data,
    bankrollQuery.isPending,
    initialUnitStake,
    shouldLoadBalance,
  ]);

  // Sync depuis d'autres onglets
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setDraftState(loadDraft(initialUnitStake));
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [initialUnitStake]);

  const setDraft = useCallback(
    (updater: (prev: BetSlipDraft) => BetSlipDraft) => {
      setDraftState((prev) => {
        const next = updater(prev);
        const normalized = normalizeDraft(next, initialUnitStake);
        saveDraft(normalized);
        return normalized;
      });
    },
    [initialUnitStake],
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
    setDraft(() => emptyDraft(initialUnitStake));
  }, [initialUnitStake, setDraft]);

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
