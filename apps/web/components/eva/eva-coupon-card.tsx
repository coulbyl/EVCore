import { Ticket } from "lucide-react";
import type { EvaCoupon } from "@/domains/analysis-sheet/types/analysis-sheet";

const nf = new Intl.NumberFormat("fr-FR");

function formatAmount(value: number): string {
  return `${nf.format(value)} FCFA`;
}

function formatKickoff(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

// Backend-priced coupon proposed by Eva: legs, odds, stake and payout all
// come from the engine — this card only renders them.
export function EvaCouponCard({ coupon }: { coupon: EvaCoupon }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        <Ticket className="size-4 text-accent" />
        <span className="text-sm font-bold text-foreground">
          Coupon {coupon.label}
        </span>
        <span className="ml-auto text-sm font-semibold text-foreground">
          Cote totale {coupon.totalOdds.toFixed(2)}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {coupon.legs.map((leg) => (
          <li
            key={`${leg.fixtureId}-${leg.channel}`}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm"
          >
            <span className="font-medium text-foreground">{leg.match}</span>
            <span className="text-xs text-muted-foreground">
              {leg.competition} · {formatKickoff(leg.kickoff)}
            </span>
            <span className="ml-auto whitespace-nowrap text-foreground">
              {leg.pickLabel} @ {leg.odds.toFixed(2)}
            </span>
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {(leg.probability * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>

      {coupon.stake !== null &&
        coupon.potentialPayout !== null &&
        coupon.netGain !== null && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2 text-sm">
            <span className="text-muted-foreground">
              Mise{" "}
              <span className="font-semibold text-foreground">
                {formatAmount(coupon.stake)}
              </span>
            </span>
            <span className="text-muted-foreground">
              Retour potentiel{" "}
              <span className="font-semibold text-foreground">
                {formatAmount(coupon.potentialPayout)}
              </span>
            </span>
            <span className="text-muted-foreground">
              Gain net{" "}
              <span className="font-semibold text-success">
                {formatAmount(coupon.netGain)}
              </span>
            </span>
          </div>
        )}
    </div>
  );
}
