"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "@evcore/ui/components/sonner";

/**
 * React Query and the toasts of the dashboard screens. Moved out of the app
 * root (C0): the player's screens use neither, and loaded both on every page.
 */
export function DashboardProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster closeButton />
    </QueryClientProvider>
  );
}
