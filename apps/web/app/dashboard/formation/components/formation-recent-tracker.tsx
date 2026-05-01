"use client";

import { useEffect } from "react";
import { useFormationProgress } from "@/domains/formation/use-cases/use-formation-progress";
import type {
  FormationCategory,
  FormationContentType,
} from "@/domains/formation/types/formation";

export function FormationRecentTracker({
  category,
  type,
  slug,
}: {
  category: FormationCategory;
  type: FormationContentType;
  slug: string;
}) {
  const { setRecent } = useFormationProgress();

  useEffect(() => {
    setRecent({ category, type, slug });
  }, [category, setRecent, slug, type]);

  return null;
}
