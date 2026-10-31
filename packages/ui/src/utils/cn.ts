import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The scoreboard's font sizes (apps/web/app/styles/scoreboard.css,
// `--text-*`). Unknown to tailwind-merge, `text-legal` read as a colour:
// followed by `text-foreground` it was dropped, and the tab labels lost
// their size (found in C0).
const twMerge = extendTailwindMerge({
  extend: {
    theme: { text: ["legal", "meta", "body", "bet", "title", "figure"] },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
