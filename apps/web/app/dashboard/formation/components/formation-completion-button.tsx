"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { Button } from "@evcore/ui";
import { useTranslations } from "next-intl";
import { useFormationProgress } from "@/domains/formation/use-cases/use-formation-progress";
import type { FormationContentType } from "@/domains/formation/types/formation";
import { clientApiRequest } from "@/lib/api/client-api";

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
      onClick={async () => {
        const apiType = type === "article" ? "ARTICLE" : "VIDEO";

        if (completed) {
          unmarkCompleted(type, slug);
          try {
            await clientApiRequest(`/formation/progress/${apiType}/${slug}`, {
              method: "DELETE",
              fallbackErrorMessage: "",
            });
          } catch {
            markCompleted(type, slug);
          }
          return;
        }

        markCompleted(type, slug);
        try {
          await clientApiRequest(`/formation/progress`, {
            method: "POST",
            body: { contentType: apiType, slug },
            fallbackErrorMessage: "",
          });
        } catch {
          unmarkCompleted(type, slug);
        }
      }}
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
