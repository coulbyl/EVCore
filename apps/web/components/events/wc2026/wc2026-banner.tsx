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
    <div className="border-b border-[#c9a84c]/20 bg-[#0a0f1e]/95 px-4 py-2 text-center text-sm backdrop-blur">
      {countdown ? (
        <p className="text-[#c9a84c]">
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
        <p className="text-[#c9a84c]">
          <span className="mr-2">🏆</span>
          <span className="font-semibold">Coupe du Monde 2026</span>
          <span className="mx-2 opacity-50">·</span>
          <span className="animate-pulse font-medium text-[#e8b84b]">
            Tournoi en cours
          </span>
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
