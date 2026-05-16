"use client";

import { useEffect } from "react";
import { isWC2026Active } from "@/lib/events/world-cup-2026";

export function WC2026EventManager() {
  useEffect(() => {
    if (isWC2026Active()) {
      document.documentElement.setAttribute("data-event", "wc2026");
    } else {
      document.documentElement.removeAttribute("data-event");
    }
  }, []);

  return null;
}
