"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

const DISMISSED_KEY = "evcore-pwa-install-dismissed";
const SHOWN_THIS_SESSION_KEY = "evcore-pwa-install-shown";
const TOAST_ID = "pwa-install";
/** Visible assez longtemps pour être lu, jamais assez pour gêner. */
const TOAST_DURATION_MS = 12_000;
/**
 * Laisse la page se poser avant d'inviter. Nécessaire aussi techniquement :
 * le conteneur de toasts est monté après les pages dans `Providers`, et un
 * toast émis dans l'effet de montage d'une page part avant qu'il ne soit
 * abonné — il n'apparaît jamais.
 */
const SHOW_DELAY_MS = 2_000;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function readStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage, key: string): void {
  try {
    storage.setItem(key, "1");
  } catch {
    // Navigation privée ou stockage bloqué : on affiche, sans mémoire.
  }
}

/**
 * Invitation à installer l'application.
 *
 * Un toast, pas une bannière fixe : la bannière recouvrait le bas de
 * chaque page mobile — le bouton principal de l'accueil public, la dernière
 * carte de chaque liste — et s'empilait avec la barre de navigation basse
 * et le bouton flottant de l'assistant (revue UX du 2026-10-11, P0-1).
 * Même convention que l'état réseau (`NetworkStatusBanner`) : transitoire,
 * fermable, jamais au-dessus d'une action.
 *
 * Règles : une seule fois par session de navigation ; plus jamais après une
 * fermeture ; jamais quand l'application est déjà installée.
 */
export function PwaInstallBanner() {
  const t = useTranslations("pwaInstall");

  useEffect(() => {
    if (readStorage(localStorage, DISMISSED_KEY)) return;
    if (readStorage(sessionStorage, SHOWN_THIS_SESSION_KEY)) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const dismiss = () => writeStorage(localStorage, DISMISSED_KEY);
    const show = (options: {
      description: string;
      action?: { label: string; onClick: () => void };
    }) => {
      writeStorage(sessionStorage, SHOWN_THIS_SESSION_KEY);
      toast(t("title"), {
        id: TOAST_ID,
        description: options.description,
        duration: TOAST_DURATION_MS,
        action: options.action,
        // La croix du toast vaut « plus jamais » ; l'expiration, elle, ne
        // décide rien : le toast reviendra à la prochaine session.
        onDismiss: dismiss,
      });
    };

    const isIOSDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as Window & { MSStream?: unknown }).MSStream;
    if (isIOSDevice) {
      const isSafari = /^((?!crios|fxios|edgios|oprios).)*safari/i.test(
        navigator.userAgent,
      );
      const timer = window.setTimeout(
        () => show({ description: isSafari ? t("iosSafari") : t("iosOther") }),
        SHOW_DELAY_MS,
      );
      return () => window.clearTimeout(timer);
    }

    // Chrome / Android / Edge — l'invite native n'existe qu'après cet
    // événement ; le toast porte alors un vrai bouton « Installer ».
    let timer: number | undefined;
    const handler = (event: Event) => {
      event.preventDefault();
      const prompt = event as BeforeInstallPromptEvent;
      timer = window.setTimeout(
        () =>
          show({
            description: t("subtitle"),
            action: {
              label: t("install"),
              onClick: () => {
                void prompt.prompt().then(() => prompt.userChoice);
              },
            },
          }),
        SHOW_DELAY_MS,
      );
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [t]);

  return null;
}
