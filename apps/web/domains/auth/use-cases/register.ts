"use client";

import { authRequest } from "./auth-request";
import { applyLocaleFromSession } from "./apply-locale";
import type { AuthSession } from "../types/auth";

export type RegisterInput = {
  email: string;
  username: string;
  fullName: string;
  password: string;
  bio?: string;
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
