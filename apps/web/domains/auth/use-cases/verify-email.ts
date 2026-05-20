"use client";

import { authRequest } from "./auth-request";

export async function sendVerificationEmail(): Promise<void> {
  await authRequest<{ status: string }>("/auth/send-verification");
}

export async function verifyEmail(code: string): Promise<void> {
  await authRequest<{ status: string }>("/auth/verify-email", {
    body: { code },
  });
}
