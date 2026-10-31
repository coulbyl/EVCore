import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PlayerBand } from "./player-band";

/**
 * The band of a page under a tab (Messages, Aide… under Moi): the way
 * back to the tab, the page's title as the screen's heading, and one short
 * line under it when the page has one.
 */
export async function SubpageBand({
  title,
  subtitle,
  back,
}: {
  title: string;
  subtitle?: string;
  back: { href: string; label: string };
}) {
  return (
    <PlayerBand>
      <div className="flex items-start gap-1">
        <Link
          href={back.href}
          aria-label={back.label}
          className="-ms-2 flex size-11 shrink-0 items-center justify-center rounded-full text-band-muted hover:text-band-foreground focus-visible:outline-2 focus-visible:outline-led-on"
        >
          <ChevronLeft aria-hidden strokeWidth={2} className="size-6" />
        </Link>
        <div className="flex min-h-11 flex-col justify-center">
          <h1 className="score text-title font-semibold">{title}</h1>
          {subtitle ? (
            <p className="text-meta text-band-muted">{subtitle}</p>
          ) : null}
        </div>
      </div>
    </PlayerBand>
  );
}
