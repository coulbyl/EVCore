"use client";

import { useRef, useState } from "react";
import { Search, X } from "lucide-react";

type TocItem = { id: string; label: string };

export function GlossaireSearch({ items }: { items: TocItem[] }) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = q.trim()
    ? items.filter((item) =>
        item.label.toLowerCase().includes(q.trim().toLowerCase()),
      )
    : [];

  function goTo(id: string) {
    setQ("");
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-panel-strong px-3 py-2.5 transition-colors focus-within:border-accent/50">
        <Search size={15} className="shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un terme…"
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        {q ? (
          <button
            type="button"
            onClick={() => setQ("")}
            className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X size={13} />
          </button>
        ) : null}
      </div>

      {filtered.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-2xl border border-border bg-panel-strong shadow-[0_12px_32px_rgba(15,23,42,0.14)]">
          {filtered.slice(0, 8).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goTo(item.id)}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-secondary"
            >
              <Search size={12} className="shrink-0 text-accent" />
              <span className="truncate text-foreground">{item.label}</span>
            </button>
          ))}
        </div>
      ) : q.trim() && filtered.length === 0 ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 rounded-2xl border border-border bg-panel-strong px-4 py-3 text-sm text-muted-foreground shadow-[0_12px_32px_rgba(15,23,42,0.14)]">
          Aucun résultat pour «&nbsp;{q}&nbsp;»
        </div>
      ) : null}
    </div>
  );
}
