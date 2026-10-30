import { formatLinePick, formatPickWithTeams } from "@/helpers/fixture";
import type { Outcome } from "@/components/scoreboard/ui/outcome";
import type {
  TodayCoupon,
  TodayCouponState,
  TodayLeg,
  TodayProductForm,
  TodayProductKey,
} from "@/domains/today/types/today";

/** The hero's form: the product's last ten played days (02 § 1). */
export const HERO_FORM_DAYS = 10;

/** The bet named with its team: « Victoire PSG », « Plus de 9,5 corners ». */
export function legPickLabel(leg: TodayLeg): string {
  return (
    formatLinePick(leg.pick, leg.market, leg.line) ??
    formatPickWithTeams(leg.pick, leg.market, {
      home: leg.home.name,
      away: leg.away.name,
    })
  );
}

/** The last `count` settled days of a product, oldest first. */
export function recentForm(
  form: TodayProductForm | undefined,
  count: number,
): Outcome[] {
  return (form?.days ?? []).slice(-count).map((day) => day.outcome);
}

/** The first match's kick-off of the coupons still to come, if any. */
export function nextKickoff(coupons: readonly TodayCoupon[]): Date | null {
  const upcoming = coupons
    .flatMap((coupon) => coupon.legs)
    .filter((leg) => leg.state === "upcoming")
    .map((leg) => new Date(leg.kickoffAt))
    .sort((a, b) => a.getTime() - b.getTime());
  return upcoming[0] ?? null;
}

/** Screen order of the products, for the « Hier » line and the rows. */
export const PRODUCT_ORDER: readonly TodayProductKey[] = [
  "FAVOURITE",
  "COMBO",
  "DOUBLE",
  "HUNTER_BTTS",
  "HUNTER_DRAW",
  "HUNTER_SCORE",
  "HUNTER_CORNERS",
];

/** Réglé : la carte montre ✓, ✗ ou « Remboursé » à la place de la cote. */
export function isSettled(state: TodayCouponState): boolean {
  return state === "won" || state === "lost" || state === "void";
}

/** Les matchs encore joués : un match reporté sort du compte (04 § 5). */
export function playedLegs(coupon: TodayCoupon): TodayLeg[] {
  return coupon.legs.filter((leg) => leg.state !== "postponed");
}
