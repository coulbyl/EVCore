"use client";

import { useState } from "react";
import * as HoverCard from "@radix-ui/react-hover-card";
import { cn } from "@evcore/ui";
import { useLocale, useTranslations } from "next-intl";
import { formatSignedRate } from "@/app/dashboard/track-record/track-record-constants";
import { formatOddsValue } from "@/lib/frequency";

/**
 * Ligne de clôture d'une sélection réglée : cote juste avant le coup d'envoi.
 *
 * La valeur signée (ce que la cote prise vaut face à la probabilité de
 * clôture sans marge) n'est plus affichée en ligne : « −4.0 % » en orange
 * sous un pick gagné se lisait comme une perte, alors que c'est la marge
 * payée (revue UX du 2026-10-11, P1-7). Elle reste dans le détail, avec la
 * comparaison qui a un sens : un pari pris au prix de clôture vaut MOINS LA
 * MARGE, pas zéro. La couleur ne compare donc jamais à zéro — vert seulement
 * quand la marge payée est connue ET que la cote prise la battait, neutre
 * dans tous les autres cas (marge inconnue comprise). Rien tant que la
 * clôture n'est pas connue — même convention que ResultBadge.
 *
 * HoverCard contrôlée (même motif qu'InfoTooltip) : un Tooltip au survol ne
 * s'ouvre jamais sur mobile, le clic doit faire la même chose.
 */
export function ClosingLine({
  closingOdds,
  closingLineValue,
  closingBookmaker,
  marginPaid,
  testId = "selection-closing",
}: {
  closingOdds: number | null;
  closingLineValue: number | null;
  closingBookmaker: string | null;
  /** Marge du bookmaker au moment de la prise ; null quand inconnue. */
  marginPaid: number | null;
  testId?: string;
}) {
  const t = useTranslations("closingLine");
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  if (closingOdds === null || closingLineValue === null) return null;

  const beatsClose = marginPaid !== null && closingLineValue >= -marginPaid;
  const verdict =
    marginPaid === null
      ? "unknownMargin"
      : beatsClose
        ? "beatsClose"
        : "behindClose";

  return (
    <HoverCard.Root
      open={open}
      onOpenChange={setOpen}
      openDelay={200}
      closeDelay={100}
    >
      <HoverCard.Trigger asChild>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          data-testid={testId}
          data-verdict={verdict}
          // Zone de tap de 44 px de haut sans changer la hauteur de la ligne.
          className={cn(
            "-my-3 inline-flex min-h-11 items-center tabular-nums focus:outline-none",
            beatsClose ? "text-success" : "text-muted-foreground",
          )}
        >
          {t("label", { odds: formatOddsValue(closingOdds, locale) })}
        </button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          sideOffset={8}
          onEscapeKeyDown={() => setOpen(false)}
          onPointerDownOutside={() => setOpen(false)}
          className="z-50 w-72 rounded-2xl border border-border bg-panel p-3 text-xs text-foreground shadow-lg"
        >
          <p>
            {t("detail", {
              bookmaker: closingBookmaker ?? "—",
              value: formatSignedRate(closingLineValue, locale),
            })}
          </p>
          <p className="mt-1 text-muted-foreground">
            {t(`verdict.${verdict}`, {
              margin:
                marginPaid !== null
                  ? formatSignedRate(-marginPaid, locale)
                  : "—",
            })}
          </p>
          <HoverCard.Arrow className="fill-panel" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
