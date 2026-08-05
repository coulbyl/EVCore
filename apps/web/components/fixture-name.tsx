import type { ReactNode } from "react";
import Image from "next/image";

function TeamLogo({ src, name }: { src: string | null; name: string }) {
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={name}
      width={16}
      height={16}
      className="size-4 shrink-0 object-contain"
    />
  );
}

export function FixtureName({
  fixture,
  homeLogo,
  awayLogo,
  homeBadge,
  awayBadge,
  className = "text-xs font-semibold text-foreground",
  logoPosition = "start",
  stacked = false,
  wrap = false,
}: {
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  /** Rendered right after that team's name — e.g. a "new coach" chip. Only
   * the stacked (card header) layout has room for these. */
  homeBadge?: ReactNode;
  awayBadge?: ReactNode;
  className?: string;
  logoPosition?: "start" | "end";
  /** Below `sm`, home and away each get their own full-width line — only
   * "vs Away" competes for room, so long names stop getting cut off on narrow
   * phones. From `sm` up they merge back onto one line since there's room.
   * Pure CSS (`sm:`), so it reflows live on resize/rotation without JS. Used
   * by the card header; the compact bet-slip list keeps the plain single-line
   * form since it has no logos/badges competing for space. */
  stacked?: boolean;
  /** Wrap long team names onto extra lines instead of truncating with an
   * ellipsis — for contexts where the full name matters more than a tight
   * single line (e.g. matching a bet against a bookmaker's listing). */
  wrap?: boolean;
}) {
  const [home, away] = fixture.split(" vs ");
  const nameClass = wrap
    ? "min-w-0 shrink break-words"
    : "min-w-0 shrink truncate";
  if (!home || !away) {
    return (
      <p className={`${wrap ? "break-words" : "truncate"} ${className}`}>
        {fixture}
      </p>
    );
  }

  const layout = stacked
    ? "flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-1.5"
    : "flex-row items-center gap-1.5";

  return (
    <div className={`flex min-w-0 ${layout} ${className}`}>
      <span className="flex min-w-0 items-center gap-1.5">
        {logoPosition === "start" && <TeamLogo src={homeLogo} name={home} />}
        <span className={nameClass}>{home}</span>
        {logoPosition === "end" && <TeamLogo src={homeLogo} name={home} />}
        {homeBadge}
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="shrink-0 font-normal text-muted-foreground">vs</span>
        {logoPosition === "start" && <TeamLogo src={awayLogo} name={away} />}
        <span className={nameClass}>{away}</span>
        {logoPosition === "end" && <TeamLogo src={awayLogo} name={away} />}
        {awayBadge}
      </span>
    </div>
  );
}
