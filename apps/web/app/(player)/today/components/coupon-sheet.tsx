import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Sheet } from "@/components/scoreboard/sheet/sheet";
import { activePause } from "@/components/scoreboard/states/paused-screen";
import { ChanceFigure } from "@/components/scoreboard/ui/chance-figure";
import { FormStrip } from "@/components/scoreboard/ui/form-strip";
import { ResultMark } from "@/components/scoreboard/ui/result-mark";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import { getToday } from "@/domains/today/use-cases/get-today";
import {
  displayLocaleOf,
  formatOdds,
  formatShare,
  formatTime,
  type DisplayLocale,
} from "@/helpers/scoreboard-format";
import type {
  TodayCoupon,
  TodayLeg,
  TodayProductForm,
} from "@/domains/today/types/today";
import { CouponValue } from "./coupon-value";
import { FollowButton } from "./follow-button";
import { TeamMark } from "./team-mark";
import { legPickLabel } from "./today-constants";

/**
 * A coupon of « Aujourd'hui » and its product's form, read from the same
 * answer as the screen (GET /today: today's coupons and the followed ones
 * still running). Unknown: 404.
 */
export async function findTodayCoupon(
  id: string,
): Promise<{ coupon: TodayCoupon; form: TodayProductForm | undefined }> {
  const today = await getToday();
  const coupon = [...today.coupons, ...today.followedInProgress].find(
    (candidate) => candidate.id === id,
  );
  if (!coupon) notFound();
  return {
    coupon,
    form: today.forms.find((form) => form.product === coupon.product),
  };
}

/** The sheet's title: the product, a hunter with its band (04 § 1). */
export async function couponSheetTitle(coupon: TodayCoupon): Promise<string> {
  const [t, locale] = await Promise.all([
    getTranslations("today"),
    getLocale(),
  ]);
  const name = t(`products.${coupon.product}`);
  if (!coupon.oddsBand) return name;
  const display = displayLocaleOf(locale);
  return `${name} · ${t("band", {
    min: formatOdds(coupon.oddsBand.min, display),
    max: formatOdds(coupon.oddsBand.max, display),
  })}`;
}

/**
 * The band of the sheet: the chance and its diodes, the 1xBet odds (✓ or
 * ✗ once settled). The three figures of the budget, no other (04 § 1).
 */
export async function CouponSheetBand({ coupon }: { coupon: TodayCoupon }) {
  const locale = displayLocaleOf(await getLocale());
  return (
    <div className="flex items-center justify-between gap-4">
      {coupon.chance !== null ? (
        <ChanceFigure probability={coupon.chance} tone="band" size="md" />
      ) : (
        <span />
      )}
      <CouponValue coupon={coupon} locale={locale} size="hero" />
    </div>
  );
}

/** « Suivre » at the bottom, or « Suivi » once the first match started. */
export async function CouponSheetFooter({ coupon }: { coupon: TodayCoupon }) {
  const t = await getTranslations("today");
  if (coupon.canFollow) {
    return (
      <FollowButton
        couponId={coupon.id}
        followed={coupon.followedByMe}
        labels={{
          follow: t("follow"),
          followed: t("followed"),
          error: t("followError"),
        }}
      />
    );
  }
  if (!coupon.followedByMe) return null;
  return (
    <p className="flex items-center gap-2 text-body font-medium">
      <ResultMark kind="won" colored={false} size="sm" />
      {t("followedDone")}
    </p>
  );
}

/**
 * The coupon opened (04 § 1, maquette Coupon): one block per match in
 * kick-off order (logos, teams, time and competition, the bet named with
 * its team and its odds, its one fact), then the product's form over 30
 * days, its worst run, and what 1xBet keeps. Nothing else: no reference
 * odds, no closing, no joint probability.
 */
export async function CouponSheetBody({
  coupon,
  form,
}: {
  coupon: TodayCoupon;
  form: TodayProductForm | undefined;
}) {
  const [t, locale, timeZone] = await Promise.all([
    getTranslations("today"),
    getLocale(),
    getPlayerTimeZone(),
  ]);
  const display = displayLocaleOf(locale);
  const legs = [...coupon.legs].sort((a, b) =>
    a.kickoffAt.localeCompare(b.kickoffAt),
  );

  return (
    <div className="flex flex-col divide-y divide-border">
      {legs.map((leg) => (
        <LegBlock
          key={leg.fixtureId}
          leg={leg}
          locale={display}
          timeZone={timeZone}
          labels={{
            inProgress: t("inProgress"),
            postponed: t("postponed"),
            won: t("won"),
            lost: t("lost"),
            refunded: t("refunded"),
          }}
        />
      ))}

      {form && form.days.length > 0 ? (
        <section className="flex flex-col gap-2 py-4">
          <h3 className="text-meta text-muted-foreground">{t("formTitle")}</h3>
          <FormStrip
            outcomes={form.days.map((day) => day.outcome)}
            size="sm"
            label={t("formSummary", { won: form.won, played: form.played })}
          />
          <p className="flex flex-wrap gap-x-2 text-body">
            <span className="score font-semibold">
              {t("formSummary", { won: form.won, played: form.played })}
            </span>
            <span className="text-muted-foreground">
              · {t("worstStreak", { count: form.worstLosingStreak })}
            </span>
          </p>
        </section>
      ) : null}

      {coupon.operatorKeep !== null ? (
        <p className="py-4 text-body text-muted-foreground">
          {t(coupon.legs.length > 1 ? "keepCoupon" : "keepBet", {
            share: formatShare(coupon.operatorKeep, display),
          })}
        </p>
      ) : null}
    </div>
  );
}

function LegBlock({
  leg,
  locale,
  timeZone,
  labels,
}: {
  leg: TodayLeg;
  locale: DisplayLocale;
  timeZone: string;
  labels: {
    inProgress: string;
    postponed: string;
    won: string;
    lost: string;
    refunded: string;
  };
}) {
  const muted = leg.state === "postponed" || leg.state === "void";
  const status =
    leg.state === "live"
      ? labels.inProgress
      : leg.state === "postponed"
        ? labels.postponed
        : formatTime(new Date(leg.kickoffAt), locale, timeZone);

  return (
    <article
      className={
        muted
          ? "flex flex-col gap-2 py-4 text-muted-foreground"
          : "flex flex-col gap-2 py-4"
      }
    >
      {(
        [
          [leg.home, leg.score?.home, status],
          [leg.away, leg.score?.away, leg.competition.name],
        ] as const
      ).map(([team, goals, aside]) => (
        <div key={team.name} className="flex items-center gap-2.5">
          <TeamMark team={team} />
          <span className="flex-1 text-bet font-medium">{team.name}</span>
          {goals !== undefined ? (
            <span className="score text-title font-bold">{goals}</span>
          ) : (
            <span className="score text-meta text-muted-foreground">
              {aside}
            </span>
          )}
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-3 ps-[2.375rem]">
        <span className="text-body font-medium">{legPickLabel(leg)}</span>
        <span className="flex items-center gap-2">
          {leg.state === "won" ||
          leg.state === "lost" ||
          leg.state === "void" ? (
            <ResultMark
              kind={leg.state}
              label={leg.state === "void" ? labels.refunded : labels[leg.state]}
            />
          ) : null}
          {leg.odds !== null ? (
            <span className="score text-bet font-semibold">
              {formatOdds(leg.odds, locale)}
            </span>
          ) : null}
        </span>
      </div>
      {leg.fact ? (
        <p className="ps-[2.375rem] text-body text-muted-foreground">
          {leg.fact}
        </p>
      ) : null}
    </article>
  );
}

/**
 * The opened coupon in the sheet, the same on a tap (intercepted route) and
 * on a shared link or a reload (the `@sheet` slot's own page, over the
 * « Aujourd'hui » screen).
 */
export async function CouponSheet({ id }: { id: string }) {
  // Paused: the screen shows the pause and the server would refuse the read.
  if (await activePause()) return null;
  const { coupon, form } = await findTodayCoupon(id);
  return (
    <Sheet
      title={await couponSheetTitle(coupon)}
      fallbackHref="/today"
      tone="band"
      bandContent={<CouponSheetBand coupon={coupon} />}
      footer={<CouponSheetFooter coupon={coupon} />}
    >
      <CouponSheetBody coupon={coupon} form={form} />
    </Sheet>
  );
}
