export type OnboardingStep = {
  id: string;
  // Route to navigate to before showing this step — null keeps the current
  // page (shell elements like the header bell/account menu are present on
  // every dashboard page, so no navigation is needed for those).
  route: string | null;
  // CSS selector of the element to highlight — null renders a centered
  // popover with no target (driver.js's default for element-less steps).
  selector: string | null;
  titleKey: string;
  descriptionKey: string;
  // Only shown when the tour starts on a mobile viewport (checked once at
  // startTour() time) — e.g. the hamburger drawer trigger doesn't exist in
  // the DOM in a visible state on desktop (`lg:hidden`).
  mobileOnly?: boolean;
};

// Full tour requested after the initial 5-step version — every page/section
// reachable by a regular user, no admin-only screens (a non-admin can't see
// them, so pointing the tour at them would break for most users). Page steps
// target a stable, always-rendered anchor (title, header, summary section)
// rather than a dynamic list item, so the tour never breaks on an empty
// list/table for that day.
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    route: null,
    selector: null,
    titleKey: "welcome.title",
    descriptionKey: "welcome.description",
  },
  {
    id: "mobileNav",
    route: null,
    selector: '[data-tour="mobile-nav-trigger"]',
    titleKey: "mobileNav.title",
    descriptionKey: "mobileNav.description",
    mobileOnly: true,
  },
  {
    id: "dashboardFilter",
    route: "/dashboard",
    selector: '[data-tour="dashboard-filter"]',
    titleKey: "dashboardFilter.title",
    descriptionKey: "dashboardFilter.description",
  },
  {
    id: "dashboardPerformance",
    route: null,
    selector: '[data-tour="dashboard-performance"]',
    titleKey: "dashboardPerformance.title",
    descriptionKey: "dashboardPerformance.description",
  },
  {
    id: "dashboardRanking",
    route: null,
    selector: '[data-tour="dashboard-ranking"]',
    titleKey: "dashboardRanking.title",
    descriptionKey: "dashboardRanking.description",
  },
  {
    id: "decisions",
    route: "/dashboard/decisions",
    selector: '[data-tour="decisions-help"]',
    titleKey: "decisions.title",
    descriptionKey: "decisions.description",
  },
  {
    id: "fixtures",
    route: "/dashboard/fixtures",
    selector: '[data-tour="fixtures-indices"]',
    titleKey: "fixtures.title",
    descriptionKey: "fixtures.description",
  },
  {
    id: "coupons",
    route: "/dashboard/coupons",
    selector: '[data-tour="coupons-help"]',
    titleKey: "coupons.title",
    descriptionKey: "coupons.description",
  },
  {
    id: "betSlipComposer",
    route: null,
    selector: '[data-tour="bet-slip-composer"]',
    titleKey: "betSlipComposer.title",
    descriptionKey: "betSlipComposer.description",
  },
  {
    id: "betSlips",
    route: "/dashboard/bet-slips",
    selector: '[data-tour="bet-slips-summary"]',
    titleKey: "betSlips.title",
    descriptionKey: "betSlips.description",
  },
  {
    id: "bankroll",
    route: "/dashboard/bankroll",
    selector: '[data-tour="bankroll-summary"]',
    titleKey: "bankroll.title",
    descriptionKey: "bankroll.description",
  },
  {
    id: "trackRecord",
    route: "/dashboard/track-record",
    selector: '[data-tour="track-record-title"]',
    titleKey: "trackRecord.title",
    descriptionKey: "trackRecord.description",
  },
  {
    id: "formation",
    route: "/dashboard/formation",
    selector: '[data-tour="formation-title"]',
    titleKey: "formation.title",
    descriptionKey: "formation.description",
  },
  {
    id: "inbox",
    route: "/dashboard/inbox",
    selector: '[data-tour="inbox-thread"]',
    titleKey: "inbox.title",
    descriptionKey: "inbox.description",
  },
  {
    id: "updates",
    route: "/dashboard/updates",
    selector: '[data-tour="updates-title"]',
    titleKey: "updates.title",
    descriptionKey: "updates.description",
  },
  {
    id: "evaFab",
    route: null,
    selector: '[data-tour="eva-fab"]',
    titleKey: "evaFab.title",
    descriptionKey: "evaFab.description",
  },
  {
    id: "pageSearchFab",
    route: null,
    selector: '[data-tour="page-search-fab"]',
    titleKey: "pageSearchFab.title",
    descriptionKey: "pageSearchFab.description",
  },
  {
    id: "notifications",
    route: null,
    selector: '[data-tour="notification-bell"]',
    titleKey: "notifications.title",
    descriptionKey: "notifications.description",
  },
  {
    id: "accountMenu",
    route: null,
    selector: '[data-tour="account-menu-trigger"]',
    titleKey: "accountMenu.title",
    descriptionKey: "accountMenu.description",
  },
  {
    id: "profileBadges",
    route: "/dashboard/params/account/profil",
    selector: '[data-tour="account-profile-badges"]',
    titleKey: "profileBadges.title",
    descriptionKey: "profileBadges.description",
  },
  {
    id: "accountSettings",
    route: null,
    selector: '[data-tour="account-tabs-list"]',
    titleKey: "accountSettings.title",
    descriptionKey: "accountSettings.description",
  },
];
