# Audit produit, conformité, marketing et diagnostic joueur (2026-10-23)

Travail réalisé le 23/10/2026 sur `main` (`e74af2b`) et sur le site de production c-evcore.com. Pour le site connecté et les données, les lectures ont été faites en lecture seule avec une session Opérateur. Aucun pari, dépôt, paiement ni réglage n'a été effectué.

| Fichier                                                        | Contenu                                                                                                                                                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [01-FICHE-PRODUIT.md](01-FICHE-PRODUIT.md)                     | Ce qu'est EVCore d'après le code : cible, fonctionnalités livrées ou en cours, modèle économique (aucun dans le code), chiffres affichés et leur origine.                                                                |
| [02-AUDIT-SITE.md](02-AUDIT-SITE.md)                           | Audit QA, UX, conversion et conformité, en desktop et mobile, public et connecté. 9 P1, 12 P2, 5 P3, avec reproduction et fichiers concernés. Verdict : pas prêt à promouvoir.                                           |
| [03-PLAN-MARKETING.md](03-PLAN-MARKETING.md)                   | Plan de lancement de 8 semaines (Côte d'Ivoire, Sénégal, Cameroun, UEMOA), cadre réglementaire sourcé (LONACI/ARJH, LONASE, Cameroun, règles de Meta, Google et TikTok), messages, canaux, budget en FCFA, KPI, risques. |
| [04-DIAGNOSTIC-JOUEUR.md](04-DIAGNOSTIC-JOUEUR.md)             | Ce que gagne ou perd un joueur qui suit EVCore. 46 jours de coupons, « Notre sélection » et Avis IA jour par jour, calibration par cote et par marché, ce que les coupons ignorent, badge « Données suspectes ».         |
| [05-COUPON-COTE-2-ET-CHASSE.md](05-COUPON-COTE-2-ET-CHASSE.md) | Faisabilité d'un coupon à cote 2 qui gagne le plus souvent, et d'un coupon « chasse » (BTTS, nul, plus de 3,5 buts, score exact).                                                                                        |
| `captures/`                                                    | Accueil desktop et mobile, inscription mobile, 404 sur `/cgu`, track record à 30 jours, projection de bankroll.                                                                                                          |
| `scripts/`                                                     | `audit-public-pages.py` (Playwright, pages publiques en 1440×900 et 375×812) et `analyse-decisions-coupons.js` (agrégats calculés dans le navigateur sur les API `coupons` et `channel-decisions/by-match`).             |

## À retenir pour la suite

1. **Avant toute promotion** : mentions 18+, jeu responsable et CGU/confidentialité ; renommer « Pari sûr du jour » ; supprimer le vocabulaire « investir » ; refaire l'image de partage ; rebrancher le track record (1 pari, 100 %, +64 % sur 30 jours) ; supprimer la projection de bankroll ; installer l'analytics.
2. **Produit** :
   - recalibrer les probabilités affichées par marché (Double chance surestimée de 8 pts, « Gagne une mi-temps » et « Remboursé si nul » sous-estimés de 9 pts) ;
   - n'afficher que des cotes jouables ;
   - montrer le solde cumulé à côté du taux de gain.
3. **« Données suspectes »** : le badge n'exclut pas les coupons moteur et prix, et ne prédit pas de moins bons résultats sur les cotes courtes. À renommer et à réserver aux cas avec AVOID ou au-dessus de 1,80.
4. **Coupon cote 2** : plafond d'environ 1 jour sur 2 ; la meilleure règle simulée tombe de 81 % à 50 % d'une période à l'autre. **Chasse** : de −3 % à −26 % de ROI, avec des séries de 10 à 57 pertes. À ne pas mettre en avant.

## Corrections au dépôt relevées en chemin

- `TODO.md` l.62 dit le garde-fou de suspension branché sur la table `bet`. Le code (`risk.repository.ts`) lit bien `channel_selection_deduped` : la ligne TODO est périmée. En revanche, `dashboard.repository.ts` (`getSettledBetsForPnl`) et `risk.service.ts` (courbe de calibration, rapport hebdomadaire) lisent encore la table `bet`.
- L'info-bulle « Données suspectes » (`apps/web/messages/fr.json`, `decisions.calibration.tooltipDetail`) promet une exclusion que les coupons moteur et prix n'appliquent pas.
- `docs/business-model.md` s'appuie encore sur « +61,8 % test ROI » et sur VALUE « prouvé », deux affirmations retirées par les audits de septembre.
