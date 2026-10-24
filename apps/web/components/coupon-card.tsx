"use client";

import {
  Check,
  Eye,
  MessageCircle,
  ShoppingCart,
  Sun,
  Tag,
  Users,
} from "lucide-react";
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
  odds: string | null;
  /** Cote chez le book de l'utilisateur (1xBet), sinon la plus basse relevée. */
  playable?: { odds: number; bookmaker: string } | null;
  /** Code marché, pour que « Annulé » devienne « Remboursé » sur un Draw No Bet. */
  market?: string;
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
  } | null;
  combinedOdds: number;
  /**
   * Cote réellement payée au règlement (jambes remboursées exclues). Affichée
   * à côté de la cote proposée dès qu'elles diffèrent : un PARTIAL payé à 3,1
   * sur un coupon annoncé à 4,3 ne doit pas se lire comme un gain à 4,3.
   */
  realizedOdds?: number | null;
  jointProbability: number;
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
  /**
   * Engagement réel, jamais fabriqué (CLAUDE.md §4 point 6) — utilisateurs
   * distincts ayant vu/joué ce coupon. Masqué à 0 (rien à dire), pas affiché
   * comme "0 vue" qui lirait comme un coupon délaissé plutôt que "pas encore
   * mesuré".
   */
  viewerCount?: number;
  playerCount?: number;
  betStatus?: "WON" | "LOST" | "PARTIAL" | "VOID" | null;
  legs: NormalizedCouponLeg[];
  actionSlot?: React.ReactNode;
};

function formatPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
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
function trackRecordLine(
  record: CouponCardProps["trackRecord"],
  t: CardT,
): string {
  if (!record || record.settled === 0) return t("noRecord");
  if (record.settled < MIN_SETTLED_FOR_RECORD) {
    return t("recordInProgress", { count: record.settled });
  }
  return t("record", {
    won: record.won,
    settled: record.settled,
    result: fixedStakeLabel(record.returnPerUnit),
    from: shortDay(record.firstDay),
    to: shortDay(record.lastDay),
  });
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
  viewerCount,
  playerCount,
  betStatus,
  legs,
  actionSlot,
}: CouponCardProps) {
  const t = useTranslations("couponCard");
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
              {couponClass && (
                <span
                  data-testid="coupon-track-record"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {trackRecordLine(trackRecord, t)}
                </span>
              )}
              {source && (
                <span
                  title={source.hint}
                  className="flex items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 text-xs font-medium text-muted-foreground"
                >
                  <Tag size={10} /> {source.label}
                </span>
              )}
              {batch === "intraday" && (
                <span
                  title={t("intradayHint")}
                  className="flex items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 text-xs font-medium text-muted-foreground"
                >
                  <Sun size={10} /> {t("intraday")}
                </span>
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
                <span
                  data-testid="coupon-result"
                  title={t("resultPartialHint")}
                  className="text-xs font-bold uppercase tracking-wide text-success"
                >
                  {t("resultPartial")}
                </span>
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
                <span
                  data-testid="coupon-result"
                  title={t("resultVoidHint")}
                  className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
                >
                  {t("resultVoid")}
                </span>
              )}
            </div>
            {((viewerCount ?? 0) > 0 || (playerCount ?? 0) > 0) && (
              <div className="mt-1 flex items-center gap-2.5 text-xs text-muted-foreground">
                {(viewerCount ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <Eye size={10} />{" "}
                    {t("viewers", { count: viewerCount ?? 0 })}
                  </span>
                )}
                {(playerCount ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <Users size={10} />{" "}
                    {t("players", { count: playerCount ?? 0 })}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
            <Metric
              label={t("odds")}
              value={`@${combinedOdds.toFixed(2)}`}
              testId="coupon-combined-odds"
            />
            {realizedOdds !== null &&
              Math.abs(realizedOdds - combinedOdds) > 0.005 && (
                <Metric
                  label={t("paid")}
                  value={`@${realizedOdds.toFixed(2)}`}
                  valueClassName="text-success"
                  testId="coupon-realized-odds"
                />
              )}
            <PlayableCombinedMetric legs={legs} combinedOdds={combinedOdds} />
            <Metric label={t("chances")} value={formatPct(jointProbability)} />
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
          <HoverCard openDelay={150}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className="flex min-h-11 w-fit items-center gap-1.5 rounded-full border border-dashed border-border/70 bg-background/20 px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <MessageCircle size={11} />
                {t("why")}
              </button>
            </HoverCardTrigger>
            <HoverCardContent className="w-72 text-xs leading-snug text-foreground">
              {reasoning}
            </HoverCardContent>
          </HoverCard>
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
        <div className="flex shrink-0 items-center gap-2">
          {leg.odds && (
            <span
              data-testid="leg-odds"
              className="font-mono text-xs text-muted-foreground"
            >
              @{leg.odds}
            </span>
          )}
          {leg.playable &&
            leg.odds !== null &&
            Math.abs(leg.playable.odds - Number(leg.odds)) >= 0.005 && (
              <span
                data-testid="leg-playable-odds"
                title={t("legPlayableHint", {
                  bookmaker: leg.playable.bookmaker,
                })}
                className={cn(
                  "font-mono text-xs",
                  leg.playable.odds < 1.1
                    ? "font-semibold text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {leg.playable.bookmaker} {leg.playable.odds.toFixed(2)}
              </span>
            )}
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
          <ResultBadge
            result={leg.result}
            finished={leg.score !== null}
            market={leg.market}
          />
        </div>
        <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-tight text-muted-foreground">
          <span className="max-w-full truncate">{leg.marketLabel}</span>
          <span className="tabular-nums">
            {t("legChances", { pct: formatPct(leg.probability) })}
          </span>
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
      <p className="text-[0.6875rem] uppercase tracking-[0.1em] text-muted-foreground">
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

/**
 * La cote combinée chez le bookmaker des utilisateurs, quand toutes les
 * jambes y sont cotées et qu'elle diffère de la nôtre : c'est ce que le
 * coupon paiera réellement.
 */
function PlayableCombinedMetric({
  legs,
  combinedOdds,
}: {
  legs: NormalizedCouponLeg[];
  combinedOdds: number;
}) {
  const t = useTranslations("couponCard");
  if (legs.length === 0 || legs.some((leg) => !leg.playable)) return null;
  const bookmakers = new Set(legs.map((leg) => leg.playable!.bookmaker));
  if (bookmakers.size !== 1) return null;
  const playable = legs.reduce((acc, leg) => acc * leg.playable!.odds, 1);
  if (Math.abs(playable - combinedOdds) < 0.005) return null;
  return (
    <Metric
      label={[...bookmakers][0] ?? t("playable")}
      value={`@${playable.toFixed(2)}`}
      testId="coupon-playable-odds"
    />
  );
}
