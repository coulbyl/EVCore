/**
 * Une feuille qui en remplace une autre sans que la personne l'ait fermée :
 * le squelette de chargement (`loading.tsx` des feuilles interceptées) puis
 * la vraie feuille, ou une fiche ouverte depuis un coupon. Pour React ce
 * sont deux montages ; pour la personne, une seule feuille.
 *
 * - La suivante ne rejoue pas la montée (`isSheetOpen`, lu au rendu, avant
 *   que la précédente soit démontée).
 * - L'élément qui a ouvert la première est transmis : la fermeture rend le
 *   focus à la ligne touchée dans la liste, pas au `body`.
 *
 * Démontage de l'une et montage de l'autre tiennent dans le même commit, les
 * nettoyages avant les effets : le relais est posé au nettoyage, repris à
 * l'effet. Le mode strict de React (monter, démonter, remonter) passe par le
 * même chemin.
 */
let openSheets = 0;
let relayedOpener: HTMLElement | null = null;

/** Une feuille est montée : celle qu'on rend prend sa place sans animation. */
export function isSheetOpen(): boolean {
  return openSheets > 0;
}

/** À l'ouverture : l'ouvreur transmis par la feuille remplacée, s'il y en a un. */
export function takeSheetRelay(): HTMLElement | null {
  openSheets += 1;
  const opener = relayedOpener;
  relayedOpener = null;
  return opener;
}

/** Au démontage : l'ouvreur est offert à la feuille qui suivrait. */
export function offerSheetRelay(opener: HTMLElement | null): void {
  openSheets -= 1;
  relayedOpener = opener;
}

/**
 * À l'image suivante : vrai si la feuille a été fermée pour de bon (aucune
 * autre montée), et le relais non repris est abandonné.
 */
export function sheetClosedForGood(): boolean {
  relayedOpener = null;
  return openSheets === 0;
}
