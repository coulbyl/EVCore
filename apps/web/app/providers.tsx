"use client";

import type { ReactNode } from "react";
// By path, never the `@evcore/ui` barrel: this root runs on every page, and
// the barrel pulled Radix and Sonner into the JS of every screen (C0).
import { ThemeProvider } from "@evcore/ui/components/theme-provider";

/**
 * What every page needs: the theme. React Query and the toasts live with the
 * screens that use them (app/dashboard/providers.tsx), never in the player's
 * JS (docs/refonte-ui/16 § 1).
 */
export function Providers({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
