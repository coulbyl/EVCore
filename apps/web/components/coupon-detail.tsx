import Image from "next/image";
import type { CouponSnapshot } from "../types/dashboard";
import { SettleFixtureDialog } from "./settle-fixture-dialog";

// --- helpers ---

export function couponStatusLabel(status: "PENDING" | "WON" | "LOST"): string {
  if (status === "WON") return "GAGNÉ";
  if (status === "LOST") return "PERDU";
  return "EN COURS";
}

export function couponStatusBadgeClass(status: "PENDING" | "WON" | "LOST"): string {
  if (status === "WON") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "LOST") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function couponModeLabel(legs: number): "Simple" | "Combiné" {
  return legs > 1 ? "Combiné" : "Simple";
}

export function combinedOdds(odds: string[]): string {
  if (odds.length === 0) return "—";
  const product = odds.reduce((acc, odd) => acc * Number.parseFloat(odd), 1);
  return Number.isFinite(product) ? product.toFixed(2) : "—";
}

function selectionStatusLabel(status: "PENDING" | "WON" | "LOST" | "VOID"): string {
  if (status === "WON") return "GAGNÉ";
  if (status === "LOST") return "PERDU";
  if (status === "VOID") return "VOID";
  return "EN COURS";
}

function selectionStatusBadgeClass(status: "PENDING" | "WON" | "LOST" | "VOID"): string {
  if (status === "WON") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "LOST") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "VOID") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function selectionCardClass(status: "PENDING" | "WON" | "LOST" | "VOID"): string {
  if (status === "WON") return "border-emerald-200 bg-emerald-50/30";
  if (status === "LOST") return "border-rose-200 bg-rose-50/30";
  if (status === "VOID") return "border-slate-200 bg-slate-50";
  return "border-border bg-white";
}

export function formatPickForDisplay(pick: string, market: string): string {
  // Combo picks embed the market ("HOME + OVER_UNDER UNDER") — replace inline
  const formatted = pick
    .replace("OVER_UNDER UNDER", "UNDER 2.5")
    .replace("OVER_UNDER OVER", "OVER 2.5")
    .replace("OVER_UNDER_25 UNDER", "UNDER 2.5")
    .replace("OVER_UNDER_25 OVER", "OVER 2.5");

  // Single bets: bare "UNDER"/"OVER" with no market prefix in the pick string
  if (formatted === pick && (market === "OVER_UNDER" || market === "OVER_UNDER_25")) {
    if (pick === "UNDER") return "UNDER 2.5";
    if (pick === "OVER") return "OVER 2.5";
  }

  return formatted;
}

export function FixtureStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "finished")
    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
        terminé
      </span>
    );
  if (s === "in_progress")
    return (
      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-blue-600">
        en cours
      </span>
    );
  if (s === "postponed")
    return (
      <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-rose-600">
        reporté
      </span>
    );
  if (s === "cancelled")
    return (
      <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-rose-600">
        annulé
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-amber-700">
      planifié
    </span>
  );
}

// --- components ---

export function CouponDetailEmpty() {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-slate-400">
      Sélectionnez un coupon pour afficher le détail.
    </div>
  );
}

type CouponDetailHeaderProps = {
  code: string;
  legs: number;
  status: "PENDING" | "WON" | "LOST";
};

export function CouponDetailHeader({ code, legs, status }: CouponDetailHeaderProps) {
  return (
    <div className="border-b border-border bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-xs text-slate-500">{code}</p>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full border border-slate-900 bg-slate-900 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.06em] text-white">
            {couponModeLabel(legs)}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] ${couponStatusBadgeClass(status)}`}
          >
            {couponStatusLabel(status)}
          </span>
        </div>
      </div>
    </div>
  );
}

type CouponDetailStatsProps = {
  selectionCount: number;
  isCombined: boolean;
  odds: string;
  ev: string;
};

export function CouponDetailStats({
  selectionCount,
  isCombined,
  odds,
  ev,
}: CouponDetailStatsProps) {
  return (
    <div className="grid grid-cols-3 border-b border-border bg-slate-50 px-3 py-3 text-sm">
      <div>
        <p className="text-xs text-slate-400">Sélections</p>
        <p className="font-semibold text-slate-700">{selectionCount}</p>
      </div>
      <div>
        <p className="text-xs text-slate-400">{isCombined ? "Cote combinée" : "Cote"}</p>
        <p className="font-semibold text-slate-700">{odds}</p>
      </div>
      <div>
        <p className="text-xs text-slate-400">EV coupon</p>
        <p className="font-semibold text-slate-700">{ev}</p>
      </div>
    </div>
  );
}

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
  className = "text-sm font-semibold text-slate-800",
  logoPosition = "start",
}: {
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  className?: string;
  logoPosition?: "start" | "end";
}) {
  const [home, away] = fixture.split(" vs ");
  if (!home || !away) {
    return <p className={className}>{fixture}</p>;
  }
  return (
    <p className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {logoPosition === "start" && <TeamLogo src={homeLogo} name={home} />}
      <span>{home}</span>
      {logoPosition === "end" && <TeamLogo src={homeLogo} name={home} />}
      <span className="font-normal text-slate-400">vs</span>
      {logoPosition === "start" && <TeamLogo src={awayLogo} name={away} />}
      <span>{away}</span>
      {logoPosition === "end" && <TeamLogo src={awayLogo} name={away} />}
    </p>
  );
}

type CouponDetailLegProps = {
  selection: CouponSnapshot["selections"][number];
  index: number;
  onSettled?: () => void;
};

export function CouponDetailLeg({ selection, index, onSettled }: CouponDetailLegProps) {
  return (
    <div className="px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Leg {index + 1}
        </p>
        <div className="flex items-center gap-2">
          {selection.status === "PENDING" && selection.fixtureId ? (
            <SettleFixtureDialog
              fixtureId={selection.fixtureId}
              fixtureName={selection.fixture}
              onSettled={onSettled}
              triggerSize="xs"
            />
          ) : null}
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] ${selectionStatusBadgeClass(selection.status)}`}
          >
            {selectionStatusLabel(selection.status)}
          </span>
        </div>
      </div>
      <div className={`mt-2 rounded-xl border px-3 py-2 ${selectionCardClass(selection.status)}`}>
        <FixtureName
          fixture={selection.fixture}
          homeLogo={selection.homeLogo}
          awayLogo={selection.awayLogo}
        />
        <div className="mt-1 flex items-center gap-2">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {selection.scheduledAt} • {selection.market}
          </p>
          <FixtureStatusBadge status={selection.fixtureStatus} />
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
            {formatPickForDisplay(selection.pick, selection.market)}
          </p>
          <div className="text-right">
            <p
              className={`text-base font-bold tabular-nums ${
                selection.status === "LOST"
                  ? "text-rose-500 line-through"
                  : selection.status === "WON"
                    ? "text-emerald-600"
                    : "text-slate-700"
              }`}
            >
              {selection.odds}
            </p>
            <p className="text-[0.7rem] font-semibold text-slate-500">EV {selection.ev}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

type CouponDetailProps = {
  coupon: CouponSnapshot;
  onSettled?: () => void;
};

export function CouponDetail({ coupon, onSettled }: CouponDetailProps) {
  const isCombined = coupon.selections.length > 1;
  const odds = isCombined
    ? combinedOdds(coupon.selections.map((s) => s.odds))
    : (coupon.selections[0]?.odds ?? "—");

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-white">
      <CouponDetailHeader code={coupon.code} legs={coupon.legs} status={coupon.status} />
      <CouponDetailStats
        selectionCount={coupon.selections.length}
        isCombined={isCombined}
        odds={odds}
        ev={coupon.ev}
      />
      <div className="max-h-140 divide-y divide-border overflow-y-auto">
        {coupon.selections.map((selection, index) => (
          <CouponDetailLeg
            key={selection.id}
            selection={selection}
            index={index}
            onSettled={onSettled}
          />
        ))}
      </div>
    </div>
  );
}
