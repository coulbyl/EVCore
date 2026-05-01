"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { Button } from "@evcore/ui";
import { useTranslations } from "next-intl";
import { useFormationProgress } from "@/domains/formation/use-cases/use-formation-progress";
import type { FormationContentType } from "@/domains/formation/types/formation";

export function FormationCompletionButton({
  type,
  slug,
}: {
  type: FormationContentType;
  slug: string;
}) {
  const t = useTranslations("formation");
  const { isCompleted, markCompleted, unmarkCompleted } =
    useFormationProgress();
  const completed = isCompleted(type, slug);

  return (
    <Button
      variant={completed ? "secondary" : "outline"}
      onClick={() =>
        completed ? unmarkCompleted(type, slug) : markCompleted(type, slug)
      }
      className="rounded-xl shadow-xs"
      data-testid="formation-completion-button"
    >
      {completed ? (
        <CheckCircle2 size={16} data-icon="inline-start" />
      ) : (
        <Circle size={16} data-icon="inline-start" />
      )}
      {completed ? t("completed") : t("markCompleted")}
    </Button>
  );
}
