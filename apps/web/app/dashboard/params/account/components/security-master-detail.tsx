"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { SecuritySetupForm } from "./security-setup-form";
import { SecuritySection } from "./security-section";
import { SettingsSectionCard } from "./settings-section-card";

export function SecurityMasterDetail({
  detailOpen,
}: {
  detailOpen: boolean;
}) {
  const t = useTranslations("account");
  const router = useRouter();

  if (!detailOpen) {
    return <SecuritySection />;
  }

  return (
    <SettingsSectionCard title={t("securitySetupHeading")}>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => router.push("/dashboard/params/account/securite")}
          className="-ml-1 flex w-fit items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft size={16} />
          {t("tabSecurity")}
        </button>
        <SecuritySetupForm />
      </div>
    </SettingsSectionCard>
  );
}
