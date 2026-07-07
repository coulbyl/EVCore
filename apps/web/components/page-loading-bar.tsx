"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@evcore/ui/cn";

const TRICKLE_INTERVAL_MS = 200;
const TRICKLE_STEP = 4;
const TRICKLE_CAP = 90;
const COMPLETE_HOLD_MS = 200;

function eligibleInternalHref(target: EventTarget | null): string | null {
  const anchor = (target as Element | null)?.closest?.("a");
  if (!anchor || !(anchor instanceof HTMLAnchorElement) || !anchor.href) {
    return null;
  }
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  if (url.pathname === window.location.pathname) return null;
  return url.pathname;
}

/** Thin top-of-viewport progress bar shown while navigating between routes
 * — trickles up on an internal link click, snaps to 100% and fades out once
 * the pathname actually changes. Query-only changes (filters, tabs) don't
 * trigger it, only real page navigation does. */
export function PageLoadingBar() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const isLoadingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function stopTrickle() {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      if (!eligibleInternalHref(event.target)) return;

      isLoadingRef.current = true;
      setVisible(true);
      setProgress(8);
      stopTrickle();
      intervalRef.current = setInterval(() => {
        setProgress((p) => (p >= TRICKLE_CAP ? p : p + TRICKLE_STEP));
      }, TRICKLE_INTERVAL_MS);
    }

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      stopTrickle();
    };
  }, []);

  useEffect(() => {
    if (!isLoadingRef.current) return;
    isLoadingRef.current = false;
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setProgress(100);
    const timeout = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, COMPLETE_HOLD_MS);
    return () => clearTimeout(timeout);
  }, [pathname]);

  return (
    <div
      aria-hidden
      className={cn(
        "fixed inset-x-0 top-0 z-50 h-[2px] transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        className="h-full bg-accent shadow-[0_0_8px_var(--accent)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
