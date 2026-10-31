import Link from "next/link";

/**
 * The contextual « ? » (09 § 3): next to a word the app introduces
 * (« 8 sur 10 »), a tap opens its help sheet over the
 * screen, closed with a gesture. One source: the sheets of Aide. No hooks,
 * so it also sits in the ticket's client sheet.
 */
export function HelpHint({
  slug,
  label,
  tone = "surface",
}: {
  slug: string;
  /** « Aide : « 8 sur 10 », ça veut dire quoi ». */
  label: string;
  tone?: "surface" | "band";
}) {
  return (
    <Link
      href={`/me/help/${slug}`}
      aria-label={label}
      className={
        tone === "band"
          ? "ms-1 inline-flex size-5 items-center justify-center rounded-full border border-band-muted align-middle text-legal font-semibold text-band-muted hover:text-band-foreground focus-visible:outline-2 focus-visible:outline-led-on"
          : "ms-1 inline-flex size-5 items-center justify-center rounded-full border border-border align-middle text-legal font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      }
    >
      ?
    </Link>
  );
}
