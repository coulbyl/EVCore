"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@evcore/ui";
import { useTranslations } from "next-intl";

export function FormationBackButton() {
  const router = useRouter();
  const t = useTranslations("common");

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="rounded-xl"
      onClick={() => router.back()}
    >
      <ArrowLeft size={16} data-icon="inline-start" />
      {t("back")}
    </Button>
  );
}
