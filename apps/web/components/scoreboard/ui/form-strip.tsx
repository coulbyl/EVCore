import { cn } from "@evcore/ui/cn";
import type { Outcome } from "./outcome";

/**
 * La forme d'un produit : un carré par jour (ou par avis), du plus ancien au
 * plus récent (04 § 1, 08 § 2).
 *
 * Un seul SVG pour toute la bande, pas un élément par jour : 90 carrés dans
 * la grille d'un produit restent un nœud.
 *
 * L'issue se lit à la forme autant qu'à la couleur, parce que le vert et le
 * rouge ont presque la même luminosité :
 * - gagné : carré plein vert ;
 * - perdu : carré plein rouge, barré d'une croix ;
 * - remboursé : contour, traversé d'un trait ;
 * - en attente : contour seul ;
 * - aucun coupon ce jour-là : carré gris clair.
 *
 * `columns` replie la bande en grille (la grille des 90 jours, 15 par ligne).
 * `label` résume la bande pour les lecteurs d'écran (« 19 jours gagnés sur
 * 24, 3 perdus »).
 */
const SIZES = {
  sm: { cell: 9, gap: 3, radius: 1.5, stroke: 1.25 },
  md: { cell: 12, gap: 4, radius: 2, stroke: 1.5 },
} as const;

export function FormStrip({
  outcomes,
  label,
  size = "md",
  columns,
  className,
}: {
  outcomes: readonly Outcome[];
  label: string;
  size?: keyof typeof SIZES;
  columns?: number;
  className?: string;
}) {
  const { cell, gap, radius, stroke } = SIZES[size];
  const perRow = Math.max(1, columns ?? outcomes.length);
  const rows = Math.max(1, Math.ceil(outcomes.length / perRow));
  const width = perRow * cell + (perRow - 1) * gap;
  const height = rows * cell + (rows - 1) * gap;
  const inset = stroke / 2;
  const cross = cell * 0.28;

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("block h-auto max-w-full", className)}
    >
      {outcomes.map((outcome, index) => {
        const x = (index % perRow) * (cell + gap);
        const y = Math.floor(index / perRow) * (cell + gap);
        const key = `${index}-${outcome}`;
        switch (outcome) {
          case "won":
            return (
              <rect
                key={key}
                x={x}
                y={y}
                width={cell}
                height={cell}
                rx={radius}
                className="fill-win"
              />
            );
          case "lost":
            return (
              <g key={key}>
                <rect
                  x={x}
                  y={y}
                  width={cell}
                  height={cell}
                  rx={radius}
                  className="fill-loss"
                />
                <path
                  d={`M${x + cross} ${y + cross}L${x + cell - cross} ${y + cell - cross}M${x + cell - cross} ${y + cross}L${x + cross} ${y + cell - cross}`}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  className="stroke-card"
                />
              </g>
            );
          case "void":
            return (
              <g key={key}>
                <rect
                  x={x + inset}
                  y={y + inset}
                  width={cell - stroke}
                  height={cell - stroke}
                  rx={radius}
                  strokeWidth={stroke}
                  className="fill-none stroke-muted-foreground"
                />
                <path
                  d={`M${x + cross} ${y + cell / 2}H${x + cell - cross}`}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  className="stroke-muted-foreground"
                />
              </g>
            );
          case "pending":
            return (
              <rect
                key={key}
                x={x + inset}
                y={y + inset}
                width={cell - stroke}
                height={cell - stroke}
                rx={radius}
                strokeWidth={stroke}
                className="fill-none stroke-icon-subtle"
              />
            );
          case "none":
            return (
              <rect
                key={key}
                x={x}
                y={y}
                width={cell}
                height={cell}
                rx={radius}
                className="fill-border"
              />
            );
        }
      })}
    </svg>
  );
}
