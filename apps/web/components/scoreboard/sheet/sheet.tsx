"use client";

import { useId, useRef } from "react";
import { usePlayerText } from "../text/player-texts";
import { X } from "lucide-react";
// clsx alone: no class comes from outside, nothing for tailwind-merge to
// resolve, and it weighed 8.5 kio of the player's JS (C0).
import { clsx as cn } from "clsx";
import { useDragToClose } from "./use-drag-to-close";
import { useModalSheet } from "./use-modal-sheet";
import { useSheetClose } from "./use-sheet-close";
import { useWideScreen } from "./use-wide-screen";

/**
 * La feuille du tableau d'affichage (04 § 1, 10 § 4) : coupon ouvert, fiche
 * de match, ticket, détail d'un produit.
 *
 * - Téléphone et tablette : modale, elle monte du bas par-dessus l'écran, sur
 *   un voile ; on la referme d'un geste vers le bas, d'un toucher sur le
 *   voile, par Échap ou par le bouton retour du téléphone.
 * - À partir de 1024 px : colonne de droite, à côté de la liste, sans voile
 *   ni piège à focus (on lit la liste et le détail ensemble).
 *
 * Elle se rend dans la fente `@sheet` de la mise en page du joueur ; la mise
 * en forme est en CSS, seul le comportement dépend de la largeur.
 *
 * `tone="band"` met l'en-tête sur l'encre du bandeau (le coupon ouvert des
 * maquettes) ; `bandContent` s'y ajoute sous le titre. `footer` reste fixé
 * en bas, visible pendant le défilement (le bouton Suivre).
 */
export function Sheet({
  title,
  fallbackHref,
  tone = "plain",
  bandContent,
  footer,
  children,
}: {
  title: string;
  /** Où aller si la feuille a été ouverte sans historique. */
  fallbackHref: string;
  tone?: "plain" | "band";
  bandContent?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = usePlayerText("shell");
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const wide = useWideScreen();
  const close = useSheetClose(fallbackHref);
  useModalSheet({ panelRef, modal: !wide, onClose: close });
  const drag = useDragToClose({ panelRef, enabled: !wide, onClose: close });

  const onBand = tone === "band";

  return (
    <>
      <div
        aria-hidden
        onClick={close}
        className="fixed inset-0 z-50 animate-scrim-in bg-scrim motion-reduce:animate-none lg:hidden"
      />
      <div
        ref={panelRef}
        role={wide ? "complementary" : "dialog"}
        aria-modal={wide ? undefined : true}
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[1.25rem] bg-card text-card-foreground outline-none",
          "animate-sheet-up motion-reduce:animate-none",
          "md:mx-auto md:max-w-[34rem]",
          "lg:sticky lg:inset-x-auto lg:top-0 lg:bottom-auto lg:z-auto lg:mx-0 lg:h-dvh lg:max-h-none lg:w-full lg:max-w-none lg:animate-none lg:rounded-none lg:border-l lg:border-border",
        )}
      >
        <div
          {...drag}
          className={cn(
            "shrink-0 touch-none select-none lg:touch-auto lg:select-auto",
            onBand && "bg-band text-band-foreground",
          )}
        >
          <div aria-hidden className="flex justify-center pt-2 lg:hidden">
            <span
              className={cn(
                "h-1 w-10 rounded-full",
                onBand ? "bg-band-rule" : "bg-border",
              )}
            />
          </div>
          <div className="flex min-h-14 items-center gap-2 pl-4 pr-1.5 lg:pt-2">
            <h2
              id={titleId}
              className="min-w-0 flex-1 score text-title font-semibold"
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={t("close")}
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2",
                onBand
                  ? "text-band-foreground hover:bg-sidebar-accent focus-visible:outline-led-on"
                  : "text-muted-foreground hover:bg-muted focus-visible:outline-ring",
              )}
            >
              <X aria-hidden className="size-5" strokeWidth={2} />
            </button>
          </div>
          {bandContent ? (
            <div
              className={cn(
                "px-4 pb-3.5",
                onBand && "border-t border-band-rule pt-3",
              )}
            >
              {bandContent}
            </div>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-border bg-card px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:pb-4">
            {footer}
          </div>
        ) : null}
      </div>
    </>
  );
}
