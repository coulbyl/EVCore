import type { BetSlipDraft, BetSlipView } from "../types/bet-slip";
import { clientApiRequest } from "@/lib/api/client-api";

export async function createBetSlip(draft: BetSlipDraft): Promise<BetSlipView> {
  return clientApiRequest<BetSlipView>("/bet-slips", {
    method: "POST",
    body: {
      unitStake: draft.unitStake,
      items: draft.items.map((item) => ({
        betId: item.betId,
        stakeOverride: item.stakeOverride ?? undefined,
      })),
    },
    fallbackErrorMessage: "Impossible de creer le ticket.",
  });
}
