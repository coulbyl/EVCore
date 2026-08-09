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

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onVisible();
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, [onVisible, disabled]);

  return <div ref={ref} className="h-1 w-full" aria-hidden="true" />;
}
