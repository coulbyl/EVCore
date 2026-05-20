"use client";

import { authRequest } from "./auth-request";

export type TotpSetupPayload = {
  qrDataUrl: string;
  secret: string;
};

export async function setupTotp(): Promise<TotpSetupPayload> {
  return authRequest<TotpSetupPayload>("/auth/setup-totp");
}

export async function confirmTotp(code: string): Promise<void> {
  await authRequest<{ status: string }>("/auth/confirm-totp", {
    body: { code },
  });
}
