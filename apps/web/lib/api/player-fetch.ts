"use client";

/**
 * The player's client calls (follow a coupon, price the ticket): a JSON
 * body, the session cookie, a thrown error past 2xx, the JSON answer or
 * nothing. Without `clientApiRequest`'s error-message parsing: the player's
 * screens show their own fixed texts, and it weighed ~0.75 kio on
 * Aujourd'hui (C7).
 */
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function playerFetch<T>(
  path: string,
  init: { method: "POST" | "PATCH" | "DELETE"; body?: object },
): Promise<T | undefined> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    method: init.method,
    credentials: "include",
    cache: "no-store",
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : undefined;
}
