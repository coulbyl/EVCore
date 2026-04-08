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
    <div className="mt-4 space-y-2">
      {items.map((item, index) => {
        const active = item.id === activeId;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={active ? "location" : undefined}
            className={`group flex items-start gap-3 rounded-2xl border px-3 py-3 transition ${
              active
                ? "border-cyan-300 bg-cyan-50 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.16)]"
                : "border-transparent hover:border-cyan-200 hover:bg-cyan-50"
            }`}
          >
            <span
              className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[0.7rem] font-semibold ${
                active
                  ? "border-cyan-300 bg-white text-cyan-700"
                  : "border-slate-200 bg-white text-slate-500 group-hover:border-cyan-200 group-hover:text-cyan-700"
              }`}
            >
              {index + 1}
            </span>
            <span
              className={`text-sm font-medium ${
                active
                  ? "text-slate-900"
                  : "text-slate-600 group-hover:text-slate-900"
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
