"use client";

import * as React from "react";

const MOBILE_BREAKPOINT = 768;
// Tailwind `lg` : sous cette largeur, les écrans à deux colonnes passent en
// une seule et ouvrent leur détail dans un tiroir.
const SINGLE_COLUMN_BREAKPOINT = 1024;

function useIsBelow(breakpoint: number): boolean {
  const [isBelow, setIsBelow] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);

    const updateViewport = () => {
      setIsBelow(window.innerWidth < breakpoint);
    };

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);

    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, [breakpoint]);

  return !!isBelow;
}

export function useIsMobile() {
  return useIsBelow(MOBILE_BREAKPOINT);
}

/** Sous `lg` : une colonne, le détail s'ouvre en tiroir (tablette comprise). */
export function useIsSingleColumn() {
  return useIsBelow(SINGLE_COLUMN_BREAKPOINT);
}
