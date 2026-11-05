# EVCore — Roadmap

> État au 04/11/2026. L'historique complet (blocs, cases cochées, mesures de
> chaque étape jusqu'au 04/11) est archivé dans
> [docs/archive/ROADMAP-history-2026-11.md](docs/archive/ROADMAP-history-2026-11.md).
> Spécification produit : [EVCORE.md](EVCORE.md) · Conventions : [CLAUDE.md](CLAUDE.md) ·
> Travail ouvert hors roadmap : [TODO.md](TODO.md).
>
> Mettre à jour à chaque fusion significative : ce fichier dit où on en est,
> pas comment on y est arrivé.

---

## Où on en est

Production en argent réel, deux processus backend (API + worker), refonte UI
terminée. Le moteur est derrière le marché (Brier 0,639 contre 0,599, poids
optimal 0 %) : les produits sont classés sur le prix mesuré, la validation se
fait par jambe (réalisé ÷ annoncé), jamais sur un ROI de coupon.

Livré récemment :

| Quand         | PR               | Quoi                                                                                                                                                                                     |
| ------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10-29 → 11-02 | #282, #285       | Refonte UI « le tableau d'affichage » : public + joueur, puis admin + réglages (`app_setting`, Réglages › Intégrations)                                                                  |
| 11-02         | #286             | Compose de prod : le `.env` ne porte que secrets et adresses                                                                                                                             |
| 11-02 → 11-03 | #289, #292, #293 | Lot perf/sécurité/dépendances : NestJS 12, worker séparé (`GET /health/worker`), push en file, module ML retiré du backend, scan Trivy, images sans gestionnaire de paquets, budgets web |
| 11-03         | #294             | `odds_snapshot` partitionné par mois + archive Parquet nocturne sur RustFS                                                                                                               |
| 11-03         | #295             | Avis IA v6 « match voice » : un refus est un avis, montré sur la fiche                                                                                                                   |
| 11-03         | #296             | Combiné IA 4–10 (source `PRICE_COMPOSER`, avis IA 1,45–1,80) ; ancien combiné LLM 2 jambes coupé                                                                                         |
| 11-03         | #297             | Cotes cartons 1xBet conservées (étude corners / tirs / cartons)                                                                                                                          |
| 11-03         | #298             | Chasseurs relus après une semaine : rien de cassé, rien à conclure                                                                                                                       |
| 11-03         | #299             | Plan stratégies phase 1 : Chasseur Nul à la mi-temps (`HUNTER_HT_DRAW`, 2,10–2,80)                                                                                                       |
| 11-03         | #300             | Phase 2 : événements, compositions, stats joueurs via `/fixtures?ids=` ; buteurs et rouges sur la fiche d'un match fini                                                                  |
| 11-03         | #301             | Phase 3 : huit nouveaux marchés (corners d'équipe et 1X2, buteurs, tirs joueur, 1X2 à la minute), `player_squad`, règlement ; rien de montré, la mesure commence                         |
| 11-03         | #302             | Phase 5 : Combiné du jour départagé par la marge (`engine-combo-v2`) ; TEAM_TOTAL 1,45–1,80 rejoué, rien d'expédié ; plafond IA reporté                                                  |

Produits joueur en ligne : Pari sûr du jour (FAVOURITE 1,20–1,35), Combiné du
jour (ENGINE, 2 jambes 1,20–1,50), coupon cote 2, chasseurs (BTTS, Nul, Score
exact, Corners, Nul à la mi-temps), Combiné IA 4–10, Avis IA (VANTAGE v6).
Détail : [EVCORE.md](EVCORE.md).

---

## Phases produit

### MVP — Phase 1 : fait (mars 2026)

ETL historique, rolling stats, Poisson, backtest, calibration, boucle
d'apprentissage (`AdjustmentProposal` auto-appliqué, rollback). Les chiffres de
validation de mars (Brier 0,592, ROI simulé +2,28 %) sont retirés comme preuve
depuis l'audit de septembre 2026 : historique de recherche seulement.

### Phase 2 : en production

Fait : cotes live multi-books via API-Football (cote 1xBet affichée),
ETL multi-ligues, canaux de prédiction par famille de processus
(`docs/prediction-engine-families.md`), règlement, ligne de clôture et CLV par
jambe, suspension automatique de marché sur `channel_selection_deduped` 90 j,
générateurs de coupon déterministes, avis IA dans `apps/vantage-worker`.

Abandonné ou retiré :

- **Kelly** : jamais activé, `KELLY_ENABLED` est dans `RETIRED_ENV`, plus aucun code de mise.
- **Grafana, TimescaleDB** : abandonnés ; la volumétrie des cotes est traitée par le partitionnement et l'archive Parquet (#294).
- **OpenClaw** : jamais construit. Le LLM n'entre pas dans le score du moteur ; il vit dans `apps/vantage-worker` et produit un avis à part.
- Investir, abonnements, onglet Personnalisation, coupon long 5–15, coupon prix 2,5–5, ancien combiné IA 2 jambes, ombre ML : supprimés.

### Phase 3 : redéfinie le 29/10

Le ML ne pronostique plus le football : la couche XGBoost en ombre n'a battu le
marché sur aucun canal et a été retirée du backend. **La grille de marché
devient l'entrée du moteur** ; le ML apprend ce que le prix ne dit pas
(mi-temps, corners/cartons, retrait de marge, dépendance des buts), chaque
sous-modèle jugé sur le résidu contre Pinnacle hors échantillon, export JSON,
aucun appel ML à l'analyse. Cadrage :
[docs/audits/2026-10-29/ML-V2-PROPOSITION.md](docs/audits/2026-10-29/ML-V2-PROPOSITION.md).
`apps/ml-worker` (Python) reste dans le dépôt et la CI, hors des compose.

### Phase 4 : futur

SaaS, multi-tenant, API interne. Rien de commencé.

### Au-delà : non planifié

- Multi-sport : [docs/multi-sport-extension.md](docs/multi-sport-extension.md) (un moteur par famille de processus, recherche seulement).
- Loto Bonheur CI : [loto.md](loto.md) (note d'implémentation, rien de codé).

---

## Chantiers ouverts

Ordre décidé le 04/11 : [docs/plan-2026-11-04.md](docs/plan-2026-11-04.md) — 1. le 15-todo, 2. le moteur (force des championnats, puis ML), 3. les produits datés, 4. plus tard.

Fait le 04/11, étape 2 (premier lot) : force des championnats sur λ en coupe d'Europe ([FORCE-CHAMPIONNATS.md](docs/audits/2026-11-04/FORCE-CHAMPIONNATS.md)) — `LEAGUE_STRENGTH_MAP` à ré-ajuster chaque juillet avec `backtest:league-strength`. Puis ML-1 (grille de marché, expédiée). Suite : lots ML-2 → ML-4.

### Plan stratégies — phase 4 (après mesure)

Source : [docs/plan-strategies-2026-11-03.md](docs/plan-strategies-2026-11-03.md).
Chaque sous-phase commence par `report:new-markets` et ne livre que si la
fréquence réelle est mesurée (IC ≤ ± 8 points sur la bande visée).

- [ ] **4a** Chasseurs Corners d'équipe et Corners 1X2 — J+14 après le déploiement de #301.
- [ ] **4b** Buteur du jour et Tir cadré du jour (Bet365, compositions à T−60) — J+28 après le déploiement de #301.
- [ ] **4c** « Rien avant la 15e » (`MINUTE_1X2` ligne 15) — J+28, facultatif, décision de l'utilisateur sur les chiffres.
- [ ] **4d** Chasseur Cartons — décision le 17/11 sur deux semaines de cotes 1xBet (#297).

### Plan stratégies — 5.3 plafond de jeu de l'IA

- [ ] Vers le 10/11, sur une copie fraîche avec au moins 7 jours de `vantage-v6-match-voice` : si la part de jeu reste > 50 % (médiane des jours à 20 matchs ou plus), plafond déterministe dans `apps/vantage-worker` (N = 30 % des matchs du jour, dans `config/`), décidé avec l'utilisateur.

### Phase 3 — lots ML (à planifier)

- [x] **ML-1** grille de marché dans `analysis-core` (Shin, λ ajustés ; ρ laissé à ML-2), moteur branché avec repli (`MARKET_GRID` / `POISSON_MAIN`), rejeu 2026 : réalisé ÷ annoncé 0,956 → 1,005, résidu 1X2 contre la clôture Pinnacle +0,032 → +0,001, 5 critères tenus, expédié le 04/11 ([ML1-GRILLE-MARCHE.md](docs/audits/2026-11-04/ML1-GRILLE-MARCHE.md)).
- [ ] **ML-2** mi-temps et dépendance des buts (sous-modèles A et D).
  - [x] **D** (dépendance, ML-2a) mesuré le 04/11, **expédié** (décision de l'utilisateur, D2 non mesurable remplacé par un suivi du nul contre la clôture Pinnacle relu le 10/12) : ρ par championnat (global −0,05) corrige la moitié du défaut des petits scores (nul 1,100 → 1,058, log-perte du score exact −0,0012 [−0,0020 ; −0,0004]), canaux inchangés, D2 (BTTS contre Pinnacle) non mesurable en 2026 ([ML2A-DEPENDANCE-BUTS.md](docs/audits/2026-11-04/ML2A-DEPENDANCE-BUTS.md)).
  - [ ] **A** (mi-temps).
- [ ] **ML-3** corners et cartons (sous-modèle B).
- [ ] **ML-4** retrait de marge appris sur 1xBet (sous-modèle C).

### Relectures datées

Vers le **10/11** :

- Avis IA v6 : refus qui nomment encore une règle (cible 0), avis joués qui en nomment une, part de jeu ([AVIS-IA-ABSTENTION](docs/audits/2026-11-03/AVIS-IA-ABSTENTION.md)) ; décide le 5.3.
- Cohorte v5 `vantage-v5-no-tension` : part de jeu, refus `VANTAGE_GATED_BASIS`, réalisé ÷ annoncé ([AVIS-IA](docs/audits/2026-10-27/AVIS-IA.md), [BILAN-IA](docs/audits/2026-10-29/BILAN-IA.md)) ; ce que lit l'IA ([SELECTIONS-LAISSEES](docs/audits/2026-10-28/SELECTIONS-LAISSEES.md)) ; le désaccord de l'IA est-il prédictif ([refonte-ui/15-todo](docs/refonte-ui/15-todo.md)).

Vers le **10/12**, sur une copie de prod fraîche, par jambe :

- Combiné du jour et Notre sélection, statut de calibration à retirer s'il reste neutre ([COMBINE](docs/audits/2026-10-28/COMBINE.md), [NOTRE-SELECTION](docs/audits/2026-10-28/NOTRE-SELECTION.md)) ; `engine-combo-v2` contre `v1`, retirer l'option si la marge payée ne baisse pas ([COMBINE-MARGE](docs/audits/2026-11-03/COMBINE-MARGE.md)).
- Chasseurs BTTS, Nul, Score exact, Corners ([HUNTERS](docs/audits/2026-10-28/HUNTERS.md), [CHASSEURS-EN-DIRECT](docs/audits/2026-11-03/CHASSEURS-EN-DIRECT.md), [CORNERS](docs/audits/2026-10-29/CORNERS.md)) ; produits du week-end ([ACCUMULATEUR](docs/audits/2026-10-29/ACCUMULATEUR.md)).
- Bilan de l'IA au prix 1xBet, chaque source à 100 jambes ([BILAN-IA](docs/audits/2026-10-29/BILAN-IA.md)).
- Fidélisation : activation et J14 des cohortes de novembre, ouverture des notifications ([RETENTION](docs/audits/2026-10-29/RETENTION.md)).
- Filet des gros mouvements de clôture et sous-modèles A/D ([ML-V2-PROPOSITION](docs/audits/2026-10-29/ML-V2-PROPOSITION.md) § 2.3).

Autres dates :

- 15/11 : première archive Parquet de `odds_snapshot_legacy` ([exploitation](docs/exploitation.md)).
- Juillet (début de la saison européenne) : ré-ajuster `LEAGUE_STRENGTH_MAP` avec `backtest:league-strength` et recopier la carte de production du rapport ([FORCE-CHAMPIONNATS](docs/audits/2026-11-04/FORCE-CHAMPIONNATS.md)).
