"use client";

import { useEffect, useState } from "react";

function loadStored<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Mirrors a one-shot mutation result into localStorage so a manually-triggered
 * analysis survives navigation. Returns the effective result (fresh > stored)
 * and whether it came from storage.
 */
export function useStoredResult<T>(
  data: T | undefined,
  storageKey: string,
): { result: T | null; isStored: boolean } {
  const [stored, setStored] = useState<T | null>(null);

  useEffect(() => {
    setStored(loadStored<T>(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (data === undefined) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      // localStorage unavailable — keep the in-memory result only.
    }
    setStored(data);
  }, [data, storageKey]);

  return { result: data ?? stored, isStored: data === undefined && stored !== null };
}
