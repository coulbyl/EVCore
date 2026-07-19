import type { BetSlipDraft, BetSlipView } from "../types/bet-slip";
import { clientApiRequest } from "@/lib/api/client-api";

export async function createBetSlip(draft: BetSlipDraft): Promise<BetSlipView> {
  return clientApiRequest<BetSlipView>("/bet-slips", {
    method: "POST",
    body: {
      type: draft.type,
      unitStake: draft.unitStake,
      items: draft.items.map((item) => ({
        modelRunId: item.modelRunId,
        market: item.market,
        pick: item.pick,
        stakeOverride: item.stakeOverride ?? undefined,
      })),
    },
    fallbackErrorMessage: "Impossible de créer le coupon.",
  });
}
