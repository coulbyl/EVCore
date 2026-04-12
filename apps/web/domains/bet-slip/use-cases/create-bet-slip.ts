import type { BetSlipDraft, BetSlipView } from "../types/bet-slip";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function createBetSlip(draft: BetSlipDraft): Promise<BetSlipView> {
  const response = await fetch(`${BACKEND_URL}/bet-slips`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      unitStake: draft.unitStake,
      items: draft.items.map((item) => ({
        betId: item.betId,
        stakeOverride: item.stakeOverride ?? undefined,
      })),
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(body.message ?? `Erreur ${response.status}`);
  }

  return (await response.json()) as BetSlipView;
}
