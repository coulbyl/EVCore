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

const OnboardingTourContext =
  createContext<OnboardingTourContextValue | null>(null);

// Mounted once in dashboard/layout.tsx, wrapping AppShell — a single
// driver.js instance drives every step in ONBOARDING_STEPS. Most steps live
// on their own route: onNextClick/onPrevClick push the route first, then
// let driver.js's own `waitForElement` (per step) pick up the target once
// the new page has mounted, instead of us hand-rolling a polling effect.
export function OnboardingTourProvider({
  children,
}: {
  children: ReactNode;
}) {
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

    const instance = driver({
      allowClose: true,
      overlayColor: "#0d1520",
      overlayOpacity: 0.65,
      stagePadding: 6,
      stageRadius: 12,
      nextBtnText: t("next"),
      prevBtnText: t("prev"),
      doneBtnText: t("done"),
      steps: activeSteps.map((step) => ({
        element: step.selector ?? undefined,
        popover: {
          title: t(step.titleKey),
          description: t(step.descriptionKey),
        },
        waitForElement: 2500,
        skipMissingElement: true,
      })),
      onCloseClick: () => finish(),
      onDoneClick: () => finish(),
      onNextClick: (_element, _step, opts) => {
        const nextIndex = (opts.index ?? 0) + 1;
        const nextRoute = activeStepsRef.current[nextIndex]?.route;
        if (nextRoute && nextRoute !== pathnameRef.current) {
          router.push(nextRoute);
        }
        opts.driver.moveNext();
      },
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
