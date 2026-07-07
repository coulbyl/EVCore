"use client";

import type { CSSProperties, ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "@evcore/ui";

// Fades the first/last ~14px of the strip to transparent so a partially
// hidden tab reads as "more to scroll" instead of getting cut off sharply.
// mask-image (not a background-color trick) so it works over any surface.
const EDGE_FADE_STYLE: CSSProperties = {
  maskImage:
    "linear-gradient(to right, transparent, black 14px, black calc(100% - 14px), transparent)",
  WebkitMaskImage:
    "linear-gradient(to right, transparent, black 14px, black calc(100% - 14px), transparent)",
};

/** Horizontally-scrollable tab strip (shadcn Tabs, "line" variant). Hides the
 * native scrollbar and fades the edges as a scroll affordance instead — the
 * `overflow-y-hidden` matters as much as `overflow-x-auto`: without it, some
 * browsers still reserve a vertical scrollbar track next to the tabs. */
export function ScrollableTabs<T extends string>({
  value,
  onValueChange,
  items,
}: {
  value: T;
  onValueChange: (value: T) => void;
  items: { value: T; label: ReactNode }[];
}) {
  return (
    <div
      className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={EDGE_FADE_STYLE}
    >
      <Tabs value={value} onValueChange={(v) => onValueChange(v as T)}>
        <TabsList variant="line">
          {items.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
