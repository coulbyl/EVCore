"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";

const DISMISSED_KEY = "evcore-pwa-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    // Already installed — don't show
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const isIOSDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as Window & { MSStream?: unknown }).MSStream;

    if (isIOSDevice) {
      setIsIOS(true);
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
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/96 px-4 py-3 shadow-[0_8px_32px_rgba(15,23,42,0.14)] backdrop-blur">
        {/* Icône */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#142033]">
          <span className="text-sm font-bold text-[#0f766e]">EV</span>
        </div>

        {/* Texte */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">
            Installer EVCore
          </p>
          {isIOS ? (
            <p className="text-xs text-slate-500">
              Tap&nbsp;⎋ puis &laquo;&nbsp;Sur l&apos;écran
              d&apos;accueil&nbsp;&raquo;
            </p>
          ) : (
            <p className="truncate text-xs text-slate-500">
              Accès rapide depuis l&apos;écran d&apos;accueil
            </p>
          )}
        </div>

        {/* Bouton installer (Chrome / Android uniquement) */}
        {!isIOS && (
          <button
            onClick={handleInstall}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#0f766e] px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
          >
            <Download size={13} />
            Installer
          </button>
        )}

        {/* Fermer */}
        <button
          onClick={handleDismiss}
          aria-label="Fermer"
          className="-mr-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
