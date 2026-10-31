"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

const THEMES = [
  { key: "system", label: "Système" },
  { key: "light", label: "Clair" },
  { key: "dark", label: "Sombre" },
] as const;

const subscribe = () => () => {};

/**
 * Bascule clair / sombre de la vitrine, pour comparer sans réglage système.
 * Le thème n'est connu que dans le navigateur : rien n'est pressé au rendu
 * serveur, sinon l'hydratation ne correspond pas.
 */
export function ShowcaseThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <div role="group" aria-label="Thème" className="flex gap-1.5">
      {THEMES.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={mounted && theme === item.key}
          onClick={() => setTheme(item.key)}
          className="min-h-11 rounded-full px-4 text-body font-medium text-muted-foreground aria-pressed:bg-led-on aria-pressed:text-band focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
