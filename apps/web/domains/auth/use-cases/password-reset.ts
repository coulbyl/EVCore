"use client";

import { authRequest } from "./auth-request";

export async function requestPasswordReset(identifier: string): Promise<void> {
  await authRequest<{ status: string }>("/auth/forgot-password", {
    body: { identifier },
  });
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  await authRequest<{ status: string }>("/auth/reset-password", {
    body: { token, newPassword },
  });
}

export async function resetPasswordWithTotp(
  identifier: string,
  totpCode: string,
  newPassword: string,
): Promise<void> {
  await authRequest<{ status: string }>("/auth/reset-password/totp", {
    body: { identifier, totpCode, newPassword },
  });
}
