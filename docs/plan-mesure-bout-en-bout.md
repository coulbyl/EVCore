# Plan — mesure de bout en bout et affichage juste (2026-10-08)

> Plan complet pour la suite, demandé le 2026-10-07 soir. La première
> tranche est livrée en une seule PR (branche `feat/clv-end-to-end`) ; les
> tranches suivantes sont ordonnées par ce qu'elles débloquent, pas par
> taille. Règles inchangées : valider par jambe ou par sélection, jamais au
> coupon (`P-1`) ; le CLV prime sur le ROI dès qu'il existe (`P-7`) ; aucune
> sélection sur l'edge annoncé (CLAUDE.md).

## 1. Constat au 2026-10-07 (quatre revues + base de prod restaurée)

| Constat                                                                                                                      | Conséquence                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Le chargeur de cotes résout un book par marché puis **jette son nom** ; `FullOddsSnapshot` ne garde que le book du 1X2.      | Aucune sélection ne sait d'où vient son prix : le CLV comparait deux maisons.      |
| Le chargeur de production dupliquait l'assemblage partagé en ~34 requêtes par rencontre.                                     | Deux implémentations à faire dériver ; le même bug corrigé deux fois (2026-08-17). |
| `closingLineValue` (E-1, 2026-09-15) n'avait **aucun producteur** ; E-2 livré pour les jambes de coupon seulement (PR #237). | 1 300 jambes mesurables, pas les 33 000 sélections de canal.                       |
| 120 des 154 coupons LLM gagnés n'ont pas de `realizedOdds` (réglés avant la colonne) ; un LOST re-réglé gardait l'ancienne.  | L'indice « COUPON » mélangeait des cotes payées fausses.                           |
| `/coupons/indices` excluait les coupons **perdus** du ROI (cote nulle = hors dénominateur).                                  | ROI toujours positif, taux de réussite ~100 % par tranche : un indicateur faux.    |
| Le web affichait un PARTIAL comme « Gagné » à la cote proposée, rien pour un VOID, une jambe remboursée comme non réglée.    | L'écran disait un gain à 4,3 là où 3,1 a été payé.                                 |
| Les routes de règlement et l'indice étaient **sans session** ; `GET /coupons` ignore son paramètre `to`.                     | N'importe qui pouvait déclencher une réécriture de la table.                       |
| La sonde Playwright attendait `localhost` en IPv6 : la suite e2e web ne démarrait pas sur ce poste.                          | Aucune vérification automatique de l'écran coupons.                                |

## 2. Tranche livrée (une PR)

1. **Provenance par choix** dans le relevé assemblé (`FullOddsSnapshot.sources`,
   clé `marché:choix`), remplie par `assembleFullOddsSnapshot` ; `priceForSelection`
   la propage ; DRAW, VALUE et SAFE la portent explicitement.
2. **Un seul chargeur** : `findLatestOddsSnapshot` délègue au chemin batch (une
   requête, assemblage pur). Les deux tests mono-rencontre et les deux
   simulations du service moteur réécrits sur ce chemin ; l'instantané doré
   est inchangé.
3. **`channel_selection`** gagne `oddsBookmaker`, `oddsSnapshotAt` (écrits par
   le moteur) et `closingOdds`, `closingBookmaker`, `closingObservedAt`,
   `closingLineValue` (écrits au règlement final, une seule fois). Vue
   `channel_selection_deduped` recréée avec ces colonnes.
4. **Résolution de clôture partagée** (`betting-engine/pricing/closing-line.ts`,
   `OddsClosingLineRepository`) : jambes de coupon et sélections de canal
   lisent la même vue, avec la même règle (groupe d'issues complet chez un
   book, observation à moins de 90 min, book du prix de préférence). L'heure
   d'observation sort de la requête, plus du coup d'envoi côté service.
5. **Règlement des coupons** : `realizedOdds` effacé sur LOST/VOID ; un
   `settleRange` remplit l'historique (cotes payées manquantes et clôtures).
6. **Indice COUPON** : les perdus comptent dans le ROI ; filtre `source`.
7. **API** : `realizedOdds` par coupon ; `settledAt`, `bookmaker` et les quatre
   champs de clôture par jambe. Routes de règlement derrière
   `AuthSessionGuard + AdminGuard`, indice derrière `AuthSessionGuard`.
8. **Web** : cote payée affichée dès qu'elle diffère de la cote proposée ;
   PARTIAL « Gagné · jambe remboursée », VOID « Remboursé », jambe remboursée
   distinguée d'une jambe non réglée (Draw No Bet : « Remboursé ») ; ligne de
   clôture et valeur signée par jambe ; la célébration compte les PARTIAL.
9. **Playwright** : faux backend enrichi de quatre coupons (gagné, partiel,
   perdu, remboursé, deux sources, clôture) ; scénario `coupons.spec.ts` qui
   vérifie que la cote combinée affichée est le produit des jambes, la cote
   payée du partiel, le remboursement et la clôture ; sondes Node en
   `127.0.0.1`.
10. **Rapports** : `report:selection-clv` (canal × marché, sélections
    dédupliquées) à côté de `report:coupon-clv`.

## 3. Mesures sur la base de production restaurée le 2026-10-10

Migrations appliquées sur la copie locale, re-règlement de 641 propositions
de coupon (depuis 2023-04-15) et de toutes les sélections depuis le
2026-09-15, puis `report:coupon-clv` et `report:selection-clv`
(`docs/audits/2026-10-10/`). La prod a déjà `observedAt` et la clôture par
jambe : depuis le 7 octobre, **236 rencontres sur 262** ont un relevé à moins
de 15 min du coup d'envoi, et le LLM produit à nouveau depuis le 9.

**Comment lire un CLV ici.** `closingLineValue` = cote prise × probabilité
de clôture sans marge − 1. Un pari pris exactement au prix de clôture vaut
donc **moins la marge du book**, pas zéro : la barre est la marge, et un
canal se juge contre elle et contre les autres canaux, jamais contre zéro.
Les écarts entre familles de marchés sont le signal : les marchés joints
(résultat × total, résultat × BTTS, mi-temps / fin de match) coûtent deux à
trois fois plus que les marchés principaux, ce que l'audit d'efficience du
2026-09-15 avait mesuré par la marge.

| Population (sélections réglées depuis le 15/09, dédupliquées) | n     | Avec clôture | CLV moyen ± ET |
| ------------------------------------------------------------- | ----- | ------------ | -------------- |
| GOALS                                                         | 5 040 | 1 086 (22 %) | −4,27 ± 0,1 %  |
| TEAM_TOTAL                                                    | 5 135 | 1 279 (25 %) | −4,56 ± 0,1 %  |
| DOMINANT                                                      | 877   | 140 (16 %)   | −4,21 ± 0,2 %  |
| SAFE                                                          | 821   | 158 (19 %)   | −4,76 ± 0,3 %  |
| DRAW                                                          | 1 723 | 380 (22 %)   | −5,39 ± 0,2 %  |
| VANTAGE (LLM)                                                 | 2 923 | 1 016 (35 %) | −5,77 ± 0,1 %  |
| VALUE                                                         | 1 201 | 190 (16 %)   | −7,05 ± 0,4 %  |
| BTTS                                                          | 1 707 | 476 (28 %)   | −7,02 ± 0,1 %  |
| WIN_TO_NIL                                                    | 2 532 | 848 (33 %)   | −8,07 ± 0,1 %  |
| RESULT_BTTS                                                   | 3 260 | 1 191 (37 %) | −11,63 ± 0,2 % |
| RESULT_TOTAL_GOALS                                            | 2 207 | 797 (36 %)   | −12,87 ± 0,2 % |
| HALF_TIME_FULL_TIME                                           | 416   | 121 (29 %)   | −16,37 ± 0,1 % |
| Jambes de coupon LLM (tout l'historique)                      | 1 416 | 159 (11 %)   | −4,20 ± 0,1 %  |
| Jambes de coupon PRICE                                        | 35    | 35 (100 %)   | −7,06 ± 1,2 %  |

CORRECT_SCORE, WIN_EITHER_HALF et CONSENSUS n'ont pas de groupe d'issues
exclusif : aucun CLV, par construction. La couverture est encore celle de la
période d'avant `observedAt` pour l'essentiel ; la lecture qui compte est
celle de la semaine qui suit le déploiement.

**Écran vérifié sur ces données** (`docs/audits/2026-10-10/coupons-*.png`) :
le 9 octobre, Prix gagné à 5,78 = 2,38 × 2,43 avec ses clôtures, Analyse
perdu à 6,52 = produit de ses cinq jambes ; le 9 septembre, un partiel
affiche 2,39 proposé et 1,52 payé, la jambe Draw No Bet « Remboursé ».

## 4. Suite ordonnée

### 4.1 Au déploiement (utilisateur)

- Lancer les trois migrations en attente (`observedAt`, clôture par jambe,
  provenance et clôture par sélection) : `pnpm --filter @evcore/db db:deploy`.
- Re-régler l'historique : `POST /coupons/settle-range` sur 2026-06-30 →
  aujourd'hui, `POST /channel-decisions/settle-range` sur 2026-09-15 →
  aujourd'hui (admin). Idempotent.
- Réapprovisionner le fournisseur LLM ou passer Groq en primaire : sans lui,
  la comparaison LLM / PRICE / ombre v2 par jambe reste impossible.

### 4.2 Une semaine après (lecture, pas de code)

- `report:freshness` : part des rencontres avec un relevé à 15 min (cible
  70 %) — c'est ce qui conditionne tout le reste.
- `report:selection-clv` et `report:coupon-clv` : couverture (cible E-2 :
  80 %) puis CLV moyen ± erreur type par canal et par source. Un canal dont
  le CLV est négatif à plus de deux erreurs types n'a pas de valeur de prix,
  quel que soit son ROI.

### 4.3 Prochaines PR, dans l'ordre

1. **E-4 — règle de décision sur le CLV** : un canal au CLV négatif sur 500
   sélections est suspendu ; constante en config, testée. Elle remplace le
   garde-fou « ROI < −15 % sur 50 paris » qui lit une table morte et n'a
   aucune puissance (TODO 2026-10-05). À écrire une fois la couverture
   atteinte, pas avant.
2. **E-5 — marge payée par pari** : avec `oddsBookmaker` et `oddsSnapshotAt`,
   le groupe d'issues du book à la prise est retrouvable dans
   `odds_snapshot` ; colonne `marginPaid` sur la sélection, rapport « marge
   payée vs marge minimale disponible » (E-6).
3. **Comparaison par jambe LLM / PRICE / ombre v2** sur le CLV, dès que le LLM
   produit à nouveau : c'est la mesure qui tranche entre les deux générateurs
   en semaines.
4. **B-5 densité des relevés** (≥ 5 par rencontre entre J−3 et le coup
   d'envoi) et **A-6 index** `(fixtureId, market, pick, snapshotAt)` : la vue
   de clôture et les requêtes de CLV en dépendent à mesure que la table
   grossit.
5. **Chantier C — blessures et compositions** : la seule source
   d'information publique que le moteur n'a pas ; à juger sur le résidu face
   à la clôture (C-17, C-18), jamais sur le Brier absolu.
6. Dette courte : `GET /coupons` honore ou retire `to` ; vue `evaluated_pick`
   pour les marchés sans règle ; Dependabot #225 (outillage) ; `GET
/coupons/indices` dans le web avec le filtre de source.

### 4.4 Ce que ce plan ne fait pas

- Aucune nouvelle règle de sélection keyée sur l'EV ou l'edge (CLAUDE.md).
- Aucun re-fit par ligue : sans signal mesuré le 2026-10-06.
- Aucune conclusion tirée d'un ROI de coupon.
