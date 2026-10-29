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
  labels,
  className,
}: {
  initial: string;
  labels: { notifications: string; me: string };
  className?: string;
}) {
  const action =
    "flex size-11 items-center justify-center rounded-full border border-band-rule text-band-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-led-on";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Link
        href="/notifications"
        aria-label={labels.notifications}
        className={action}
      >
        <Bell aria-hidden className="size-5" strokeWidth={1.8} />
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
