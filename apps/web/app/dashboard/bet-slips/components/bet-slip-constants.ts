import { formatPickWithTeams } from "@/helpers/fixture";
import type {
  BetSlipItemView,
  BetSlipResult,
  BetSlipView,
} from "@/domains/bet-slip/types/bet-slip";

export type SlipStatus = BetSlipResult["status"];

/** Couleur du statut : la perte se voit autant que le gain. */
export const SLIP_STATUS_VARIANT: Record<
  SlipStatus,
  "success" | "destructive" | "neutral" | "warning"
> = {
  WON: "success",
  LOST: "destructive",
  VOID: "neutral",
  PENDING: "warning",
};

/** Le pari écrit avec le nom des équipes, comme sur Décisions. */
export function legPickLabel(item: BetSlipItemView): string {
  return formatPickWithTeams(item.pick, item.market, {
    home: item.homeTeam,
    away: item.awayTeam,
  });
}

export function legMatchLabel(item: BetSlipItemView): string {
  return `${item.homeTeam} – ${item.awayTeam}`;
}

export type SlipsTotals = {
  settled: number;
  pending: number;
  settledStake: number;
  returned: number;
  net: number;
  pendingStake: number;
};

/**
 * Additionne les résultats déjà calculés par le backend : aucune règle de
 * règlement ici, seulement des sommes.
 */
export function sumSlipResults(slips: readonly BetSlipView[]): SlipsTotals {
  return slips.reduce<SlipsTotals>(
    (acc, slip) => {
      const r = slip.result;
      const pending = r.status === "PENDING";
      return {
        settled: acc.settled + (pending ? 0 : 1),
        pending: acc.pending + (pending ? 1 : 0),
        settledStake: acc.settledStake + Number(r.settledStake),
        returned: acc.returned + Number(r.returned),
        net: acc.net + Number(r.net),
        pendingStake: acc.pendingStake + Number(r.pendingStake),
      };
    },
    {
      settled: 0,
      pending: 0,
      settledStake: 0,
      returned: 0,
      net: 0,
      pendingStake: 0,
    },
  );
}
