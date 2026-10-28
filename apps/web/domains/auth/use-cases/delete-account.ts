"use client";

import { authRequest } from "./auth-request";

export async function deleteAccount(password: string): Promise<void> {
  await authRequest<{ status: "ok" }>("/auth/me/delete", {
    body: { password },
    fallbackErrorMessage: "Impossible de supprimer le compte.",
  });
}
