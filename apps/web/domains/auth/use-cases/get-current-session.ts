import { cookies } from "next/headers";
import type { AuthSession } from "../types/auth";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function getCookieHeader() {
  const cookieStore = await cookies();

  return cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  const cookieHeader = await getCookieHeader();

  if (!cookieHeader) {
    return null;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { session: AuthSession };
    return payload.session;
  } catch {
    return null;
  }
}
