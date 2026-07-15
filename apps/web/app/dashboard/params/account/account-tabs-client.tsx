"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@evcore/ui";
import {
  Award,
  Bell,
  Globe,
  Monitor,
  ShieldCheck,
  User,
  Wallet,
} from "lucide-react";
import { ProfileHeroSection } from "./components/profile-hero-section";
import { BadgesSection } from "./components/badges-section";
import { AppearanceSection } from "./components/appearance-section";
import { LanguageSection } from "./components/language-section";
import { NotificationsSection } from "./components/notifications-section";
import { PushNotificationsSection } from "./components/push-notifications-section";
import { BankrollPreferencesSection } from "./components/bankroll-preferences-section";
import { SecuritySection } from "./components/security-section";

type NotificationItem = { key: string; label: string; help: string };

export function AccountTabsClient({
  hasSession,
  locale,
  notificationLabels,
  pushNotificationLabels,
  bankrollLabels,
}: {
  hasSession: boolean;
  locale: "fr" | "en";
  notificationLabels: {
    eyebrow: string;
    title: string;
    description: string;
    availabilityHint: string;
    statusLabel: string;
    items: NotificationItem[];
  };
  pushNotificationLabels: {
    eyebrow: string;
    title: string;
    description: string;
    toggleLabel: string;
    unsupportedHint: string;
    deniedHint: string;
  };
  bankrollLabels: {
    eyebrow: string;
    title: string;
    description: string;
    savedAutomatically: string;
    displayCurrency: string;
    currencyOptions: Array<{ value: string; label: string }>;
    unitStake: string;
    unitModeFixed: string;
    unitModePct: string;
    unitAmountPlaceholder: string;
    unitPctPlaceholder: string;
    unitPctSuffix: string;
    unitOptionalHint: string;
  };
}) {
  const tabs = [
    { value: "profil", label: "Profil", icon: User },
    { value: "apparence", label: "Apparence", icon: Monitor },
    { value: "langue", label: "Langue", icon: Globe },
    { value: "securite", label: "Sécurité", icon: ShieldCheck },
    { value: "notifications", label: "Notifications", icon: Bell },
    { value: "bankroll", label: "Bankroll", icon: Wallet },
    { value: "badges", label: "Badges", icon: Award },
  ] as const;

  return (
    <Tabs defaultValue="profil" className="gap-0">
      {/* Tab list — scrollable on mobile */}
      <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
        <TabsList
          variant="line"
          className="mb-5 w-max gap-0 border-b border-border pb-0"
        >
          {tabs.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="shrink-0 gap-1.5 rounded-none border-b-2 border-transparent px-3 pb-3 pt-1 text-sm data-[state=active]:border-accent data-[state=active]:text-accent"
            >
              <Icon size={14} />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="profil">
        <div className="flex flex-col gap-4">
          {hasSession ? <ProfileHeroSection /> : null}
        </div>
      </TabsContent>

      <TabsContent value="apparence">
        <AppearanceSection />
      </TabsContent>

      <TabsContent value="langue">
        <LanguageSection currentLocale={locale} />
      </TabsContent>

      <TabsContent value="securite">
        <SecuritySection />
      </TabsContent>

      <TabsContent value="notifications">
        <div className="flex flex-col gap-4">
          <PushNotificationsSection labels={pushNotificationLabels} />
          <NotificationsSection labels={notificationLabels} />
        </div>
      </TabsContent>

      <TabsContent value="bankroll">
        <BankrollPreferencesSection
          labels={
            bankrollLabels as Parameters<
              typeof BankrollPreferencesSection
            >[0]["labels"]
          }
        />
      </TabsContent>

      <TabsContent value="badges">
        <BadgesSection />
      </TabsContent>
    </Tabs>
  );
}
