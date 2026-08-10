"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { driver, type Driver } from "driver.js";
import { clientApiRequest } from "@/lib/api/client-api";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useCurrentUser,
  useSetCurrentUser,
} from "@/domains/auth/context/current-user-context";
import { ONBOARDING_STEPS } from "../onboarding-steps";

type OnboardingTourContextValue = {
  startTour: () => void;
};

const OnboardingTourContext = createContext<OnboardingTourContextValue | null>(
  null,
);

// Mounted once in dashboard/layout.tsx, wrapping AppShell — a single
// driver.js instance drives every step in ONBOARDING_STEPS. Most steps live
// on their own route: onNextClick/onPrevClick push the route first, then
// let driver.js's own `waitForElement` (per step) pick up the target once
// the new page has mounted, instead of us hand-rolling a polling effect.
export function OnboardingTourProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const currentUser = useCurrentUser();
  const setCurrentUser = useSetCurrentUser();

  const driverRef = useRef<Driver | null>(null);
  // Which steps startTour() is currently driving through — a filtered view
  // of ONBOARDING_STEPS (mobile-only steps dropped on desktop). onNextClick/
  // onPrevClick must index into THIS array, not the unfiltered constant,
  // since opts.index refers to a position in whatever `steps` was passed to
  // driver().
  const activeStepsRef = useRef(ONBOARDING_STEPS);
  const hasAutoStartedRef = useRef(false);
  const finishedRef = useRef(false);
  // Read inside driver.js hooks created once per startTour() call — a ref
  // keeps them seeing the latest pathname without recreating the instance.
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  const isMobileRef = useRef(isMobile);
  useEffect(() => {
    isMobileRef.current = isMobile;
  }, [isMobile]);

  // Any way out (close button, Escape, overlay click, or finishing the
  // last step) counts as "seen" — a tour closed early is a normal outcome
  // (doc §6: "un tour trop long se ferme sans être lu"), not a failure to
  // re-nag about on the next login. Replayable anytime via "Revoir le
  // guide" regardless of this flag.
  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    driverRef.current?.destroy();
    driverRef.current = null;
    if (!currentUser.hasSeenOnboarding) {
      setCurrentUser({ ...currentUser, hasSeenOnboarding: true });
      void clientApiRequest("/auth/me", {
        method: "PATCH",
        body: { hasSeenOnboarding: true },
      });
    }
  }, [currentUser, setCurrentUser]);

  const startTour = useCallback(() => {
    driverRef.current?.destroy();
    finishedRef.current = false;

    const activeSteps = ONBOARDING_STEPS.filter(
      (step) => !step.mobileOnly || isMobileRef.current,
    );
    activeStepsRef.current = activeSteps;

    // driver.js decides its own Next-vs-Done button (and which handler to
    // fire) by checking whether the NEXT step's element already exists on
    // the CURRENT page — a lookahead that has no idea we're about to
    // router.push() there. Most transitions "happen" to pass that check by
    // coincidence (global shell elements like Eva/the bell/account menu
    // exist on every page), but the first transition onto a page-specific
    // element that isn't the current page fails it — driver.js concludes
    // "no next step" and fires onDoneClick instead of onNextClick, ending
    // the tour early. Fix: both handlers below run the exact same logic,
    // driven by OUR OWN activeStepsRef bounds — never driver.js's guess —
    // and each step's popover.nextBtnText is set explicitly so the label
    // matches our real "is this the last step" answer too.
    const handleAdvance = (opts: { index?: number; driver: Driver }) => {
      const nextIndex = (opts.index ?? 0) + 1;
      const nextStep = activeStepsRef.current[nextIndex];
      if (!nextStep) {
        finish();
        return;
      }
      if (nextStep.route && nextStep.route !== pathnameRef.current) {
        router.push(nextStep.route);
      }
      opts.driver.moveNext();
    };

    const instance = driver({
      allowClose: true,
      overlayColor: "#0d1520",
      overlayOpacity: 0.65,
      stagePadding: 6,
      stageRadius: 12,
      prevBtnText: t("prev"),
      steps: activeSteps.map((step, index) => ({
        element: step.selector ?? undefined,
        popover: {
          title: t(step.titleKey),
          description: t(step.descriptionKey),
          nextBtnText: index === activeSteps.length - 1 ? t("done") : t("next"),
          // Same reasoning as nextBtnText: driver.js would otherwise
          // disable "previous" based on its own current-page lookahead
          // instead of our activeStepsRef bounds check in onPrevClick.
          disableButtons: index === 0 ? (["previous"] as const) : [],
        },
        waitForElement: 2500,
        skipMissingElement: true,
      })),
      onCloseClick: () => finish(),
      // Safety net: driver.js's own internal skipMissingElement cascade can
      // in theory run off the end of the steps array and self-destroy
      // without going through any of our click handlers — make sure
      // finish() (marking hasSeenOnboarding, cleaning up driverRef) still
      // runs if that ever happens.
      onDestroyStarted: () => finish(),
      onDoneClick: (_element, _step, opts) => handleAdvance(opts),
      onNextClick: (_element, _step, opts) => handleAdvance(opts),
      onPrevClick: (_element, _step, opts) => {
        const prevIndex = (opts.index ?? 0) - 1;
        if (prevIndex < 0) return;
        const prevRoute = activeStepsRef.current[prevIndex]?.route;
        if (prevRoute && prevRoute !== pathnameRef.current) {
          router.push(prevRoute);
        }
        opts.driver.movePrevious();
      },
    });

    driverRef.current = instance;
    instance.drive(0);
  }, [t, router, finish]);

  useEffect(() => {
    if (hasAutoStartedRef.current) return;
    if (currentUser.hasSeenOnboarding) return;
    hasAutoStartedRef.current = true;
    startTour();
    // Auto-start only reacts to the initial hasSeenOnboarding value — a
    // manual replay uses startTour() directly, not this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      driverRef.current?.destroy();
    };
  }, []);

  return (
    <OnboardingTourContext.Provider value={{ startTour }}>
      {children}
    </OnboardingTourContext.Provider>
  );
}

export function useOnboardingTour(): OnboardingTourContextValue {
  const ctx = useContext(OnboardingTourContext);
  if (!ctx) {
    throw new Error(
      "useOnboardingTour must be used within OnboardingTourProvider",
    );
  }
  return ctx;
}
