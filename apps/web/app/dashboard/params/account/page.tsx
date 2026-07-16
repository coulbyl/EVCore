import { Page, PageContent } from "@evcore/ui";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";
import { AccountTabsClient } from "./account-tabs-client";

export default async function AccountSettingsPage() {
  const [locale, t, session] = await Promise.all([
    getLocale(),
    getTranslations("account"),
    getCurrentSession(),
  ]);

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <AccountTabsClient
          hasSession={session !== null}
          locale={(locale as "fr" | "en") ?? "fr"}
          pushNotificationLabels={{
            title: t("pushNotifications"),
            description: t("pushNotificationsDescription"),
            toggleLabel: t("pushNotificationsToggle"),
            unsupportedHint: t("pushNotificationsUnsupported"),
            deniedHint: t("pushNotificationsDenied"),
          }}
          emailNotificationLabels={{
            title: t("emailNotifications"),
            description: t("emailNotificationsDescription"),
            toggleLabel: t("emailNotificationsToggle"),
          }}
          bankrollLabels={{
            eyebrow: t("account"),
            title: t("bankroll"),
            description: t("bankrollDescription"),
            savedAutomatically: t("savedAutomatically"),
            displayCurrency: t("displayCurrency"),
            currencyOptions: [
              { value: "XOF", label: t("currencies.xof") },
              { value: "USD", label: t("currencies.usd") },
              { value: "EUR", label: t("currencies.eur") },
            ],
            unitStake: t("unitStake"),
            unitModeFixed: t("unitModeFixed"),
            unitModePct: t("unitModePct"),
            unitAmountPlaceholder: t("unitAmountPlaceholder"),
            unitPctPlaceholder: t("unitPctPlaceholder"),
            unitPctSuffix: t("unitPctSuffix"),
            unitOptionalHint: t("unitOptionalHint"),
          }}
        />
      </PageContent>
    </Page>
  );
}
