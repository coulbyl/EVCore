# Extension de la couverture des marchés — TODO

Contexte : analyse externe (`analyse-fiche-evcore-avec-gpt.md`, racine du repo) +
vérification manuelle le 2026-07-18 contre l'API-Football réelle
(`GET /odds/bets` et `GET /odds?date=...` sur des fixtures du jour) et contre
The Odds API. Objectif : lister les marchés à ajouter pour que le moteur
puisse comparer plusieurs marchés par fixture (comme demandé dans le doc
d'analyse), pas seulement 1X2 / Over-Under 2.5 / BTTS.

Ajout **progressif** — ne pas tout faire d'un coup. Chaque case cochée
implique une migration Prisma sur `Market` (enum) que l'utilisateur lance
lui-même via son CLI (jamais `db generate`/`db build` par Claude).

## État actuel (déjà implémenté)

Extraction dans `apps/backend/src/modules/etl/workers/odds-prematch-sync.worker.ts`
(`extractAdditionalMarketOdds`), IDs dans `API_FOOTBALL_BET_IDS`
(`apps/backend/src/config/etl.constants.ts`) :

| Marché                             | `bet.id` API-Football | Market enum                                                       |
| ---------------------------------- | --------------------- | ----------------------------------------------------------------- |
| Match Winner (1X2)                 | 1                     | `ONE_X_TWO` — multi-bookmaker (médiane pour la gate de cohérence) |
| Double Chance                      | 12                    | `DOUBLE_CHANCE`                                                   |
| Goals Over/Under (1.5/2.5/3.5/4.5) | 5                     | `OVER_UNDER`                                                      |
| Goals Over/Under 1ère mi-temps     | 6                     | `OVER_UNDER_HT`                                                   |
| Both Teams Score                   | 8                     | `BTTS`                                                            |
| HT/FT Double                       | 7                     | `HALF_TIME_FULL_TIME`                                             |
| First Half Winner                  | 13                    | `FIRST_HALF_WINNER`                                               |
| Exact Score                        | 10                    | `CORRECT_SCORE` — observation seule, pas consommé par le modèle   |

Bookmakers priorisés : Pinnacle → Bet365 → Unibet → Marathonbet → Bwin
(`API_FOOTBALL_BOOKMAKERS`).

## Niveau 1 — indispensables, à faire en premier

- [x] **Draw No Bet** — `bet.id = 2`, nommé `"Home/Away"` côté API-Football
      (piège de nommage : ne pas confondre avec un vrai marché "Home/Away"
      sans nul — les cotes vues (ex. Home 1.22 / Away 4.00 sur un favori net)
      confirment que c'est bien du DNB, pas du 1X2 sans retrait du nul).
      Values : `Home`, `Away`.
- [x] **Team Total Home** — `bet.id = 16`, values `Over/Under 0.5` à `6.5`.
- [x] **Team Total Away** — `bet.id = 17`, même format.

Ces trois marchés répondent directement au point du doc d'analyse sur
l'indicateur d'asymétrie offensive (différencier Over global / BTTS / team
total selon que la surperformance offensive vient d'une seule équipe).

## Niveau 2 — très utiles

- [ ] **Clean Sheet Home/Away** — `bet.id = 27` / `28`, values `Yes`/`No`.
- [ ] **Win to Nil Home/Away** — `bet.id = 29` / `30`, values `Yes`/`No`.
      Non garanti disponible sur toutes les fixtures (absent chez Bet365 sur
      l'échantillon testé le 2026-07-18) — prévoir un extracteur tolérant à
      l'absence, comme pour BTTS/DC actuellement.
- [ ] **To Win Either Half** — `bet.id = 39` ("gagne au moins une mi-temps"
      du doc d'analyse). Disponibilité à revérifier sur un échantillon plus
      large de ligues avant de committer dessus.

## Niveau 2.b — combos pré-calculés (à avoir, dérivables du Poisson existant)

Contrairement aux marchés corners/cartons ci-dessous, ces combos portent sur
les buts et le résultat — exactement ce que la matrice de scores Poisson
(lambdas home/away) sait déjà produire (`P(Home)`, `P(Draw)`, `P(Away)`,
`P(Over X.5)`, `P(BTTS)`). Pas besoin de nouvelle feature, juste de la
probabilité jointe déjà calculable comme pour les combos EVCore existants
(cf. `EVCORE.md` — "un pick peut combiner deux marchés si la probabilité
jointe est calculable depuis le modèle de Poisson").

- [ ] **Result/Total Goals** — `bet.id = 25` (ex. "Home & Over 2.5",
      "Draw & Under 2.5"...). Correspond au point 10 du doc d'analyse
      ("Résultat + total large" : 1X + Under 4.5, Home + Over 1.5, etc.).
- [ ] **Results/Both Teams Score** — `bet.id = 24` (ex. "Home & BTTS Yes").
- [ ] **Halftime Result/Total Goals** — `bet.id = 51` — variante mi-temps,
      à faire après les deux ci-dessus si la couverture bookmaker le permet.

Stocker à la fois la cote bookmaker (comparaison/valeur) et la probabilité
jointe recalculée en interne depuis la matrice de scores — ne jamais
multiplier naïvement `P(marché A) × P(marché B)` (rappel §12 du doc
d'analyse : la probabilité combinée réelle doit tenir compte de la
corrélation, pas d'une indépendance supposée).

## Niveau 3 — intéressants mais hors scope court terme

Ces marchés existent bien chez API-Football et ont du volume, mais **le
moteur EVCore est un modèle Poisson sur les buts** (`EVCORE.md` — lambdas
home/away) : aucun d'eux n'est modélisable sans une nouvelle couche de
features (corners par match, cartons par arbitre/équipe, etc.). À ne
considérer qu'après une extension du modèle, pas comme un simple ajout
d'extracteur d'odds :

- Corners Over/Under (`bet.id = 45`) + Corners 1X2 (`55`) — bonne liquidité,
  mais nécessite un modèle de corners séparé.
- Cards Over/Under (`bet.id = 80`) — dépend fortement de l'arbitre assigné,
  donnée non ingérée actuellement.

## Vérification faite (2026-07-18)

- `GET /odds/bets` (API-Football) → 338 types de paris recensés, IDs
  confirmés ci-dessus.
- `GET /odds?date=<jour J>` sur des fixtures EPL réelles → confirmé que
  Bet365 expose déjà `id 2, 16, 17, 27, 28` sur la plupart des matchs ;
  Pinnacle et Unibet ont une couverture plus restreinte (pas de Team Total
  chez Unibet par ex. sur l'échantillon testé — à reconfirmer marché par
  marché avant de coder un fallback bookmaker).
- The Odds API (`THE_ODDS_API_KEY`) : toujours câblé mais **uniquement pour
  l'import historique** (`odds-historical-import.worker.ts`) — la clé live a
  été volontairement abandonnée (ROADMAP.md, semaine 5) au profit d'un seul
  fournisseur API-Football en prod. Son endpoint `/odds` standard ne fournit
  pas BTTS/DNB (erreur 422 "Markets not supported by this endpoint") ;
  l'accès à ces marchés demanderait l'endpoint event-odds, non utile ici
  puisque API-Football couvre déjà mieux ces marchés en live avec une seule
  clé.

## Rappel schéma (point 7 du doc d'analyse)

Ne jamais reproduire l'ambiguïté `{"market": "OVER_UNDER", "pick": "UNDER"}`
sans ligne explicite. Chaque nouveau marché ajouté doit suivre le format déjà
en place : `marketType` + `line`/`pick` explicite + `bookmaker` + `odds` —
voir `AdditionalMarketOdds` dans `odds-prematch-sync.worker.ts` comme
référence de style.
