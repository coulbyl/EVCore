import type { AuthSession } from "../types/auth";
import { serverApiRequest } from "@/lib/api/server-api";

export async function getCurrentSession(): Promise<AuthSession | null> {
  try {
    const payload = await serverApiRequest<{ session: AuthSession }>(
      "/auth/me",
    );
    return payload.session;
  } catch {
    return null;
  }
}
