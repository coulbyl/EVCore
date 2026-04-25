import type { BetSlipDraft, BetSlipView } from "../types/bet-slip";
import { clientApiRequest } from "@/lib/api/client-api";

export async function createBetSlip(draft: BetSlipDraft): Promise<BetSlipView> {
  return clientApiRequest<BetSlipView>("/bet-slips", {
    method: "POST",
    body: {
      type: draft.type,
      unitStake: draft.unitStake,
      items: draft.items.map((item) => {
        if (item.betId) {
          // Bet MODEL déjà créé par le moteur — on référence directement son ID.
          return {
            betId: item.betId,
            stakeOverride: item.stakeOverride ?? undefined,
          };
        }
        // Pick USER — créé en base lors de la soumission du coupon.
        return {
          modelRunId: item.modelRunId,
          market: item.market,
          pick: item.pick,
          comboMarket: item.comboMarket,
          comboPick: item.comboPick,
          stakeOverride: item.stakeOverride ?? undefined,
        };
      }),
    },
    fallbackErrorMessage: "Impossible de créer le coupon.",
  });
}
