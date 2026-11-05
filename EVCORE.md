# EVCore — spécification de l'existant

> État au 2026-11-04. Ce document décrit ce qu'EVCore **est aujourd'hui**.
> Les règles pour les agents de code sont dans [CLAUDE.md](CLAUDE.md), l'état
> des chantiers dans [ROADMAP.md](ROADMAP.md). La spécification d'origine
> (v1, moteur EV + delta LLM 30 %) est archivée dans
> [docs/archive/EVCORE-spec-v1.md](docs/archive/EVCORE-spec-v1.md) : historique
> seulement, plusieurs de ses principes ont été réfutés par la mesure.

---

## 1. Ce qu'est EVCore

EVCore analyse les matchs de football et **propose** des paris. Il ne place
jamais de pari pour un joueur, ne tient plus de bankroll ni de bulletin
utilisateur (supprimés le 2026-10-31) : le joueur voit les propositions, peut
« suivre » un coupon, et lit les résultats réglés.

C'est un système de décision probabiliste discipliné, pas un générateur de
tips ni un chatbot. Le score est **100 % déterministe** ; le seul LLM du dépôt
(VANTAGE, « Avis IA ») donne un avis à côté, jamais dans le score.

---

## 2. Principes mesurés

Ces résultats priment sur toute intuition plus ancienne du dépôt
(détails et chiffres dans CLAUDE.md, sources dans `docs/audits/`).

1. **Le moteur est derrière le marché.** Brier 0,639 contre 0,599 pour le
   marché sur 3 633 matchs ; le poids optimal du moteur dans un mélange avec
   le prix est 0 %. Toute nouveauté se juge sur le **résidu** par rapport au
   prix (Pinnacle), jamais sur le Brier absolu.
2. **L'edge annoncé (`p − 1/cote`) est anti-prédictif.** Plus il est grand,
   plus le moteur se trompe. Il sert de **plafond** (`MAX_LEG_EDGE = 0.10`),
   jamais de plancher. Le seuil `EV ≥ 0.08` ne garde plus que le canal VALUE,
   qui ne mise ni ne s'affiche.
3. **Validation par jambe, jamais par ROI de coupon.** À nos volumes l'erreur
   type d'un ROI de coupon est de 13 à 18 points. On mesure réalisé ÷ annoncé
   sur des jambes dédupliquées (`channel_selection_deduped`).
4. **Le coût du marché est ce qui persiste.** Les 17 marchés du moteur sont
   tous négatifs (−4,4 % à −12,2 %) ; championnat × marché ne persiste pas
   d'une période à l'autre (r = −0,02), la marge de chaque marché persiste
   (r = +0,70). On classe les jambes sur le prix mesuré.
5. **La calibration s'effondre au-dessus de 1,80.** Réalisé ÷ annoncé : 0,90
   sous 1,45, 0,84 de 1,45 à 1,80, 0,62 au-delà. On coupe sur la cote, jamais
   sur le canal.

Conséquence : les produits sont des **paris au prix du marché**, présentés
honnêtement (« arithmétique des jambes calibrées, jamais un avantage »).

---

## 3. Produits joueur

Composés chaque jour par le backend pour le lendemain
(`apps/backend/src/modules/coupon`), classes et bandes dans
`packages/analysis-core/src/coupon/coupon-classes.ts`. Le joueur voit les
cotes 1xBet (plancher 1,20 : sous ce seuil les cotes de référence sont trop
généreuses par rapport à 1xBet, `docs/audits/2026-10-18/COTES-JOUABLES.md`).

| Produit (écran Aujourd'hui) | Classe           | Source         | Bande                                                                                                                     |
| --------------------------- | ---------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Favori du jour              | `FAVOURITE`      | PRICE_COMPOSER | 1 jambe, 1,20–1,35                                                                                                        |
| Combiné du jour             | `COMBO`          | ENGINE         | 2 lectures des matchs (« Notre lecture »), une par championnat, 1,30–1,80 chez 1xBet, combinée 1,80–2,60, classées sur la fréquence du marché (`engine-combo-v3`, 05/11) |
| Coupon cote 2               | `DOUBLE`         | PRICE_COMPOSER | 2 jambes (3 si aucune paire) 1,20–1,80, cote combinée 2–3, tout le coté classé par la probabilité du marché sans marge    |
| Chasseur Les deux marquent  | `HUNTER_BTTS`    | PRICE_COMPOSER | 1 sélection 1,45–1,90 ou abstention                                                                                       |
| Chasseur Nul                | `HUNTER_DRAW`    | PRICE_COMPOSER | 1 sélection 2,90–3,60                                                                                                     |
| Chasseur Nul à la mi-temps  | `HUNTER_HT_DRAW` | PRICE_COMPOSER | 1 sélection 2,10–2,80                                                                                                     |
| Chasseur Score exact        | `HUNTER_SCORE`   | ENGINE         | 1 sélection 5–12                                                                                                          |
| Chasseur Corners            | `HUNTER_CORNERS` | PRICE_COMPOSER | 1 sélection 1,70–2,10, prix 1xBet                                                                                         |
| Combiné IA                  | `AI_COMBO`       | PRICE_COMPOSER | jusqu'à 4 avis joués de l'IA 1,45–1,80, cote combinée 4–10                                                                |

Mesures de référence (historique, pas des promesses) : Favori 84 % de jours
gagnants à cote 1,26 sur 86 jours ; Combiné à deux jambes 71 % à cote 1,55
(`COTES-JOUABLES.md`) ; Coupon cote 2 43,6 % annoncés pour 48 % ± 9 réalisés
sur 115 jours (`docs/audits/2026-10-28/SELECTIONS-LAISSEES.md`) ; Combiné IA
gagné environ un jour sur trois à cote ~5,2 (`docs/audits/2026-11-03/COMBINE-IA-4-10.md`).

Le coupon prix 5–15 (`UNIQUE`) et le coupon long moteur (`LONG`) ne sont plus
écrits depuis le 2026-11-04, et le combiné LLM a été coupé le 2026-11-03 :
leurs anciens coupons restent visibles des admins dans Résultats.

L'écran Décisions montre « Notre sélection » par match (les canaux du moteur
calibrés sur la compétition) ; la fiche de match expose toutes les données
brutes, sans jamais filtrer ni classer.

---

## 4. Avis IA (VANTAGE)

- Vit entièrement dans `apps/vantage-worker` (fournisseurs Groq, Cerebras,
  Together, Fireworks) ; `apps/backend` n'a aucun client LLM.
- Lit les décisions de tous les canaux sur un match et la fiabilité mesurée de
  chacun, puis forme **son propre** avis (marché, probabilité) ; ce n'est
  jamais un delta sur un autre score.
- Cote plafonnée à 1,80 (`MAX_ODDS`) : au-delà, l'avis est affiché comme
  « lecture retenue mais non proposée ».
- Version courante `vantage-v6-match-voice` : un non-jeu est un avis sur le
  match en mots de parieur, montré sur la fiche.
- Sortie validée par Zod ; le bilan se lit sur `vantage_decision_history`.
- Mesuré : calibré, ne bat pas la cote.

---

## 5. Règles côté joueur

- Le mot « canal » n'apparaît jamais : on parle de types de pari, nommés avec
  les équipes. L'admin garde les canaux.
- Jamais de marge bookmaker ni de « 1xBet garde X % » côté joueur (coupon,
  match, ticket, image, aide) : réservé à l'admin.
- La chance affichée au joueur est la **fréquence du marché** (probabilité
  sans marge), pas la probabilité du moteur.
- Les lignes de pari ne sont jamais arrondies (« moins de 2,5 » ≠ « moins de 3 »).
- Une valeur inconnue est exclue et comptée à part, jamais montrée comme 0.

---

## 6. Architecture

1. Monorepo pnpm 10 + Turborepo, Node ≥ 22, TypeScript strict.
2. `apps/backend` : NestJS en deux processus, API HTTP (`main.ts`) et workers
   BullMQ (`main.worker.ts`).
3. `packages/analysis-core` : noyau pur (probabilités, 20 stratégies, classes
   et composeurs de coupon, règlement, calcul d'EV), sans I/O.
4. `packages/backtest-core` : rejeux point-in-time du pipeline actuel.
5. `packages/db` : schéma Prisma 7, PostgreSQL 18.
6. `apps/web` : Next.js, joueur et admin, style « tableau d'affichage ».
7. `apps/vantage-worker` : le seul LLM (Avis IA).
8. `apps/ml-worker` : Python, préparation Phase 3, correction d'ombre coupée.
9. Mails via Resend (`packages/transactional`), push web, notifications in-app.
10. Variables d'environnement = secrets et adresses ; les réglages
    d'exploitation vivent dans `app_setting` et l'écran admin.

---

## 7. Données

- **API-Football** (plan Pro, 7 500 appels par jour) : matchs, résultats,
  statistiques, événements, compositions et stats joueurs via
  `/fixtures?ids=`, effectifs (`player_squad`), blessures, entraîneurs.
- **Cotes de 11 bookmakers** (`ODDS_INGESTION_BOOKMAKER_IDS` : Pinnacle,
  Bet365, Unibet, Marathonbet, Bwin, 1xBet, Betano, William Hill, Betfair,
  BetVictor, SBO). Pinnacle est la référence, 1xBet le book du joueur.
- Imports historiques : football-data.co.uk (CSV), eloratings.net.
- `odds_snapshot` est partitionné par mois ; les mois clos sont archivés en
  Parquet sur RustFS (`modules/odds-archive`).
- Chaque `ModelRun` journalise fixture, features, score déterministe,
  `llmDelta` (toujours nul), score final et décision. Pas de cote → `NO_BET`.

---

## 8. Règles dures (le backend fait foi)

- **Suspension automatique de marché** : ROI < −15 % sur 50 jambes réglées ou
  plus, mesuré sur `channel_selection_deduped` sur 90 jours glissants, avec la
  perte établie (borne haute à 95 % sous zéro). Jamais de réactivation
  automatique.
- **Ajustements auto-appliqués** (`AdjustmentProposal`) : au moins 50 paris
  sur le marché, au plus 5 % de variation, une application par marché tous
  les 7 jours ; rollback par `POST /adjustment/:id/rollback`.
- **Aucune sortie LLM dans le score.** Si cela devait changer : plafond 0,30
  côté serveur et décision humaine préalable.
- **Pas de Kelly** : retiré (`KELLY_ENABLED` dans `RETIRED_ENV`).
- Décisions humaines : rollback d'un ajustement, réactivation d'un marché
  suspendu, changement du seuil d'EV, entrée d'un LLM dans le score,
  désactivation manuelle d'un facteur appris.

---

## 9. Futur (non planifié)

- **Phase 3, redéfinie le 2026-10-29** : la grille de marché comme entrée du
  moteur, et du ML seulement pour ce que le prix ne dit pas (mi-temps,
  corners, marge apprise, dépendance), validé contre Pinnacle, sans appel ML
  à l'analyse (`docs/audits/2026-10-29/ML-V2-PROPOSITION.md`).
- **Multi-sport** : cadrage dans `docs/multi-sport-extension.md`.
- **Loto Bonheur CI** : module de collecte et d'analyse décrit dans `loto.md`.
- **SaaS, multi-tenant** : Phase 4.
