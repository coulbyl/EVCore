import Image from "next/image";
import { formatTime } from "@/lib/date";
import { translateCountry, translateCompetition } from "@/lib/competition-i18n";
import { formatScore } from "@/domains/fixture/helpers/fixture";

// Inline mode: separate team names rendered with individual logos
type InlineTeams = {
  homeTeam: string;
  awayTeam: string;
  fixtureName?: never;
};

// Single mode: combined fixture name (e.g. "Arsenal – Chelsea")
type SingleFixture = {
  fixtureName: string;
  homeTeam?: never;
  awayTeam?: never;
};

export type PickCardProps = (InlineTeams | SingleFixture) & {
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string;
  country: string;
  locale: string;
  scheduledAt: string;
  canalColor: string;
  marketLabel: string;
  pickLabel: string;
  probabilityPct: string | null;
  signalScore: string | null;
  odds: string | null;
  /**
   * Cote chez le bookmaker du joueur quand elle diffère de la nôtre — même
   * présentation que sur les jambes d'un coupon (`components/coupon-card.tsx`).
   */
  playable?: { odds: number; bookmaker: string } | null;
  score: string | null;
  htScore: string | null;
  betStatus: "WON" | "LOST" | "PENDING" | null;
  reasoning?: string | null;
  actionSlot?: React.ReactNode;
  active?: boolean;
  onSelect?: () => void;
};

function ResultBadge({
  betStatus,
}: {
  betStatus: "WON" | "LOST" | "PENDING" | null;
}) {
  if (!betStatus) return null;
  if (betStatus === "PENDING")
    return (
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        En attente
      </span>
    );
  return betStatus === "WON" ? (
    <span className="text-xs font-bold uppercase tracking-wide text-success">
      ✓ Gagné
    </span>
  ) : (
    <span className="text-xs font-bold uppercase tracking-wide text-destructive">
      ✗ Perdu
    </span>
  );
}

function TeamNames({
  homeLogo,
  awayLogo,
  homeTeam,
  awayTeam,
  fixtureName,
}: {
  homeLogo: string | null;
  awayLogo: string | null;
  homeTeam?: string;
  awayTeam?: string;
  fixtureName?: string;
}) {
  if (fixtureName) {
    return (
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs font-semibold leading-snug">
        {homeLogo && (
          <Image
            src={homeLogo}
            alt=""
            width={14}
            height={14}
            className="size-3.5 shrink-0 object-contain"
          />
        )}
        {awayLogo && (
          <Image
            src={awayLogo}
            alt=""
            width={14}
            height={14}
            className="size-3.5 shrink-0 object-contain"
          />
        )}
        <span className="truncate">{fixtureName}</span>
      </span>
    );
  }

  return (
    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs font-semibold leading-snug">
      {homeLogo && (
        <Image
          src={homeLogo}
          alt={homeTeam ?? ""}
          width={14}
          height={14}
          className="size-3.5 shrink-0 object-contain"
        />
      )}
      <span className="truncate">{homeTeam}</span>
      <span className="font-normal text-muted-foreground">–</span>
      {awayLogo && (
        <Image
          src={awayLogo}
          alt={awayTeam ?? ""}
          width={14}
          height={14}
          className="size-3.5 shrink-0 object-contain"
        />
      )}
      <span className="truncate">{awayTeam}</span>
    </span>
  );
}

export function PickCard(props: PickCardProps) {
  const {
    homeLogo,
    awayLogo,
    competition,
    country,
    locale,
    scheduledAt,
    canalColor,
    marketLabel,
    pickLabel,
    probabilityPct,
    signalScore,
    odds,
    playable,
    score,
    htScore,
    betStatus,
    reasoning,
    actionSlot,
    active,
    onSelect,
  } = props;

  const scoreLabel = formatScore(score, htScore);
  const isInteractive = !!onSelect;

  return (
    <div
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
      className={`relative overflow-hidden rounded-xl border p-3 pl-4 flex flex-col gap-1.5 transition-colors${isInteractive ? " cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" : ""}${active ? " border-accent/30 bg-accent/10" : " border-border/70 bg-card hover:border-border"}`}
    >
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: canalColor }}
      />

      <div className="flex items-start justify-between gap-2">
        <TeamNames
          homeLogo={homeLogo}
          awayLogo={awayLogo}
          homeTeam={props.homeTeam}
          awayTeam={props.awayTeam}
          fixtureName={props.fixtureName}
        />
        <div className="flex shrink-0 items-center gap-1.5">
          {probabilityPct && (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-bold tabular-nums text-foreground"
              style={{
                // Texte neutre sur fond teinté : la couleur du canal en texte
                // tombait à 3,1–4,4:1 selon le canal et le thème.
                background: `color-mix(in srgb, ${canalColor} 18%, transparent)`,
              }}
            >
              {probabilityPct}
            </span>
          )}
          {signalScore && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
              ↗ {signalScore}
            </span>
          )}
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{marketLabel}</span>
        {" · "}
        <span className="font-medium text-foreground">{pickLabel}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground mt-0.5">
        <span className="whitespace-nowrap text-[0.6875rem] uppercase tracking-wide">
          {translateCountry(country, locale)} ·{" "}
          {translateCompetition(competition, locale)}
        </span>
        <span className="opacity-40">·</span>
        <span className="whitespace-nowrap">{formatTime(scheduledAt)}</span>
        {odds && (
          <>
            <span className="opacity-40">·</span>
            <span className="whitespace-nowrap font-mono text-foreground">
              @{odds}
            </span>
            {playable && Math.abs(playable.odds - Number(odds)) >= 0.005 && (
              <span
                data-testid="pick-playable-odds"
                className="whitespace-nowrap font-mono text-muted-foreground"
              >
                {playable.bookmaker} {playable.odds.toFixed(2)}
              </span>
            )}
          </>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {scoreLabel && (
            <span className="whitespace-nowrap font-mono text-xs text-foreground">
              {scoreLabel}
            </span>
          )}
          <ResultBadge betStatus={betStatus} />
          {actionSlot}
        </div>
      </div>

      {reasoning && (
        <p className="border-t border-border/50 pt-1.5 text-xs leading-snug text-muted-foreground">
          {reasoning}
        </p>
      )}
    </div>
  );
}
