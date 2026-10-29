"use client";

import * as React from "react";
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from "next-themes";

function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      // Le réglage du téléphone tant que le joueur n'a rien choisi : le
      // joueur lit dehors, en plein soleil, et la plupart des téléphones
      // sont en clair le jour (docs/refonte-ui/13-style.md § 2). Était
      // « dark » forcé, quel que soit le téléphone.
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}

export { ThemeProvider };
