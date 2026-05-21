import Link from "next/link";
import {
  daysUntilWC2026,
  isWC2026Active,
  isWC2026Countdown,
} from "@/lib/events/world-cup-2026";

export function WC2026Banner() {
  const now = new Date();
  const active = isWC2026Active(now);
  const countdown = isWC2026Countdown(now);

  if (!active && !countdown) return null;

  return (
    <div className="border-b border-warning/20 bg-warning/[0.07] px-4 py-2 text-center text-sm">
      {countdown ? (
        <p className="text-warning">
          <span className="mr-2">🏆</span>
          <span className="font-semibold">Coupe du Monde 2026</span>
          <span className="mx-2 opacity-50">·</span>
          <span>
            Dans{" "}
            <strong className="tabular-nums">{daysUntilWC2026(now)}</strong>{" "}
            jours
          </span>
          <Link
            href="/dashboard/wc2026"
            className="ml-3 underline underline-offset-2 opacity-70 hover:opacity-100"
          >
            Préparer →
          </Link>
        </p>
      ) : (
        <p className="text-warning">
          <span className="mr-2">🏆</span>
          <span className="font-semibold">Coupe du Monde 2026</span>
          <span className="mx-2 opacity-50">·</span>
          <span className="animate-pulse font-medium">Tournoi en cours</span>
          <Link
            href="/dashboard/wc2026"
            className="ml-3 underline underline-offset-2 opacity-70 hover:opacity-100"
          >
            Voir les picks →
          </Link>
        </p>
      )}
    </div>
  );
}
