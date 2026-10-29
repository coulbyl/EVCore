/**
 * À partir de cette largeur la feuille n'est plus modale : elle s'ouvre dans
 * la colonne de droite, à côté de la liste (10-transverse.md § 4). Même seuil
 * que `lg` de Tailwind, où la colonne gauche remplace la barre d'onglets.
 */
export const WIDE_SCREEN_QUERY = "(min-width: 1024px)";

/** Glisser la feuille de plus de 96 px vers le bas la referme… */
export const DRAG_CLOSE_DISTANCE_PX = 96;
/** …ou d'un geste rapide, au-delà de 0,5 px par milliseconde. */
export const DRAG_CLOSE_VELOCITY_PX_PER_MS = 0.5;

/** Les éléments que le clavier peut atteindre, pour garder le focus dedans. */
export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Ce qui devient inerte pendant qu'une feuille modale est ouverte : la
 * coquille marque son contenu, sa barre d'onglets et sa colonne gauche.
 */
export const SHEET_INERT_ATTRIBUTE = "data-sheet-inert";
