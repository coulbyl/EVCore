"use client";

import type { ReactNode } from "react";
// By path, never the `@evcore/ui` barrel: this root runs on every page, and
// the barrel pulled Radix and Sonner into the JS of every screen (C0).
import { ThemeProvider } from "@evcore/ui/components/theme-provider";

/**
 * What every page needs: the theme. Nothing else runs on every page
 * (docs/refonte-ui/16 § 1).
 */
export function Providers({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
