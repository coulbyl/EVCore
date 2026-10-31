"use client";

import { useEffect, useRef, useState } from "react";

type Reading = { label: string; value: string };

const RULER_HEIGHT = 160;
const RULER_STEP = 10;

/**
 * The live readings of the viewport and a ruler fixed at the bottom. Every
 * figure is in CSS pixels; they change as the browser's bars fold, so the
 * screen is read again on resize and on scroll.
 */
export function ViewportProbe() {
  const units = {
    svh: useRef<HTMLDivElement>(null),
    dvh: useRef<HTMLDivElement>(null),
    lvh: useRef<HTMLDivElement>(null),
  };
  const insetsRef = useRef<HTMLDivElement>(null);
  const fixedRef = useRef<HTMLDivElement>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [userAgent, setUserAgent] = useState("");

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      setReadings(readViewport({ units, insetsRef, fixedRef }));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    setUserAgent(navigator.userAgent);
    const viewport = window.visualViewport;
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
    };
    // The refs are stable; reading them once per event is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 rounded-[0.875rem] border border-border bg-card p-4 text-body">
        {readings.map((reading) => (
          <div key={reading.label} className="contents">
            <dt className="text-muted-foreground">{reading.label}</dt>
            <dd className="score text-end font-semibold">{reading.value}</dd>
          </div>
        ))}
      </dl>
      <p className="break-all text-legal text-muted-foreground">{userAgent}</p>
      <p className="text-meta text-muted-foreground">
        Fais défiler jusqu&apos;en bas pour replier la barre du navigateur.
      </p>
      <div aria-hidden className="h-[150svh]" />
      <p className="pb-4 text-meta text-muted-foreground">Fin de la page</p>

      {/* Probes: never seen, only measured. */}
      <div
        aria-hidden
        className="pointer-events-none invisible absolute top-0 w-px"
      >
        <div ref={units.svh} style={{ height: "100svh" }} />
        <div ref={units.dvh} style={{ height: "100dvh" }} />
        <div ref={units.lvh} style={{ height: "100lvh" }} />
        <div
          ref={insetsRef}
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        />
      </div>
      <div
        ref={fixedRef}
        aria-hidden
        className="pointer-events-none invisible fixed bottom-0 h-px w-px"
      />
      <BottomRuler />
    </>
  );
}

/**
 * Graduations every 10 px up from where `bottom: 0` lands, above the tabs
 * and an open sheet, on the left (the dev server's badge sits bottom
 * right). The lowest one still visible tells how much the browser lays
 * over the page.
 */
function BottomRuler() {
  const marks = Array.from(
    { length: RULER_HEIGHT / RULER_STEP + 1 },
    (_, index) => index * RULER_STEP,
  );
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed bottom-0 left-0 z-[60] w-16 border-r border-border bg-card/90"
      style={{ height: RULER_HEIGHT }}
    >
      {marks.map((mark) => {
        const labelled = mark % (RULER_STEP * 2) === 0;
        return (
          <div
            key={mark}
            className="absolute left-0 flex items-center gap-1"
            style={{ bottom: mark, transform: "translateY(50%)" }}
          >
            <span
              className={
                labelled ? "h-px w-4 bg-foreground" : "h-px w-2 bg-loss"
              }
            />
            {labelled ? (
              <span className="score text-legal font-semibold leading-none">
                {mark}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function readViewport({
  units,
  insetsRef,
  fixedRef,
}: {
  units: Record<"svh" | "dvh" | "lvh", React.RefObject<HTMLDivElement | null>>;
  insetsRef: React.RefObject<HTMLDivElement | null>;
  fixedRef: React.RefObject<HTMLDivElement | null>;
}): Reading[] {
  const px = (value: number | undefined) =>
    value === undefined ? "—" : `${Math.round(value * 10) / 10}`;
  const heightOf = (ref: React.RefObject<HTMLDivElement | null>) =>
    ref.current?.getBoundingClientRect().height;
  const viewport = window.visualViewport;
  const insets = insetsRef.current
    ? getComputedStyle(insetsRef.current)
    : undefined;
  const fixedBottom = fixedRef.current?.getBoundingClientRect().bottom;
  const visibleBottom = viewport
    ? viewport.offsetTop + viewport.height
    : undefined;
  const svh = heightOf(units.svh);
  const dvh = heightOf(units.dvh);
  const lvh = heightOf(units.lvh);

  return [
    {
      label: "Fenêtre (innerWidth × innerHeight)",
      value: `${window.innerWidth} × ${window.innerHeight}`,
    },
    {
      label: "Page (clientHeight)",
      value: px(document.documentElement.clientHeight),
    },
    { label: "Zone visible (visualViewport)", value: px(viewport?.height) },
    { label: "Zone visible, décalage haut", value: px(viewport?.offsetTop) },
    { label: "Zoom", value: viewport ? `${viewport.scale}` : "—" },
    { label: "100svh", value: px(svh) },
    { label: "100dvh", value: px(dvh) },
    { label: "100lvh", value: px(lvh) },
    {
      label: "100lvh − 100dvh",
      value: lvh !== undefined && dvh !== undefined ? px(lvh - dvh) : "—",
    },
    { label: "Zone sûre haut", value: insets ? insets.paddingTop : "—" },
    { label: "Zone sûre bas", value: insets ? insets.paddingBottom : "—" },
    { label: "Bas d'un élément fixé", value: px(fixedBottom) },
    {
      label: "Fixé hors zone visible",
      value:
        fixedBottom !== undefined && visibleBottom !== undefined
          ? px(fixedBottom - visibleBottom)
          : "—",
    },
    { label: "Défilement", value: px(window.scrollY) },
    {
      label: "Écran d'accueil",
      value: window.matchMedia("(display-mode: standalone)").matches
        ? "oui"
        : "non",
    },
  ];
}
