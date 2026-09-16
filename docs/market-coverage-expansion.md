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
| Draw No Bet                        | 2                     | `DRAW_NO_BET`                                                     |
| Team Total Home                    | 16                    | `TEAM_TOTAL_HOME`                                                 |
| Team Total Away                    | 17                    | `TEAM_TOTAL_AWAY`                                                 |
| Clean Sheet Home                   | 27                    | `CLEAN_SHEET_HOME`                                                |
| Clean Sheet Away                   | 28                    | `CLEAN_SHEET_AWAY`                                                |
| Win to Nil Home                    | 29                    | `WIN_TO_NIL_HOME`                                                 |
| Win to Nil Away                    | 30                    | `WIN_TO_NIL_AWAY`                                                 |
| To Win Either Half                 | 39                    | `TO_WIN_EITHER_HALF`                                              |
| Result/Total Goals                 | 25                    | `RESULT_TOTAL_GOALS` — vraie cote bookmaker, pick composé         |
| Results/Both Teams Score           | 24                    | `RESULT_BTTS` — vraie cote bookmaker, pick composé                |

Ajoutés le 2026-09-15 (chantier A de [plan-rentabilite.md](plan-rentabilite.md)) :

| Marché                         | `bet.id` | Market enum            | Collecté chez |
| ------------------------------ | -------- | ---------------------- | ------------- |
| Asian Handicap                 | 4        | `ASIAN_HANDICAP`       | les 11 books  |
| Asian Handicap 1ère mi-temps   | 19       | `ASIAN_HANDICAP_HT`    | les 11 books  |
| Goals Over/Under 2ème mi-temps | 26       | `OVER_UNDER_2H`        | Pinnacle seul |
| Corners Over/Under             | 45       | `CORNERS`              | Pinnacle seul |
| Total Corners 1ère mi-temps    | 77       | `CORNERS_HT`           | Pinnacle seul |
| Cards Over/Under               | 80       | `CARDS`                | Pinnacle seul |
| Odd/Even                       | 21       | `ODD_EVEN`             | Pinnacle seul |
| Odd/Even 1ère mi-temps         | 22       | `ODD_EVEN_HT`          | Pinnacle seul |
| Highest Scoring Half           | 11       | `HIGHEST_SCORING_HALF` | Pinnacle seul |
| Team To Score First            | 14       | `TEAM_TO_SCORE_FIRST`  | Pinnacle seul |

**Pourquoi cette asymétrie.** Mesure des marges sur 100 rencontres
([MARKET-MARGINS.md](audits/2026-09-15/MARKET-MARGINS.md)) : l'Asian Handicap
est à 4,26 % chez Pinnacle contre 4,52 % sur le Match Winner — le seul marché
ajouté qui soit moins cher que l'existant, donc le seul où le courtage
multi-books a du sens. Les corners (6,58 %), les cartons (6,44 %) et les
marchés à issues fixes (jusqu'à 10,94 %) sont plus chers que ce qu'on jouait
déjà : `REFERENCE_ONLY_MARKETS` les garde chez Pinnacle seul, ce qui les laisse
ré-étudiables sans payer la démultiplication. À eux seuls ils représentaient
44 % des 424 lignes par rencontre que la collecte élargie produit, soit 62 M de
lignes par an.

Un marché sort de `REFERENCE_ONLY_MARKETS` dès qu'une mesure le rend jouable.

**Colonne `line`.** L'Asian Handicap est le premier marché dont la ligne fait
partie de l'identité du prix : un même `pick` (HOME/AWAY) existe à dix
handicaps sur la même rencontre. `OddsSnapshot.line` entre donc dans la
contrainte d'unicité. Les marchés antérieurs gardent leur ligne encodée dans
`pick` (`OVER_1_5`) et laissent la colonne à NULL — leur unicité est
inchangée. Les corners tranchent la question : ils cotent des lignes
**entières** (« Over 9 »), que le découpage historique `right(pick, 3)` ne sait
pas représenter.

**Convention de signe, vérifiée sur données réelles.** Les deux côtés d'un même
handicap portent le MÊME signe (« Home -0.5 » / « Away -0.5 »). Les apparier
en croisé donne des marges de −13 % à −47 %, donc impossibles. Un test fige la
convention.

Bookmakers collectés (`ODDS_INGESTION_BOOKMAKER_IDS`, Pinnacle en tête car il
porte le snapshot complet) : Pinnacle → Bet365 → Unibet → Marathonbet → Bwin →
1xBet → Betano → William Hill → Betfair → BetVictor → SBO.

> ⚠️ `COHERENCE_BOOKMAKERS` (`ev.constants.ts`) reste figé sur les cinq books
> d'origine. La médiane du garde-fou de cohérence pilote du staking en
> production : élargir la collecte ne doit pas la déplacer. On collecte large,
> on décide sur un périmètre stable.

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

- [x] **Clean Sheet Home/Away** — `bet.id = 27` / `28`, values `Yes`/`No`.
      Couverture réelle : Bet365 uniquement (8/10 matchs testés), absent
      chez Pinnacle/Unibet/Marathonbet — capté via la boucle
      `SECONDARY_IDS` existante.
- [x] **Win to Nil Home/Away** — `bet.id = 29` / `30`, values `Yes`/`No`.
      Couverture réelle : Marathonbet uniquement (10/10), absent chez
      Bet365/Pinnacle/Unibet — capté via `SECONDARY_IDS`.
- [x] **To Win Either Half** — `bet.id = 39` ("gagne au moins une mi-temps"
      du doc d'analyse). Confirmé marché à 2 issues (`Home`/`Away`
      seulement, jamais de 3e valeur) sur tout l'échantillon testé le
      2026-07-18. Nécessite `secondHalfWinner` (nouveau — le modèle
      n'exposait que le vainqueur de la 1ère mi-temps) combiné à
      `firstHalfWinner` par inclusion-exclusion ; `winEitherHalfHome` et
      `winEitherHalfAway` ne sont **pas** mutuellement exclusifs (un match
      1-0 en faveur du domicile en 1ère mi-temps puis 0-1 en faveur de
      l'extérieur en 2e satisfait les deux simultanément).

## Niveau 2.b — combos pré-calculés (à avoir, dérivables du Poisson existant)

Contrairement aux marchés corners/cartons ci-dessous, ces combos portent sur
les buts et le résultat — exactement ce que la matrice de scores Poisson
(lambdas home/away) sait déjà produire (`P(Home)`, `P(Draw)`, `P(Away)`,
`P(Over X.5)`, `P(BTTS)`). Pas besoin de nouvelle feature, juste de la
probabilité jointe déjà calculable comme pour les combos EVCore existants
(cf. `EVCORE.md` — "un pick peut combiner deux marchés si la probabilité
jointe est calculable depuis le modèle de Poisson").

- [x] **Result/Total Goals** — `bet.id = 25` (ex. "Home & Over 2.5",
      "Draw & Under 2.5"...). Correspond au point 10 du doc d'analyse
      ("Résultat + total large" : 1X + Under 4.5, Home + Over 1.5, etc.).
      Couverture réelle : Bet365 (8/10) et Marathonbet (10/10), absent chez
      Pinnacle/Unibet — capté via `SECONDARY_IDS`. Picks composés
      `HOME_OVER_2_5` etc., lignes 1.5/2.5/3.5/4.5, cote bookmaker réelle
      (pas de facteur de corrélation, contrairement au système de combo
      synthétique — retiré, voir ROADMAP.md).
- [x] **Results/Both Teams Score** — `bet.id = 24` (ex. "Home & BTTS Yes").
      Couverture réelle : Bet365 (8/10), absent chez Pinnacle/Unibet/
      Marathonbet. Grille fixe à 6 cases (`HOME_YES`..`AWAY_NO`).
- [ ] **Halftime Result/Total Goals** — `bet.id = 51` — variante mi-temps,
      **reportée** : 0 occurrence observée en direct le 2026-07-18, tous
      bookmakers confondus (pas seulement les 5 prioritaires) — pas de
      données pour construire ni tester l'extracteur.

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
