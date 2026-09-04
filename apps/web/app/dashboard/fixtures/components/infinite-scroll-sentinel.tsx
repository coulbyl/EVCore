"use client";

import { useEffect, useRef } from "react";

export function InfiniteScrollSentinel({
  onVisible,
  disabled,
}: {
  onVisible: () => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;

    // rootMargin prefetches the next page while it's still 600px below the
    // viewport instead of waiting for the sentinel to actually scroll into
    // view — hides the round-trip behind scroll time rather than blocking
    // on it (TODO.md "page Matchs 2-3x plus lente").
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onVisible();
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, [onVisible, disabled]);

  return <div ref={ref} className="h-1 w-full" aria-hidden="true" />;
}
