/**
 * The EVCore mark (31/10): a scoreboard tile, three rising bars and the
 * lit amber diode of a chance. Bars in the current colour, so it reads on
 * the ink band and on the light floor alike. The same drawing makes
 * public/icons/icon.svg.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="currentColor"
    >
      <rect x="3" y="13" width="4" height="8" rx="1" />
      <rect x="10" y="9" width="4" height="12" rx="1" />
      <rect x="17" y="10.5" width="4" height="10.5" rx="1" opacity="0.55" />
      <circle cx="12" cy="4.5" r="2.5" className="fill-led-on" />
    </svg>
  );
}
