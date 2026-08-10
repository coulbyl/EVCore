export type OnboardingStep = {
  id: string;
  // Route to navigate to before showing this step — null keeps the current
  // page (used by the welcome step and the last step, which targets the
  // header bell that's present on every dashboard page).
  route: string | null;
  // CSS selector of the element to highlight — null renders a centered
  // popover with no target (driver.js's default for element-less steps).
  selector: string | null;
  titleKey: string;
  descriptionKey: string;
};

// Sequence from doc perf-ux-audit §6.2: Décisions → Investir → Coupons →
// Inbox/notifications, capped at 5-6 steps. Page steps target the "?"
// Formation link (always rendered, independent of the day's data) rather
// than a dynamic pick/coupon card, so the tour never breaks on an empty
// list.
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    route: null,
    selector: null,
    titleKey: "welcome.title",
    descriptionKey: "welcome.description",
  },
  {
    id: "decisions",
    route: "/dashboard/decisions",
    selector: '[data-tour="decisions-help"]',
    titleKey: "decisions.title",
    descriptionKey: "decisions.description",
  },
  {
    id: "investment",
    route: "/dashboard/investment",
    selector: '[data-tour="investment-help"]',
    titleKey: "investment.title",
    descriptionKey: "investment.description",
  },
  {
    id: "coupons",
    route: "/dashboard/coupons",
    selector: '[data-tour="coupons-help"]',
    titleKey: "coupons.title",
    descriptionKey: "coupons.description",
  },
  {
    id: "notifications",
    route: null,
    selector: '[data-tour="notification-bell"]',
    titleKey: "notifications.title",
    descriptionKey: "notifications.description",
  },
];
