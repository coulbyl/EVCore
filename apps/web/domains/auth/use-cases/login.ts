"use client";

import { authRequest } from "./auth-request";
import type { AuthSession } from "../types/auth";

export type LoginInput = {
  identifier: string;
  password: string;
};

export async function login(input: LoginInput): Promise<AuthSession> {
  const payload = await authRequest<{ session: AuthSession }>("/auth/login", {
    body: input,
  });

  return payload.session;
}
