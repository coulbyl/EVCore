import localFont from "next/font/local";

/**
 * Les deux voix du tableau d'affichage (docs/refonte-ui/13-style.md § 3).
 *
 * - Barlow Condensed porte tout ce qui est score : codes d'équipe, cotes,
 *   « 8 sur 10 », heures, compteurs. Toujours en chiffres tabulaires.
 * - Barlow porte le texte : équipes, paris nommés, faits, lignes d'état.
 *
 * Deux graisses par voix, pas plus : un écran n'en montre jamais davantage,
 * et chaque graisse coûte ~22 Ko au premier chargement sur un réseau 3G
 * (budget dans docs/refonte-ui/16-performance-et-qualite.md § 2).
 *
 * Fichiers : Google Fonts, sous-ensemble latin (U+0000-00FF, U+0152-0153,
 * U+2000-206F, U+20AC…), qui couvre le français. Licence SIL OFL 1.1, texte
 * dans ./barlow/OFL.txt. Les glyphes ✓ ✗ ≠ n'y sont pas : ils se dessinent en
 * SVG dans les composants, jamais en texte.
 *
 * Ces polices ne sont chargées que par la coquille de la refonte, pas par la
 * mise en page racine : les anciens écrans ne paient pas leur préchargement
 * tant qu'ils existent.
 */
export const scoreboardText = localFont({
  src: [
    { path: "./barlow/Barlow-400-latin.woff2", weight: "400", style: "normal" },
    { path: "./barlow/Barlow-500-latin.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-barlow",
  display: "swap",
  adjustFontFallback: "Arial",
  fallback: ["system-ui", "Arial", "sans-serif"],
});

export const scoreboardScore = localFont({
  src: [
    {
      path: "./barlow/BarlowCondensed-600-latin.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./barlow/BarlowCondensed-700-latin.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-barlow-condensed",
  display: "swap",
  adjustFontFallback: "Arial",
  fallback: ["Arial Narrow", "system-ui", "sans-serif"],
});

/** Les deux variables CSS à poser sur la racine de la coquille. */
export const scoreboardFontVariables = `${scoreboardText.variable} ${scoreboardScore.variable}`;
