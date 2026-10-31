import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@evcore/ui/cn";

/**
 * La cloche et l'initiale du joueur, en haut à droite du bandeau sur
 * téléphone, en bas de la colonne gauche sur ordinateur. L'initiale mène à
 * Moi : il n'y a pas d'avatar à téléverser (09-moi.md § 5).
 */
export function BandActions({
  initial,
  unread = 0,
  labels,
  className,
}: {
  initial: string;
  /** Unread notifications: the bell's badge (09 § 6). */
  unread?: number;
  labels: { notifications: string; me: string; unread: string };
  className?: string;
}) {
  const action =
    "flex size-11 items-center justify-center rounded-full border border-band-rule text-band-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-led-on";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Link
        href="/notifications"
        aria-label={
          unread > 0
            ? `${labels.notifications}, ${labels.unread.replace("{count}", String(unread))}`
            : labels.notifications
        }
        className={cn(action, "relative")}
      >
        <Bell aria-hidden className="size-5" strokeWidth={1.8} />
        {unread > 0 ? (
          <span
            aria-hidden
            className="score absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-led-on px-1 text-legal font-bold text-band"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Link>
      <Link
        href="/me"
        aria-label={labels.me}
        className={cn(action, "score text-body font-semibold")}
      >
        {initial}
      </Link>
    </div>
  );
}
