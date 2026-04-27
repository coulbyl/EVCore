import { Page, PageContent } from "@evcore/ui";
import { getLocale, getTranslations } from "next-intl/server";
import { AppearanceSection } from "./components/appearance-section";
import { AccountProfileSection } from "./components/account-profile-section";
import { BankrollPreferencesSection } from "./components/bankroll-preferences-section";
import { LanguageSection } from "./components/language-section";
import { NotificationsSection } from "./components/notifications-section";

export default async function AccountSettingsPage() {
  const locale = (await getLocale()) as "fr" | "en";
  const t = await getTranslations("account");

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="mb-6">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {t("account")}
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
            {t("title")}
          </h1>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <AccountProfileSection
            labels={{
              eyebrow: t("account"),
              title: t("profile"),
              description: t("profileDescription"),
              fullName: t("fullName"),
              email: t("email"),
              username: t("username"),
              role: t("role"),
              password: t("password"),
              changePassword: t("changePassword"),
              changePasswordHint: t("changePasswordHint"),
              loading: "…",
              roles: {
                ADMIN: t("roles.ADMIN"),
                OPERATOR: t("roles.OPERATOR"),
              },
            }}
          />

          <AppearanceSection />
          <LanguageSection currentLocale={locale} />

          <NotificationsSection
            labels={{
              eyebrow: t("notifications"),
              title: t("notifications"),
              description: t("notificationDescription"),
              preferenceHint: t("preferenceHint"),
              items: [
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
              ],
            }}
          />

          <BankrollPreferencesSection
            labels={{
              eyebrow: t("bankroll"),
              title: t("bankroll"),
              description: t("bankrollDescription"),
              preferenceHint: t("preferenceHint"),
              stakeUnit: t("stakeUnit"),
              displayCurrency: t("displayCurrency"),
              stakeOptions: [
                { value: "1u", label: t("stakeUnits.one") },
                { value: "2u", label: t("stakeUnits.two") },
                { value: "5u", label: t("stakeUnits.five") },
              ],
              currencyOptions: [
                { value: "EUR", label: t("currencies.eur") },
                { value: "USD", label: t("currencies.usd") },
                { value: "GBP", label: t("currencies.gbp") },
              ],
            }}
          />
        </div>
      </PageContent>
    </Page>
  );
}
