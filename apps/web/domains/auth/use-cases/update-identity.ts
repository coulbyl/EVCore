"use client";

import { authRequest } from "./auth-request";
import type { AuthSessionUser } from "../types/auth";

type UpdateIdentityPayload = {
  email?: string;
  username?: string;
};

export async function updateIdentity(
  payload: UpdateIdentityPayload,
): Promise<AuthSessionUser> {
  const { user } = await authRequest<{ user: AuthSessionUser }>(
    "/auth/me/identity",
    { method: "PATCH", body: payload },
  );
  return user;
}
