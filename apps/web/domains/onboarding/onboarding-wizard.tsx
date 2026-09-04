"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@evcore/ui";
import { clientApiRequest } from "@/lib/api/client-api";
import {
  useCurrentUser,
  useSetCurrentUser,
} from "@/domains/auth/context/current-user-context";
import { FollowedLeaguesCard } from "@/app/dashboard/params/account/components/followed-leagues-card";
import { FollowedChannelsCard } from "@/app/dashboard/params/account/components/followed-channels-card";
import { RiskProfileCard } from "@/app/dashboard/params/account/components/risk-profile-card";

const TOTAL_STEPS = 3;

/**
 * Active onboarding (3 steps: leagues, channels, risk profile) — distinct
 * from the passive product tour (domains/product-tour/), which only ever
 * points at existing UI, never collects anything. Reuses the exact same
 * cards/hooks as the Personalization tab (§8) rather than duplicating the
 * fetch/mutation logic — a selection here is the same
 * follow/unfollow/PATCH-/auth/me call, just made from a first-run wizard
 * instead of Paramètres.
 *
 * Every step is skippable (doc §0 point 6) — none of these are required to
 * use the product, and all three can be revisited later from
 * Personnalisation. Closing the dialog (X, Escape, overlay click) behaves
 * like finishing on the current step: it marks the wizard done rather than
 * reappearing on every subsequent page load, which would read as broken
 * rather than dismissible.
 */
export function OnboardingWizard() {
  const t = useTranslations("onboarding");
  const currentUser = useCurrentUser();
  const setCurrentUser = useSetCurrentUser();
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const open = !currentUser.hasCompletedOnboarding;
  const isLastStep = step === TOTAL_STEPS - 1;

  async function finish() {
    if (finishing) return;
    setFinishing(true);
    setCurrentUser({ ...currentUser, hasCompletedOnboarding: true });
    await clientApiRequest("/auth/me", {
      method: "PATCH",
      body: { hasCompletedOnboarding: true },
      fallbackErrorMessage: "Impossible d'enregistrer votre progression.",
    });
  }

  function handleAdvance() {
    if (isLastStep) {
      void finish();
      return;
    }
    setStep((s) => s + 1);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && void finish()}>
      <DialogContent className="max-w-lg gap-5">
        <DialogHeader>
          <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {t("stepCounter", { step: step + 1, total: TOTAL_STEPS })}
          </p>
          {/* Generic, not per-step: each card below already carries its own
              specific heading (eyebrow + subtitle via SettingsSectionCard,
              same "leaguesTitle"/"channelsTitle"/"riskProfileTitle" strings
              Personnalisation uses) — repeating a step-specific title here
              would just say the same thing twice, same redundancy already
              fixed elsewhere (Decisions' channel badge, Coupons' canal
              badge). */}
          <DialogTitle>{t("title")}</DialogTitle>
          {/* Genuinely useful here (unlike the bet slip drawer's sr-only
              fix, same underlying Radix warning) — a first-run wizard
              benefits from stating up front that nothing is mandatory. */}
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-[16rem]">
          {step === 0 && <FollowedLeaguesCard />}
          {step === 1 && <FollowedChannelsCard />}
          {step === 2 && <RiskProfileCard />}
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={handleAdvance}
            disabled={finishing}
          >
            {t("skip")}
          </Button>
          <Button type="button" onClick={handleAdvance} disabled={finishing}>
            {isLastStep ? t("finish") : t("next")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
