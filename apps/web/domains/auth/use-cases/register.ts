"use client";

import { authRequest } from "./auth-request";
import { applyLocaleFromSession } from "./apply-locale";
import type { AuthSession } from "../types/auth";

export type RegisterInput = {
  firstName: string;
  email: string;
  password: string;
  /** Âge légal confirmé et conditions acceptées : exigés par l'API. */
  confirmAge: true;
  acceptTerms: true;
};

export async function register(input: RegisterInput): Promise<AuthSession> {
  const payload = await authRequest<{ session: AuthSession }>(
    "/auth/register",
    {
      body: input,
    },
  );

  applyLocaleFromSession(payload.session);
  return payload.session;
}
