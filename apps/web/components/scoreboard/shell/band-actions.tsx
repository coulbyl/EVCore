import Link from "next/link";
import { cn } from "@evcore/ui/cn";
import { BellLink } from "./bell-link";

/**
 * La cloche et l'initiale du joueur, en haut à droite du bandeau sur
 * téléphone, en bas de la colonne gauche sur ordinateur. L'initiale mène à
 * Moi : il n'y a pas d'avatar à téléverser (09-moi.md § 5).
 */
export function BandActions({
  initial,
  avatarUrl,
  unread,
  labels,
  className,
}: {
  initial: string;
  /** The player's avatar, shown in place of the initial once chosen. */
  avatarUrl?: string | null;
  /** Unread notifications: the bell's badge (09 § 6); null when its read failed. */
  unread: number | null;
  labels: { notifications: string; me: string; unread: string };
  className?: string;
}) {
  const action =
    "flex size-11 items-center justify-center rounded-full border border-band-rule text-band-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-led-on";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BellLink
        unread={unread}
        labels={{
          notifications: labels.notifications,
          unread: labels.unread,
        }}
        className={action}
      />
      <Link
        href="/me"
        aria-label={labels.me}
        className={cn(action, "score overflow-hidden text-body font-semibold")}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a small local SVG
          <img src={avatarUrl} alt="" className="size-full" />
        ) : (
          initial
        )}
      </Link>
    </div>
  );
}
