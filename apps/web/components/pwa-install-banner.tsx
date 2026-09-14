"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@evcore/ui";

const DISMISSED_KEY = "evcore-pwa-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallBanner() {
  const t = useTranslations("pwaInstall");
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isIOSSafari, setIsIOSSafari] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    // Already installed — don't show
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const isIOSDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as Window & { MSStream?: unknown }).MSStream;
    const isSafariBrowser = /^((?!crios|fxios|edgios|oprios).)*safari/i.test(
      navigator.userAgent,
    );

    if (isIOSDevice) {
      setIsIOS(true);
      setIsIOSSafari(isSafariBrowser);
      setVisible(true);
      return;
    }

    // Chrome / Android / Edge — listen for the native install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom)+0.5rem)] left-1/2 z-30 w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-panel/96 px-4 py-3 shadow-[0_8px_32px_rgba(15,23,42,0.14)] backdrop-blur">
        {/* Icône */}
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sidebar">
          <span className="text-sm font-bold text-accent">EV</span>
        </div>

        {/* Texte */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {t("title")}
          </p>
          {isIOS ? (
            isIOSSafari ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("iosSafari")}
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("iosOther")}
              </p>
            )
          ) : (
            <p className="truncate text-xs text-muted-foreground">
              {t("subtitle")}
            </p>
          )}
        </div>

        {/* Bouton installer (Chrome / Android uniquement) */}
        {!isIOS && (
          <Button type="button" size="sm" onClick={handleInstall}>
            <Download data-icon="inline-start" />
            {t("install")}
          </Button>
        )}

        {/* Fermer */}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleDismiss}
          aria-label={t("close")}
          className="-mr-1 text-muted-foreground"
        >
          <X />
        </Button>
      </div>
    </div>
  );
}
