import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * La seconde ligne du bandeau du visiteur sur une page de détail : le
 * retour et le titre de l'écran, comme les sous-pages de Moi.
 */
export function BandTitle({
  title,
  back,
}: {
  title: string;
  back: { href: string; label: string };
}) {
  return (
    <div className="-ms-2 flex items-center gap-1">
      <Link
        href={back.href}
        aria-label={back.label}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-band-muted hover:text-band-foreground focus-visible:outline-2 focus-visible:outline-led-on"
      >
        <ChevronLeft aria-hidden strokeWidth={2} className="size-6" />
      </Link>
      <h1 className="score text-title font-semibold">{title}</h1>
    </div>
  );
}
