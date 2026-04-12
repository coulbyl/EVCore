import type { BetSlipView } from "../types/bet-slip";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function getBetSlips(): Promise<BetSlipView[]> {
  const response = await fetch(`${BACKEND_URL}/bet-slips`, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Impossible de charger les bet slips (${response.status})`);
  }

  return (await response.json()) as BetSlipView[];
}

export async function getBetSlipById(id: string): Promise<BetSlipView> {
  const response = await fetch(`${BACKEND_URL}/bet-slips/${id}`, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Bet slip introuvable (${response.status})`);
  }

  return (await response.json()) as BetSlipView;
}
