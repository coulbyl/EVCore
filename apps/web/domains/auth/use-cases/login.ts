"use client";

import { authRequest } from "./auth-request";
import { applyLocaleFromSession } from "./apply-locale";
import type { AuthSession } from "../types/auth";

export type LoginInput = {
  identifier: string;
  password: string;
};

/**
 * Une session, ou, si le compte a une application d'authentification, le
 * défi que le code à six chiffres échange contre la session (11 § 3).
 */
export type LoginResult =
  | { kind: "session"; session: AuthSession }
  | { kind: "totp"; challenge: string };

export async function login(input: LoginInput): Promise<LoginResult> {
  const payload = await authRequest<
    { session: AuthSession } | { totpRequired: true; challenge: string }
  >("/auth/login", { body: input });

  if ("challenge" in payload) {
    return { kind: "totp", challenge: payload.challenge };
  }
  applyLocaleFromSession(payload.session);
  return { kind: "session", session: payload.session };
}

export async function loginWithTotp(input: {
  challenge: string;
  code: string;
}): Promise<AuthSession> {
  const payload = await authRequest<{ session: AuthSession }>(
    "/auth/login/totp",
    { body: input },
  );
  applyLocaleFromSession(payload.session);
  return payload.session;
}
