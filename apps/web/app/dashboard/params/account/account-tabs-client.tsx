"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@evcore/ui";
import {
  Bell,
  ChevronDown,
  Monitor,
  ShieldCheck,
  User,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ProfileHeroSection } from "./components/profile-hero-section";
import { BadgesSection } from "./components/badges-section";
import { AppearanceSection } from "./components/appearance-section";
import { LanguageSection } from "./components/language-section";
import { PushNotificationsSection } from "./components/push-notifications-section";
import { EmailNotificationsSection } from "./components/email-notifications-section";
import { BankrollPreferencesSection } from "./components/bankroll-preferences-section";
import { SecurityMasterDetail } from "./components/security-master-detail";
import type { AccountTabValue } from "./account-tabs-constants";

export function AccountTabsClient({
  hasSession,
  locale,
  activeTab,
  securityDetailOpen,
  pushNotificationLabels,
  emailNotificationLabels,
  bankrollLabels,
}: {
  hasSession: boolean;
  locale: "fr" | "en";
  activeTab: AccountTabValue;
  securityDetailOpen: boolean;
  pushNotificationLabels: {
    title: string;
    description: string;
    toggleLabel: string;
    unsupportedHint: string;
    deniedHint: string;
  };
  emailNotificationLabels: {
    title: string;
    description: string;
    toggleLabel: string;
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
  const t = useTranslations("account");
  const router = useRouter();
  const [mobilePickerOpen, setMobilePickerOpen] = useState(false);

  const groups: {
    label: string;
    tabs: {
      value: AccountTabValue;
      label: string;
      icon: typeof User;
    }[];
  }[] = [
    {
      label: t("groupAccount"),
      tabs: [
        { value: "profil", label: t("tabProfile"), icon: User },
        { value: "securite", label: t("tabSecurity"), icon: ShieldCheck },
      ],
    },
    {
      label: t("groupPreferences"),
      tabs: [
        { value: "preferences", label: t("tabPreferences"), icon: Monitor },
        { value: "bankroll", label: t("tabBankroll"), icon: Wallet },
        { value: "notifications", label: t("tabNotifications"), icon: Bell },
      ],
    },
  ];

  const activeTabInfo = groups
    .flatMap((group) => group.tabs)
    .find((tab) => tab.value === activeTab);

  function navigate(value: AccountTabValue) {
    router.push(`/dashboard/params/account/${value}`);
    setMobilePickerOpen(false);
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => navigate(value as AccountTabValue)}
      orientation="vertical"
      className="flex-col items-start gap-4 md:flex-row md:gap-6"
    >
      {/* Rail — a popover picker on mobile, a grouped vertical rail on desktop.
          Wrapped together under one data-tour target so the tour highlights
          whichever one is actually visible at the current breakpoint. */}
      <div data-tour="account-tabs-list" className="w-full md:w-52 md:shrink-0">
        {/* Mobile — popover picker */}
        <Popover open={mobilePickerOpen} onOpenChange={setMobilePickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-2xl border border-border bg-panel-strong px-4 py-2.5 text-sm font-medium text-foreground md:hidden"
            >
              <span className="flex items-center gap-2">
                {activeTabInfo ? <activeTabInfo.icon size={16} /> : null}
                {activeTabInfo?.label}
              </span>
              <ChevronDown size={16} className="text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[calc(100vw-2rem)] max-w-xs p-2"
          >
            <div className="flex flex-col gap-3">
              {groups.map((group) => (
                <div key={group.label} className="flex flex-col gap-1">
                  <span className="px-2 pb-1 text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    {group.label}
                  </span>
                  {group.tabs.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => navigate(value)}
                      className={`flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm ${
                        activeTab === value
                          ? "bg-accent-soft text-accent"
                          : "text-foreground hover:bg-secondary"
                      }`}
                    >
                      <Icon size={14} />
                      {label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Desktop — vertical rail grouped by theme */}
        <TabsList className="hidden md:flex md:w-full md:flex-col md:items-stretch md:gap-4 md:rounded-2xl md:border md:border-border md:bg-panel md:p-3">
          {groups.map((group) => (
            <div
              key={group.label}
              className="flex md:flex-col md:items-stretch md:gap-1"
            >
              <span className="px-2 pb-1 text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                {group.label}
              </span>
              {group.tabs.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="shrink-0 gap-1.5 rounded-lg px-3 py-2 text-sm data-[state=active]:bg-accent-soft data-[state=active]:text-accent md:w-full md:justify-start md:after:hidden"
                >
                  <Icon size={14} />
                  {label}
                </TabsTrigger>
              ))}
            </div>
          ))}
        </TabsList>
      </div>

      <div className="min-w-0 flex-1">
        <TabsContent value="profil">
          <div
            data-tour="account-profile-badges"
            className="flex flex-col gap-4"
          >
            {hasSession ? <ProfileHeroSection /> : null}
            <BadgesSection />
          </div>
        </TabsContent>

        <TabsContent value="preferences">
          <div className="flex flex-col gap-4">
            <AppearanceSection />
            <LanguageSection currentLocale={locale} />
          </div>
        </TabsContent>

        <TabsContent value="securite">
          <SecurityMasterDetail detailOpen={securityDetailOpen} />
        </TabsContent>

        <TabsContent value="notifications">
          <div className="flex flex-col gap-4">
            <PushNotificationsSection labels={pushNotificationLabels} />
            <EmailNotificationsSection labels={emailNotificationLabels} />
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
      </div>
    </Tabs>
  );
}
