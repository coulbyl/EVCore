"use client";

import { useEffect, useState } from "react";
import { isWC2026Active } from "@/lib/events/world-cup-2026";

const STORAGE_KEY = "wc2026-splash-seen";

const FLAGS = [
  { emoji: "🇺🇸", label: "USA" },
  { emoji: "🇨🇦", label: "Canada" },
  { emoji: "🇲🇽", label: "Mexique" },
];

export function WC2026Splash() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isWC2026Active()) return;
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    setVisible(true);
  }, []);

  function dismiss() {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-[#0a0f1e] md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Coupe du Monde 2026"
    >
      {/* Trophée */}
      <div
        className="text-7xl"
        style={{ animation: "wc2026-trophy-glow 2.4s ease-in-out infinite" }}
      >
        🏆
      </div>

      {/* Titre */}
      <div className="text-center">
        <p className="text-2xl font-bold tracking-tight text-[#c9a84c]">
          EVCore
        </p>
        <p className="mt-1 text-lg font-semibold text-white">
          Coupe du Monde 2026
        </p>
      </div>

      {/* Drapeaux hôtes */}
      <div className="flex items-center gap-4">
        {FLAGS.map((flag, i) => (
          <span
            key={flag.label}
            className="text-4xl"
            style={{
              animation: `wc2026-flag-in 0.5s ease-out ${i * 0.15}s both`,
            }}
            title={flag.label}
          >
            {flag.emoji}
          </span>
        ))}
      </div>

      <p className="text-sm text-white/50">11 juin – 19 juillet 2026</p>

      <button
        onClick={dismiss}
        className="mt-2 rounded-xl border border-[#c9a84c]/40 bg-[#c9a84c]/10 px-6 py-2.5 text-sm font-semibold text-[#c9a84c] transition-colors hover:bg-[#c9a84c]/20 active:scale-95"
      >
        Voir les picks →
      </button>
    </div>
  );
}
