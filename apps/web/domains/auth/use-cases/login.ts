"use client";

import { authRequest } from "./auth-request";
import { applyLocaleFromSession } from "./apply-locale";
import type { AuthSession } from "../types/auth";

export type LoginInput = {
  identifier: string;
  password: string;
};

export async function login(input: LoginInput): Promise<AuthSession> {
  const payload = await authRequest<{ session: AuthSession }>("/auth/login", {
    body: input,
  });

  applyLocaleFromSession(payload.session);
  return payload.session;
}
