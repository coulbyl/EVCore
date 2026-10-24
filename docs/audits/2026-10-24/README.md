# Audits du 2026-10-24

Suite du plan produit (`docs/plan-produit-ux-chasseurs-2026-10-23.md`). Données : dump de production du 24/10 à 08:22 restauré localement (conteneur `evcore-postgres`) ; interface capturée sur le faux backend Playwright, sans donnée personnelle.

| Fichier                                          | Contenu                                                                                                                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [COUPON-COTE-2-JOURS.md](COUPON-COTE-2-JOURS.md) | Choisir ses jours fait-il gagner plus souvent un coupon cote 2 ? Simulation + 120 jours de production : le critère (cellule, pas moteur) compte plus que le jour. |
| [UX-ACCUEIL.md](UX-ACCUEIL.md)                   | Critique UX de l'Accueil opérateur (méthode impeccable, A en sous-agent isolé, B par détecteur maison) : 21/40, 4 P1, 3 P2, plan de correction.                   |
| `captures/`                                      | Accueil en 375 et 1280 px, clair et sombre, pleine hauteur (`apps/web/e2e/captures.spec.ts`).                                                                     |
| `scripts/`                                       | `cote2-simulate.js`, `cote2-day-selection.js` et sa sortie sur 120 jours, sorties JSON du détecteur UX.                                                           |

Outils ajoutés au dépôt : `apps/web/e2e/captures.spec.ts` (captures page par page), `apps/web/e2e/support/ux-detect.mjs` (détecteur déterministe : titres, cibles tactiles, tailles de texte, contrastes, mots interdits), et le faux backend sert désormais un rôle configurable (`E2E_ROLE`), cinq sélections du jour, la santé des canaux et un résumé « Mes coupons ».
