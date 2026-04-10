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
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const show = (e: Event) => {
      setPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);

      console.log(e, " ---show event");
    };

    // Cas 1 : l'event est déjà stocké sur window (capturé par PwaRegister avant notre montage)
    if (window.__pwaInstallPrompt) {
      console.log('cas 1 ---');
      show(window.__pwaInstallPrompt);
      return;
    }

    // Cas 2 : l'event arrive après notre montage
    window.addEventListener("pwainstallready", () => {
      console.log(window.__pwaInstallPrompt, " ---yo");
      if (window.__pwaInstallPrompt) show(window.__pwaInstallPrompt);
    });
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  };

  console.log(visible, " visible ---");

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom)+0.5rem)] z-30">
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
          <p className="truncate text-xs text-slate-500">
            Accès rapide depuis l&apos;écran d&apos;accueil
          </p>
        </div>

        {/* Bouton installer */}
        <button
          onClick={handleInstall}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#0f766e] px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
        >
          <Download size={13} />
          Installer
        </button>

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
