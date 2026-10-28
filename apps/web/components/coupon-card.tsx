"use client";

import { useState } from "react";
import { Check, MessageCircle, ShoppingCart, Sun, Tag } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  cn,
} from "@evcore/ui";
import { useTranslations } from "next-intl";
import { FixtureCardHeader } from "@/components/fixture-card-header";
import { formatOddsValue as formatOdds, frequencyOf } from "@/lib/frequency";
import { ResultBadge, type ResultValue } from "@/components/result-badge";
import { ClosingLine } from "@/components/closing-line";

export type NormalizedCouponLeg = {
  key: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  country: string | null;
  competition: string | null;
  kickoff: string;
  score: string | null;
  htScore: string | null;
  marketLabel: string;
  pickLabel: string;
  probability: number;
  /** Fréquence affichée : probabilité du marché, marge retirée. */
  marketProbability: number | null;
  odds: string | null;
  /** Cote chez le book de l'utilisateur (1xBet), sinon la plus basse relevée. */
  playable?: { odds: number; bookmaker: string } | null;
  result: ResultValue | null;
  /**
   * Ligne de clôture de la jambe quand elle est connue : cote juste avant le
   * coup d'envoi et valeur prise dessus (cote proposée × probabilité de
   * clôture sans marge − 1). C'est la seule mesure qui dise, avant même le
   * résultat, si le prix proposé avait de la valeur.
   */
  closing?: { odds: number; bookmaker: string | null; value: number } | null;
};

export type CouponCardProps = {
  locale: string;
  /**
   * Classe du coupon — porte le libellé ET la fréquence de gain mesurée. Une
   * cote de 12 sans « 1 gagnant sur 11 » à côté se lit comme « la même chose
   * en mieux », ce que la mesure contredit.
   */
  couponClass?: {
    label: string;
    frequency: string;
    badgeVariant: string;
  } | null;
  /**
   * Relevé réel du produit sur la fenêtre : jours gagnés, jours réglés,
   * retour d'une mise de 1 et dates exactes. Seule source de la ligne de
   * relevé : plus de fréquence simulée affichée (règles de rédaction,
   * apps/web/PRODUCT.md), et un taux de gain ne s'affiche jamais sans le
   * résultat à mise fixe qui va avec.
   */
  trackRecord?: {
    won: number;
    settled: number;
    returnPerUnit: number;
    firstDay: string;
    lastDay: string;
    /** Plus longue suite de coupons perdus d'affilée (principe 2). */
    worstLosingStreak: number;
  } | null;
  combinedOdds: number;
  /**
   * Cote réellement payée au règlement (jambes remboursées exclues). Affichée
   * à côté de la cote proposée dès qu'elles diffèrent : un PARTIAL payé à 3,1
   * sur un coupon annoncé à 4,3 ne doit pas se lire comme un gain à 4,3.
   */
  realizedOdds?: number | null;
  /** Probabilité du marché de toutes les jambes ; null s'il en manque une. */
  jointProbability: number | null;
  signalScore: number;
  reasoning?: string | null;
  /**
   * "intraday" = régénéré dans la fenêtre proche du coup d'envoi, en plus du
   * batch du soir déjà publié pour cette classe — un utilisateur peut donc
   * voir deux coupons de la même classe le même jour. Pas de badge pour
   * "evening" (le batch par défaut, sans rien de particulier à signaler),
   * même convention que ResultBadge (rien tant qu'il n'y a rien à dire).
   */
  batch?: "evening" | "intraday";
  /**
   * Générateur à l'origine du coupon. Les deux sources visent la même cote, et
   * un écran qui ne les distingue pas montre deux produits comme s'il n'y en
   * avait qu'un. Toujours affiché, y compris pour l'analyse : un badge qui
   * n'apparaît que sur l'une des deux se lit comme une mise en garde.
   */
  source?: { label: string; hint: string } | null;
  // Plus de compteurs « N vues · N ont joué » : une preuve sociale pousse à
  // jouer (PRODUCT.md, principe 5 ; revue UX du 2026-10-27, Coupons P2-7).
  betStatus?: "WON" | "LOST" | "PARTIAL" | "VOID" | null;
  legs: NormalizedCouponLeg[];
  actionSlot?: React.ReactNode;
};

/**
 * Cote combinée chez le bookmaker des joueurs, quand toutes les jambes y sont
 * cotées chez le même : c'est ce que le ticket paiera.
 */
function playableCombined(
  legs: NormalizedCouponLeg[],
): { odds: number; bookmaker: string } | null {
  if (legs.length === 0 || legs.some((leg) => !leg.playable)) return null;
  const bookmakers = new Set(legs.map((leg) => leg.playable!.bookmaker));
  const [bookmaker] = [...bookmakers];
  if (bookmakers.size !== 1 || bookmaker === undefined) return null;
  return {
    odds: legs.reduce((acc, leg) => acc * leg.playable!.odds, 1),
    bookmaker,
  };
}

/**
 * Une explication ouvrable au doigt : HoverCard contrôlée, même motif que
 * ClosingLine. Un `title=` ou une HoverCard au survol ne s'ouvrent jamais sur
 * téléphone (PRODUCT.md, accessibilité).
 */
function TapHint({
  hint,
  className,
  children,
}: {
  hint: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <HoverCard
      open={open}
      onOpenChange={setOpen}
      openDelay={150}
      closeDelay={100}
    >
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          // Zone de toucher étendue de 12 px en haut et en bas sans changer
          // le dessin de la puce : 44 px au doigt pour une puce de 22 px.
          className={cn(
            "relative cursor-help text-left after:absolute after:inset-x-0 after:-inset-y-3 after:content-['']",
            className,
          )}
        >
          {children}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 text-xs leading-snug text-foreground">
        {hint}
      </HoverCardContent>
    </HoverCard>
  );
}

/** Sous ce nombre de jours réglés, pas de taux : « relevé en cours ». */
const MIN_SETTLED_FOR_RECORD = 5;

/** « 2026-10-16 » → « 16/10 ». */
function shortDay(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

/** Retour d'une mise de 1 → résultat signé : 0,97 → « −3 % », 1,02 → « +2 % ». */
function fixedStakeLabel(returnPerUnit: number): string {
  const pct = Math.round((returnPerUnit - 1) * 100);
  if (pct === 0) return "0\u00a0%";
  return `${pct > 0 ? "+" : "\u2212"}${Math.abs(pct)}\u00a0%`;
}

type CardT = ReturnType<typeof useTranslations>;

/**
 * La ligne de relevé d'un produit : toujours ses dates, son effectif et son
 * résultat à mise fixe ; rien de plus qu'un « relevé en cours » tant qu'il
 * a trop peu de jours réglés.
 */
function trackRecordLines(
  record: CouponCardProps["trackRecord"],
  t: CardT,
): { line: string; detail: string | null } {
  if (!record || record.settled === 0) {
    return { line: t("noRecord"), detail: null };
  }
  if (record.settled < MIN_SETTLED_FOR_RECORD) {
    return {
      line: t("recordInProgress", { count: record.settled }),
      detail: null,
    };
  }
  return {
    line: t("record", {
      won: record.won,
      settled: record.settled,
      from: shortDay(record.firstDay),
      to: shortDay(record.lastDay),
    }),
    detail: t("recordDetail", {
      streak: record.worstLosingStreak,
      result: fixedStakeLabel(record.returnPerUnit),
    }),
  };
}

export function CouponCard({
  locale,
  couponClass = null,
  trackRecord = null,
  source = null,
  combinedOdds,
  realizedOdds = null,
  jointProbability,
  reasoning,
  batch,
  betStatus,
  legs,
  actionSlot,
}: CouponCardProps) {
  const t = useTranslations("couponCard");
  const record = couponClass ? trackRecordLines(trackRecord, t) : null;
  const playable = playableCombined(legs);
  const playableDiffers =
    playable !== null && Math.abs(playable.odds - combinedOdds) >= 0.005;
  // Fréquence du marché (2026-10-28) : celle du moteur était optimiste de
  // 4 à 8 points.
  const chances =
    jointProbability !== null ? frequencyOf(jointProbability) : null;
  // Plus de couleur ni de seuils sur les chances : « 15 % » en rouge se lisait
  // comme une alerte, alors que c'est l'arithmétique d'une cote 6. La classe
  // porte déjà la fréquence de gain en clair (« 1 jour sur 7 »).

  return (
    <Card className={cn("gap-3 rounded-2xl py-3", "border-border/70")}>
      <CardHeader className="px-4">
        {/* Sur téléphone les tuiles (cote, payé, 1xBet, chances) passent
            sous le titre et se replient : en ligne avec `shrink-0`, quatre
            tuiles dépassaient 360 px et la carte débordait de l'écran
            (constaté le 2026-10-19 sur le combiné du jour). */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Plus de badge « Meilleur » : mesuré sur 5 passes, le coupon
                  de rang 1 n'est pas meilleur que les suivants (en classe SÛRE
                  il fait -7.5% quand le rang 2 fait +2.6%, tous les écarts
                  dans le bruit). On affichait une hiérarchie qu'on est
                  incapable de produire. */}
              {couponClass && (
                <Badge
                  variant={
                    couponClass.badgeVariant as "success" | "accent" | "warning"
                  }
                  className="rounded-full px-2 py-0.5 text-xs font-medium tracking-normal"
                >
                  {couponClass.label}
                </Badge>
              )}
              {/* Plus de « Coupon N » : le rang recommence à 1 dans chaque
                  classe, donc l'écran affichait « Coupon 1 » plusieurs fois.
                  Et il n'exprime aucune qualité — mesuré sur 5 passes, le rang
                  1 ne vaut pas mieux que le rang 2. */}
              {source && (
                <TapHint
                  hint={source.hint}
                  className="flex items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 text-xs font-medium text-muted-foreground"
                >
                  <Tag size={10} /> {source.label}
                </TapHint>
              )}
              {batch === "intraday" && (
                <TapHint
                  hint={t("intradayHint")}
                  className="flex items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 text-xs font-medium text-muted-foreground"
                >
                  <Sun size={10} /> {t("intraday")}
                </TapHint>
              )}
              {betStatus === "WON" && (
                <span
                  data-testid="coupon-result"
                  className="text-xs font-bold uppercase tracking-wide text-success"
                >
                  {t("resultWon")}
                </span>
              )}
              {betStatus === "PARTIAL" && (
                <TapHint
                  hint={t("resultPartialHint")}
                  className="text-xs font-bold uppercase tracking-wide text-success"
                >
                  <span data-testid="coupon-result">{t("resultPartial")}</span>
                </TapHint>
              )}
              {betStatus === "LOST" && (
                <span
                  data-testid="coupon-result"
                  className="text-xs font-bold uppercase tracking-wide text-destructive"
                >
                  {t("resultLost")}
                </span>
              )}
              {betStatus === "VOID" && (
                <TapHint
                  hint={t("resultVoidHint")}
                  className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
                >
                  <span data-testid="coupon-result">{t("resultVoid")}</span>
                </TapHint>
              )}
            </div>
            {/* Le relevé sur sa propre ligne : jours gagnés et dates, puis la
                pire série et le résultat à mise fixe (PRODUCT.md, principe
                2 : chaque produit dit à quelle fréquence il perd). */}
            {record && (
              <div className="mt-1.5 text-xs leading-5 text-muted-foreground">
                <p data-testid="coupon-track-record">{record.line}</p>
                {record.detail && (
                  <p data-testid="coupon-track-record-detail">
                    {record.detail}
                  </p>
                )}
              </div>
            )}
          </div>
          {/* La cote que le ticket paiera d'abord ; la nôtre, prise chez les
              books les plus généreux, en second et en gris (revue UX du
              2026-10-27, Coupons P1-3). */}
          <div className="flex flex-wrap items-center gap-3 sm:shrink-0 sm:justify-end">
            {playableDiffers && playable ? (
              <>
                <Metric
                  label={playable.bookmaker}
                  value={formatOdds(playable.odds, locale)}
                  testId="coupon-playable-odds"
                />
                <Metric
                  label={t("reference")}
                  value={formatOdds(combinedOdds, locale)}
                  valueClassName="font-normal text-muted-foreground"
                  testId="coupon-combined-odds"
                />
              </>
            ) : (
              <Metric
                label={playable ? playable.bookmaker : t("odds")}
                value={formatOdds(combinedOdds, locale)}
                testId="coupon-combined-odds"
              />
            )}
            {realizedOdds !== null &&
              Math.abs(realizedOdds - combinedOdds) > 0.005 && (
                <Metric
                  label={t("paid")}
                  value={formatOdds(realizedOdds, locale)}
                  valueClassName="text-success"
                  testId="coupon-realized-odds"
                />
              )}
            {chances ? (
              <Metric
                label={t("chances")}
                value={t("chancesValue", chances)}
                testId="coupon-chances"
              />
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-2.5 px-4">
        {/* Plus de barre de progression : elle répétait la tuile « Chances »
            sans légende et se lisait comme un chargement (revue UX du
            2026-10-24, P2 n°5). */}
        {/* Les jambes sont des rangées séparées par un filet, plus des cartes
            dans la carte (détecteur impeccable, `nested-cards` : 20 par page
            sur l'accueil, revue UX du 2026-10-24). */}
        <div className="flex flex-col divide-y divide-border/60 border-t border-border/60">
          {legs.map((leg) => (
            <CouponLegRow key={leg.key} leg={leg} locale={locale} />
          ))}
        </div>

        {reasoning && (
          <TapHint
            hint={reasoning}
            // Déjà 44 px : pas de zone étendue, elle mordrait sur le bouton
            // « Jouer ce coupon » juste en dessous.
            className="flex min-h-11 w-fit items-center gap-1.5 rounded-full border border-dashed border-border/70 bg-background/20 px-3 text-xs font-medium text-muted-foreground transition-colors after:hidden hover:text-foreground"
          >
            <MessageCircle size={11} />
            {t("why")}
          </TapHint>
        )}

        {actionSlot}
      </CardContent>
    </Card>
  );
}

function CouponLegRow({
  leg,
  locale,
}: {
  leg: NormalizedCouponLeg;
  locale: string;
}) {
  const t = useTranslations("couponCard");
  const referenceOdds = leg.odds !== null ? Number(leg.odds) : null;
  const playableDiffers =
    leg.playable != null &&
    referenceOdds !== null &&
    Math.abs(leg.playable.odds - referenceOdds) >= 0.005;
  const chances =
    leg.marketProbability !== null ? frequencyOf(leg.marketProbability) : null;
  return (
    <div data-testid="coupon-leg" className="py-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <FixtureCardHeader
          fixture={`${leg.homeTeam} vs ${leg.awayTeam}`}
          homeLogo={leg.homeLogo}
          awayLogo={leg.awayLogo}
          competition={leg.competition}
          country={leg.country}
          kickoff={leg.kickoff}
          score={leg.score}
          htScore={leg.htScore}
          locale={locale}
        />
        {/* Cote jouable d'abord, référence ensuite ; sans cote jouable, la
            nôtre seule. Les chiffres restent dans leur propre élément pour
            que la cote combinée se vérifie (e2e/coupons.spec.ts). */}
        <div className="flex shrink-0 flex-col items-end text-xs tabular-nums">
          {leg.playable && referenceOdds !== null && playableDiffers ? (
            <>
              <TapHint
                hint={t("legPlayableHint", {
                  bookmaker: leg.playable.bookmaker,
                })}
                className="font-semibold text-foreground"
              >
                {leg.playable.bookmaker}{" "}
                <span data-testid="leg-playable-odds">
                  {formatOdds(leg.playable.odds, locale)}
                </span>
              </TapHint>
              <span className="text-muted-foreground">
                {t("legReferencePrefix")}{" "}
                <span data-testid="leg-odds">
                  {formatOdds(referenceOdds, locale)}
                </span>
              </span>
            </>
          ) : referenceOdds !== null ? (
            <span className="font-semibold text-foreground">
              {leg.playable ? leg.playable.bookmaker : t("odds")}{" "}
              <span data-testid="leg-odds">
                {formatOdds(referenceOdds, locale)}
              </span>
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-2 min-w-0">
        {/* No channel badge here (same reasoning as Decisions'
            channel-row.tsx) — most channels are named after their own
            target market (BTTS canal ≈ BTTS marché, DOUBLE_CHANCE ≈ Double
            chance), so it only repeated the market name below in a
            different case. */}
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p className="line-clamp-2 min-w-0 text-sm font-semibold leading-snug text-foreground">
            {leg.pickLabel}
          </p>
          <ResultBadge result={leg.result} finished={leg.score !== null} />
        </div>
        <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-tight text-muted-foreground">
          <span className="max-w-full truncate">{leg.marketLabel}</span>
          {/* Fréquence du marché, marge retirée : plus de note « optimiste à
              cette cote », qui qualifiait les chiffres du moteur. */}
          {chances ? (
            <span className="tabular-nums">{t("legChances", chances)}</span>
          ) : null}
          {leg.closing && (
            <ClosingLine
              testId="leg-closing"
              closingOdds={leg.closing.odds}
              closingLineValue={leg.closing.value}
              closingBookmaker={leg.closing.bookmaker}
              marginPaid={null}
            />
          )}
        </p>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  valueClassName,
  testId,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  testId?: string;
}) {
  return (
    // Plus d'encadré : une tuile bordée dans la carte faisait une carte dans
    // la carte (détecteur impeccable). Libellé et valeur suffisent.
    <div className="min-w-14 text-right">
      <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p
        data-testid={testId}
        className={cn("text-sm font-semibold tabular-nums", valueClassName)}
      >
        {value}
      </p>
    </div>
  );
}

export function CouponSlipButton({
  allInSlip,
  onPlay,
  playedByMe = false,
}: {
  allInSlip: boolean;
  onPlay: () => void;
  /**
   * A real bet slip was already submitted for this coupon by this user
   * (`CouponProposalPlacement`, recorded server-side — never a client-side
   * flag). Freezes the button into a readonly "Déjà joué par toi" — a user
   * plays a given coupon proposal at most once.
   */
  playedByMe?: boolean;
}) {
  const t = useTranslations("couponCard");
  if (playedByMe) {
    return (
      <div className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-success/20 bg-success/12 text-xs font-semibold text-success">
        <Check size={12} /> {t("playedByMe")}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onPlay}
      className={cn(
        "flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border text-xs font-semibold transition-colors",
        allInSlip
          ? "border-success/20 bg-success/12 text-success"
          : "border-border bg-secondary text-muted-foreground hover:text-foreground",
      )}
    >
      {allInSlip ? (
        <>
          <Check size={12} /> {t("inSlip")}
        </>
      ) : (
        <>
          <ShoppingCart size={12} /> {t("play")}
        </>
      )}
    </button>
  );
}
