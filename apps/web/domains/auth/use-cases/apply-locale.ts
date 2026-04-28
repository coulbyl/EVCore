"use client";

import type { AuthSession } from "../types/auth";

export function applyLocaleFromSession(session: AuthSession): void {
  const locale = session.user.locale;
  if (locale && (locale === "fr" || locale === "en")) {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; samesite=lax`;
  }
}
