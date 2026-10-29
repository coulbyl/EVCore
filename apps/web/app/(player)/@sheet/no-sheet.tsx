/**
 * La fente `@sheet` vide : une navigation qui ne vise pas une feuille la
 * referme. Sans correspondance, la fente garderait la dernière feuille ouverte
 * en passant d'un onglet à l'autre (docs Next, parallel routes, « Closing the
 * modal »). Les feuilles elles-mêmes sont des routes interceptées, prioritaires.
 *
 * La doc Next propose un attrape-tout `[...catchAll]` ; ici il ferait
 * correspondre la mise en page joueur à toute adresse, et une adresse inconnue
 * répondrait 200 avec le cadre joueur au lieu de 404.
 *
 * D'où une page vide par route du groupe `(player)` (`today/page.tsx`, …) : chaque
 * nouvelle route joueur, sections imbriquées comprises, doit avoir la sienne
 * ici, sinon la feuille reste ouverte quand on y navigue. Un attrape-tout
 * optionnel `[[...rest]]` par section ne refermait pas la feuille (essayé).
 */
export default function NoSheet() {
  return null;
}
