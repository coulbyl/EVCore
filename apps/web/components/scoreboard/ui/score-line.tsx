import { useTranslations } from "next-intl";
import { cn } from "@evcore/ui/cn";
import type { SettledOutcome } from "./outcome";
import { ResultMark } from "./result-mark";

/**
 * La ligne de score, le geste signature du tableau d'affichage
 * (13-style.md § 5) : `FAV ✓ 1,24 · COM ✓ 1,41 · C2 ✗`.
 *
 * Sur le bandeau (`tone="band"`), gagné s'allume en ambre et perdu s'éteint ;
 * sur une surface claire (admin), gagné et perdu prennent leur vert et leur
 * rouge. Le signe porte l'issue dans les deux cas.
 *
 * Le code à trois lettres est ce qu'on voit ; le lecteur d'écran entend le
 * nom complet et l'issue en mots (« Favori : gagné, cote 1,24 »).
 */
export type ScoreItem = {
  /** Le code affiché : FAV, COM, C2, NUL, BTS, COR, ACC, IA. */
  code: string;
  /** Le nom complet, pour les lecteurs d'écran. */
  label: string;
  outcome: SettledOutcome;
  /** La cote payée, déjà formatée (« 1,24 »), après un gain. */
  odds?: string;
  /** Ce qui remplace l'issue en attente : l'heure du dernier match. */
  pendingText?: string;
};

const BAND_TONE: Record<SettledOutcome, string> = {
  won: "text-led-on",
  lost: "text-icon-subtle",
  void: "text-band-muted",
  pending: "text-band-muted",
};

const SURFACE_TONE: Record<SettledOutcome, string> = {
  won: "text-win",
  lost: "text-loss",
  void: "text-muted-foreground",
  pending: "text-muted-foreground",
};

export function ScoreLine({
  items,
  label,
  tone = "band",
  className,
}: {
  items: readonly ScoreItem[];
  /** Ce que la ligne résume (« Hier »). */
  label: string;
  tone?: "band" | "surface";
  className?: string;
}) {
  const t = useTranslations("scoreboard.outcome");
  const colors = tone === "band" ? BAND_TONE : SURFACE_TONE;

  function spoken(item: ScoreItem): string {
    const values = { label: item.label };
    switch (item.outcome) {
      case "won":
        return item.odds
          ? t("wonAt", { ...values, odds: item.odds })
          : t("won", values);
      case "lost":
        return t("lost", values);
      case "void":
        return t("void", values);
      case "pending":
        return item.pendingText
          ? t("pendingUntil", { ...values, time: item.pendingText })
          : t("pending", values);
    }
  }

  return (
    <ul
      aria-label={label}
      className={cn(
        "flex flex-wrap items-baseline gap-x-4 gap-y-1 score text-title font-semibold tracking-[0.02em]",
        className,
      )}
    >
      {items.map((item) => (
        <li
          key={item.code}
          className={cn(
            "inline-flex items-baseline gap-1.5",
            colors[item.outcome],
          )}
        >
          <span aria-hidden>{item.code}</span>
          {item.outcome === "pending" ? (
            <span aria-hidden className="text-body">
              {item.pendingText}
            </span>
          ) : (
            <ResultMark
              kind={item.outcome}
              colored={false}
              size="sm"
              className="self-center"
            />
          )}
          {item.odds && item.outcome === "won" ? (
            <span
              aria-hidden
              className={cn(
                "text-body",
                tone === "band" ? "text-band-foreground" : "text-foreground",
              )}
            >
              {item.odds}
            </span>
          ) : null}
          <span className="sr-only">{spoken(item)}</span>
        </li>
      ))}
    </ul>
  );
}
