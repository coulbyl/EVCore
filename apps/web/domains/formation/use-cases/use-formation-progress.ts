"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormationContentType } from "../types/formation";

const STORAGE_KEY = "evcore:formation:progress:v1";

type StoredProgress = {
  read: Record<string, string>;
  watched: Record<string, string>;
};

function safeParseProgress(raw: string | null): StoredProgress {
  if (!raw) return { read: {}, watched: {} };
  try {
    const parsed = JSON.parse(raw) as Partial<StoredProgress>;
    return {
      read: parsed.read ?? {},
      watched: parsed.watched ?? {},
    };
  } catch {
    return { read: {}, watched: {} };
  }
}

function writeProgress(next: StoredProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function useFormationProgress() {
  const [progress, setProgress] = useState<StoredProgress>({
    read: {},
    watched: {},
  });

  useEffect(() => {
    setProgress(safeParseProgress(localStorage.getItem(STORAGE_KEY)));
  }, []);

  const isCompleted = useCallback(
    (type: FormationContentType, slug: string) => {
      if (type === "article") return Boolean(progress.read[slug]);
      return Boolean(progress.watched[slug]);
    },
    [progress],
  );

  const markCompleted = useCallback(
    (type: FormationContentType, slug: string) => {
      const completedAt = new Date().toISOString();
      setProgress((current) => {
        const next =
          type === "article"
            ? { ...current, read: { ...current.read, [slug]: completedAt } }
            : {
                ...current,
                watched: { ...current.watched, [slug]: completedAt },
              };
        writeProgress(next);
        return next;
      });
    },
    [],
  );

  const unmarkCompleted = useCallback(
    (type: FormationContentType, slug: string) => {
      setProgress((current) => {
        const next: StoredProgress =
          type === "article"
            ? { ...current, read: { ...current.read } }
            : { ...current, watched: { ...current.watched } };

        if (type === "article") {
          delete next.read[slug];
        } else {
          delete next.watched[slug];
        }

        writeProgress(next);
        return next;
      });
    },
    [],
  );

  const counts = useMemo(() => {
    const readCount = Object.keys(progress.read).length;
    const watchedCount = Object.keys(progress.watched).length;
    return {
      readCount,
      watchedCount,
      totalCompleted: readCount + watchedCount,
    };
  }, [progress]);

  return {
    progress,
    counts,
    isCompleted,
    markCompleted,
    unmarkCompleted,
    storageKey: STORAGE_KEY,
  };
}
