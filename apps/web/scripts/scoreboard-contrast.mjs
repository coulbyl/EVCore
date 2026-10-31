/**
 * Contrôle des contrastes du tableau d'affichage (WCAG 2.2).
 *
 * Lit les deux blocs de app/styles/scoreboard.css (`.scoreboard` et
 * `.dark .scoreboard`), résout les `var()` et vérifie chaque paire qu'un
 * écran affiche réellement. Texte : 4,5:1. Élément graphique ou focus : 3:1.
 * Sans dépendance, pour tourner en CI avec node seul.
 *
 * Usage : node scripts/scoreboard-contrast.mjs   (code de sortie 1 si échec)
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "../app/styles/scoreboard.css"), "utf8");

function block(selector) {
  // Le sélecteur en début de ligne (indentation permise, les blocs vivent dans
  // `@layer base`) : `.dark .scoreboard {` contient aussi `.scoreboard {`, il
  // ne doit pas être pris pour le bloc clair.
  const escaped = selector.replace(/\./g, "\\.");
  const head = css.search(new RegExp(`^\\s*${escaped} \\{`, "m"));
  if (head < 0) throw new Error(`Bloc introuvable : ${selector}`);
  const open = css.indexOf("{", head);
  let depth = 0;
  let end = open;
  for (; end < css.length; end += 1) {
    if (css[end] === "{") depth += 1;
    if (css[end] === "}" && --depth === 0) break;
  }
  const vars = {};
  for (const m of css.slice(open, end).matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    vars[m[1]] = m[2].trim();
  }
  return vars;
}

const light = block(".scoreboard");
const dark = { ...light, ...block(".dark .scoreboard") };

function value(vars, token, depth = 0) {
  if (depth > 10) throw new Error(`Référence circulaire : ${token}`);
  const raw = vars[token];
  if (raw === undefined) throw new Error(`Jeton inconnu : ${token}`);
  const ref = raw.match(/^var\((--[\w-]+)\)$/);
  return ref ? value(vars, ref[1], depth + 1) : raw;
}

function luminance(hex) {
  const h = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`Couleur non opaque : ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = Number.parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const GRAPHIC = 3;

/** [premier plan, fond, seuil, ce que l'écran montre] */
const PAIRS = [
  ["--foreground", "--background", TEXT, "texte sur le sol"],
  ["--card-foreground", "--card", TEXT, "texte sur une carte"],
  ["--muted-foreground", "--card", TEXT, "texte secondaire sur une carte"],
  ["--muted-foreground", "--background", TEXT, "texte secondaire sur le sol"],
  ["--primary-foreground", "--primary", TEXT, "libellé du bouton principal"],
  ["--accent-foreground", "--accent", TEXT, "libellé sur fond d'action"],
  ["--secondary-foreground", "--secondary", TEXT, "texte sur fond secondaire"],
  ["--win", "--card", TEXT, "résultat gagné sur une carte"],
  ["--win", "--background", TEXT, "résultat gagné sur le sol"],
  ["--loss", "--card", TEXT, "résultat perdu sur une carte"],
  ["--loss", "--background", TEXT, "résultat perdu sur le sol"],
  [
    "--destructive-foreground",
    "--destructive",
    TEXT,
    "libellé sur fond destructif",
  ],
  ["--warning", "--card", TEXT, "avertissement sur une carte"],
  ["--band-foreground", "--band", TEXT, "texte du bandeau"],
  ["--band-muted", "--band", TEXT, "texte secondaire du bandeau"],
  ["--led-on", "--band", TEXT, "score allumé dans le bandeau"],
  ["--ramp-5", "--band", TEXT, "score éteint (perdu) dans le bandeau"],
  ["--sidebar-foreground", "--sidebar", TEXT, "entrée de la colonne gauche"],
  [
    "--sidebar-accent-foreground",
    "--sidebar-accent",
    TEXT,
    "entrée active de la colonne",
  ],
  ["--ring", "--card", GRAPHIC, "anneau de focus sur une carte"],
  ["--ring", "--background", GRAPHIC, "anneau de focus sur le sol"],
  [
    "--icon-subtle",
    "--card",
    GRAPHIC,
    "chevron et icône discrète sur une carte",
  ],
  ["--led-on-edge", "--card", GRAPHIC, "contour d'une diode allumée"],
  [
    "--led-off-edge",
    "--card",
    GRAPHIC,
    "contour d'une diode éteinte (clair)",
    "light",
  ],
  [
    "--led-on",
    "--led-off-edge",
    GRAPHIC,
    "diode allumée contre éteinte (sombre)",
    "dark",
  ],
  [
    "--led-on",
    "--led-off-band",
    GRAPHIC,
    "diode allumée contre éteinte (bandeau)",
  ],
  ["--win", "--card", GRAPHIC, "carré de forme gagné"],
  ["--loss", "--card", GRAPHIC, "carré de forme perdu"],
];

let failures = 0;
for (const [theme, vars] of [
  ["light", light],
  ["dark", dark],
]) {
  console.log(`\n${theme === "light" ? "Clair" : "Sombre"}`);
  for (const [fg, bg, min, label, only] of PAIRS) {
    if (only && only !== theme) continue;
    const r = ratio(value(vars, fg), value(vars, bg));
    const ok = r >= min;
    if (!ok) failures += 1;
    console.log(
      `${ok ? "  ok " : "  ÉCHEC"} ${r.toFixed(2).padStart(5)} ≥ ${min}  ${label}`,
    );
  }
}

if (failures > 0) {
  console.error(`\n${failures} paire(s) sous le seuil.`);
  process.exit(1);
}
console.log("\nToutes les paires passent.");
