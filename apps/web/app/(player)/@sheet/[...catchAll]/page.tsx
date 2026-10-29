/**
 * Toute navigation qui ne vise pas une feuille la referme : sans cet
 * attrape-tout, la fente garderait la dernière feuille ouverte en passant
 * d'un onglet à l'autre (docs Next, parallel routes, « Closing the modal »).
 * Les feuilles elles-mêmes sont des routes interceptées, plus précises.
 */
export default function NoSheetOnNavigation() {
  return null;
}
