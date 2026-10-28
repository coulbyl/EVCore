import Link from "next/link";
import { useTranslations } from "next-intl";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { PauseAccountSection } from "./pause-account-section";
import { SettingsSectionCard } from "./settings-section-card";

/**
 * Le seul réglage du compte propre à un produit de paris. La page Jeu
 * responsable n'était liée depuis aucun écran du tableau de bord, et rien
 * ne disait comment supprimer son compte (revue UX du 2026-10-27, P1-4).
 * Pause et suppression en libre-service depuis le 2026-10-28.
 */
export function ResponsibleGamblingCard() {
  const t = useTranslations("account.responsible");
  return (
    <SettingsSectionCard title={t("title")}>
      <div className="flex flex-col gap-3 text-sm leading-6 text-muted-foreground">
        <p className="text-foreground">{t("body")}</p>
        <PauseAccountSection />
        <div className="flex flex-col gap-2">
          <p>{t("deletion")}</p>
          <DeleteAccountDialog />
        </div>
        <div className="flex flex-wrap gap-x-5">
          <Link
            href="/jeu-responsable"
            className="inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4"
          >
            {t("readPage")}
          </Link>
          <Link
            href="/dashboard/inbox"
            className="inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4"
          >
            {t("writeTeam")}
          </Link>
        </div>
      </div>
    </SettingsSectionCard>
  );
}
