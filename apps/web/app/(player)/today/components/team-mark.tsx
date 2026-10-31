import type { TodayTeam } from "@/domains/today/types/today";

/**
 * Le logo d'une équipe, ou ses trois lettres dans un rond quand il manque
 * (maquette Main). Décoratif : le nom est écrit à côté.
 *
 * `lazy` pour les longues listes (Matchs, jusqu'à 224 matchs) : les logos
 * hors de l'écran ne se chargent qu'à l'approche.
 */
export function TeamMark({
  team,
  lazy = false,
}: {
  team: TodayTeam;
  lazy?: boolean;
}) {
  if (team.logoUrl) {
    return (
      // A plain img: next/image brought its client runtime (~4 kio) into the
      // player's JS for 28 px logos the optimizer has nothing to gain on (C1).
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={team.logoUrl}
        alt=""
        width={28}
        height={28}
        decoding="async"
        loading={lazy ? "lazy" : undefined}
        className="size-7 shrink-0 object-contain"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="score flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-legal font-bold text-foreground"
    >
      {team.shortName.slice(0, 3).toUpperCase()}
    </span>
  );
}
