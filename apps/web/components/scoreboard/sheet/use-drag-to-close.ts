"use client";

import { useCallback, useRef, type RefObject } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { isCloseGesture } from "./sheet-constants";

type DragHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
};

/**
 * Glisser la poignée vers le bas referme la feuille ; relâchée trop tôt,
 * elle revient en place. La position est écrite directement sur le panneau
 * (pas d'état React par pixel) pour rester fluide sur un téléphone d'entrée
 * de gamme. Inactif quand la feuille n'est pas modale (écran large).
 */
export function useDragToClose({
  panelRef,
  enabled,
  onClose,
}: {
  panelRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  onClose: () => void;
}): DragHandlers {
  const start = useRef<{ y: number; time: number } | null>(null);
  const offset = useRef(0);

  const settle = useCallback(
    (closing: boolean) => {
      const panel = panelRef.current;
      start.current = null;
      if (!panel) return;
      if (closing) {
        onClose();
        return;
      }
      panel.style.transition = "transform 200ms cubic-bezier(0.32, 0.72, 0, 1)";
      panel.style.transform = "";
      offset.current = 0;
    },
    [panelRef, onClose],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0) return;
      // Un appui sur Fermer ou sur un lien de l'en-tête reste un clic : la
      // capture du pointeur l'avalerait.
      if (
        event.target instanceof Element &&
        event.target.closest("button, a, input, select, textarea")
      ) {
        return;
      }
      start.current = { y: event.clientY, time: event.timeStamp };
      offset.current = 0;
      event.currentTarget.setPointerCapture(event.pointerId);
      if (panelRef.current) panelRef.current.style.transition = "none";
    },
    [enabled, panelRef],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!start.current || !panelRef.current) return;
      offset.current = Math.max(0, event.clientY - start.current.y);
      panelRef.current.style.transform = `translateY(${offset.current}px)`;
    },
    [panelRef],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!start.current) return;
      settle(
        isCloseGesture({
          offsetPx: offset.current,
          elapsedMs: event.timeStamp - start.current.time,
        }),
      );
    },
    [settle],
  );

  const onPointerCancel = useCallback(() => settle(false), [settle]);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
