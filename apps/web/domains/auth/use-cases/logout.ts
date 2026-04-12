"use client";

import { authRequest } from "./auth-request";

export async function logout(): Promise<void> {
  await authRequest<{ status: "ok" }>("/auth/logout");
}
