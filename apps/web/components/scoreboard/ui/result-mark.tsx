import { Check, EqualNot, Minus, X } from "lucide-react";
import { cn } from "@evcore/ui/cn";

/**
 * Les signes ✓ ✗ ≠ et le remboursé, dessinés en SVG : Barlow ne les a pas
 * dans son sous-ensemble latin, et une police de repli du système les
 * dessinerait chacune à sa manière.
 *
 * Le signe porte l'issue par sa forme, la couleur ne fait que la redoubler
 * (le vert et le rouge ont presque la même luminosité, 1,13:1 en clair).
 *
 * `colored={false}` laisse la couleur du parent (la ligne de score du
 * bandeau, où gagné s'allume en ambre). Sans `label`, le signe est
 * décoratif : le texte voisin doit dire l'issue.
 */
export type MarkKind = "won" | "lost" | "void" | "diverges";

const ICONS = { won: Check, lost: X, void: Minus, diverges: EqualNot };

const COLORS: Record<MarkKind, string> = {
  won: "text-win",
  lost: "text-loss",
  void: "text-muted-foreground",
  diverges: "text-current",
};

const BAND_COLORS: Record<MarkKind, string> = {
  won: "text-win-band",
  lost: "text-loss-band",
  void: "text-band-muted",
  diverges: "text-current",
};

const SIZES = {
  sm: "size-3.5",
  md: "size-5",
  lg: "size-8",
} as const;

export function ResultMark({
  kind,
  label,
  size = "md",
  colored = true,
  tone = "surface",
  className,
}: {
  kind: MarkKind;
  label?: string;
  size?: keyof typeof SIZES;
  colored?: boolean;
  /** `band`: on the ink band, the shades that read there. */
  tone?: "surface" | "band";
  className?: string;
}) {
  const Icon = ICONS[kind];
  return (
    <Icon
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      strokeWidth={2.75}
      className={cn(
        "inline-block shrink-0",
        SIZES[size],
        colored && (tone === "band" ? BAND_COLORS : COLORS)[kind],
        className,
      )}
    />
  );
}
