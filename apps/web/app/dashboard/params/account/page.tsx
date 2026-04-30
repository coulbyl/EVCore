import { Page, PageContent } from "@evcore/ui";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";
import { ProfileHeroSection } from "./components/profile-hero-section";
import { BadgesSection } from "./components/badges-section";
import { AppearanceSection } from "./components/appearance-section";
import { LanguageSection } from "./components/language-section";
import { NotificationsSection } from "./components/notifications-section";
import { BankrollPreferencesSection } from "./components/bankroll-preferences-section";

export default async function AccountSettingsPage() {
  const [locale, t, session] = await Promise.all([
    getLocale(),
    getTranslations("account"),
    getCurrentSession(),
  ]);

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
          {/* Hero — avatar + identité + infos compte */}
          {session ? <ProfileHeroSection user={session.user} /> : null}

          {/* Badges de progression */}
          <div className="lg:col-span-2">
            <BadgesSection />
          </div>

          {/* Apparence + Langue côte à côte */}
          <AppearanceSection />
          <LanguageSection currentLocale={(locale as "fr" | "en") ?? "fr"} />

          {/* Notifications — pleine largeur */}
          <div className="lg:col-span-2">
            <NotificationsSection
              labels={{
                eyebrow: t("notifications"),
                title: t("notifications"),
                description: t("notificationDescription"),
                preferenceHint: t("savedAutomatically"),
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
          </div>

          {/* Bankroll */}
          <BankrollPreferencesSection
            labels={{
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
            }}
          />
        </div>
      </PageContent>
    </Page>
  );
}
