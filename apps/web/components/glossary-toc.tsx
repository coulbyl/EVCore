"use client";

import { useEffect, useState } from "react";

type TocItem = {
  id: string;
  label: string;
};

export function GlossaryToc({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    if (items.length === 0) return;

    const headingElements = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => element !== null);

    if (headingElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visibleEntries.length > 0) {
          setActiveId(visibleEntries[0]?.target.id ?? "");
        }
      },
      {
        rootMargin: "-20% 0px -65% 0px",
        threshold: [0, 1],
      },
    );

    for (const element of headingElements) {
      observer.observe(element);
    }

    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash) setActiveId(hash);
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [items]);

  return (
    <div className="mt-4 flex flex-col gap-2">
      {items.map((item, index) => {
        const active = item.id === activeId;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={active ? "location" : undefined}
            className={`group flex items-start gap-3 rounded-[1rem] border px-3 py-2.5 transition sm:rounded-2xl sm:py-3 ${
              active
                ? "border-accent/35 bg-accent-soft shadow-[inset_0_0_0_1px_rgba(20,184,166,0.16)]"
                : "border-transparent hover:border-border hover:bg-panel"
            }`}
          >
            <span
              className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-semibold sm:h-6 sm:w-6 sm:text-[0.7rem] ${
                active
                  ? "border-accent/35 bg-panel-strong text-accent"
                  : "border-border bg-panel-strong text-muted-foreground group-hover:border-accent/25 group-hover:text-accent"
              }`}
            >
              {index + 1}
            </span>
            <span
              className={`text-[0.92rem] font-medium sm:text-sm ${
                active
                  ? "text-foreground"
                  : "text-muted-foreground group-hover:text-foreground"
              }`}
            >
              {item.label}
            </span>
          </a>
        );
      })}
    </div>
  );
}
