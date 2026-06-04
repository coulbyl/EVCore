"use client";

import type { TocItem } from "@/components/markdown-article";

export function GlossaireMobileSelect({ items }: { items: TocItem[] }) {
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    if (!id) return;
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <select
      defaultValue=""
      onChange={handleChange}
      className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
    >
      <option value="" disabled>
        Aller à une section…
      </option>
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.label}
        </option>
      ))}
    </select>
  );
}
