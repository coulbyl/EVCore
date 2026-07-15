import { Page, PageContent, PageHeader, PageHeaderTitle } from "@evcore/ui";
import { Settings } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";
import { AccountTabsClient } from "./account-tabs-client";

export default async function AccountSettingsPage() {
  const [locale, t, session] = await Promise.all([
    getLocale(),
    getTranslations("account"),
    getCurrentSession(),
  ]);

  const isAdmin = session?.user.role === "ADMIN";

  const adminNotificationItems = [
    {
      key: "roiAlert",
      label: t("notificationTypes.roiAlert"),
      help: t("notificationHelp.roiAlert"),
    },
    {
      key: "marketSuspension",
      label: t("notificationTypes.marketSuspension"),
      help: t("notificationHelp.marketSuspension"),
    },
    {
      key: "brierAlert",
      label: t("notificationTypes.brierAlert"),
      help: t("notificationHelp.brierAlert"),
    },
    {
      key: "weeklyReport",
      label: t("notificationTypes.weeklyReport"),
      help: t("notificationHelp.weeklyReport"),
    },
    {
      key: "etlFailure",
      label: t("notificationTypes.etlFailure"),
      help: t("notificationHelp.etlFailure"),
    },
    {
      key: "weightAdjustment",
      label: t("notificationTypes.weightAdjustment"),
      help: t("notificationHelp.weightAdjustment"),
    },
    {
      key: "xgUnavailableReport",
      label: t("notificationTypes.xgUnavailableReport"),
      help: t("notificationHelp.xgUnavailableReport"),
    },
  ];

  const operatorNotificationItems = [
    {
      key: "roiAlert",
      label: t("notificationTypes.roiAlert"),
      help: t("notificationHelp.roiAlert"),
    },
    {
      key: "marketSuspension",
      label: t("notificationTypes.marketSuspension"),
      help: t("notificationHelp.marketSuspension"),
    },
    {
      key: "weeklyReport",
      label: t("notificationTypes.weeklyReport"),
      help: t("notificationHelp.weeklyReport"),
    },
  ];

  return (
    <Page className="flex h-full flex-col">
      <PageHeader className="items-center gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary text-accent shadow-xs">
          <Settings size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {t("account")}
          </p>
          <PageHeaderTitle className="text-base font-semibold tracking-tight sm:text-lg">
            {t("title")}
          </PageHeaderTitle>
        </div>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <AccountTabsClient
          hasSession={session !== null}
          locale={(locale as "fr" | "en") ?? "fr"}
          notificationLabels={{
            eyebrow: t("notifications"),
            title: t("notifications"),
            description: t("notificationDescription"),
            availabilityHint: t("notificationAvailabilityHint"),
            statusLabel: t("notificationVisibleStatus"),
            items: isAdmin ? adminNotificationItems : operatorNotificationItems,
          }}
          pushNotificationLabels={{
            eyebrow: t("notifications"),
            title: t("pushNotifications"),
            description: t("pushNotificationsDescription"),
            toggleLabel: t("pushNotificationsToggle"),
            unsupportedHint: t("pushNotificationsUnsupported"),
            deniedHint: t("pushNotificationsDenied"),
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
