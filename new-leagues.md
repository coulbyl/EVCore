# Nouvelles ligues — analyse API-Football / The Odds API (2026-07-05)

Source : capture d'écran d'un book listant des ligues additionnelles, croisées avec
`packages/db/src/seed.ts` (49 compétitions actuellement suivies),
`apps/backend/src/config/etl.constants.ts` (`THE_ODDS_API_SPORT_KEYS`, 23 clés
mappées seulement), l'endpoint `/leagues` d'API-Football (1235 compétitions), et
`/v4/sports` de The Odds API (67 clés `soccer_*`).

## Constat

- Aucune ligue **argentine, australienne, chilienne, bolivienne** n'est
  couverte aujourd'hui dans `seed.ts`.
- Les "Qualification" UCL / Europa / Conference vues sur le book sont **déjà
  couvertes** : API-Football ne sépare pas les tours qualificatifs en
  compétition distincte (mêmes `leagueId` que UCL=2, UEL=3, UECL=848).
- **Le flag `active` de The Odds API est saisonnier, pas une capacité
  permanente.** Constaté début juillet (creux de la trêve estivale
  européenne) : même `soccer_uefa_champs_league` (déjà suivi et backtesté
  chez nous) apparaît `active:false` en ce moment. Donc une ligue `inactive`
  aujourd'hui n'est **pas** un signal "à écarter" — c'est juste hors-saison.
  Comme la demande est de préparer la saison à venir (reprise ~fin juillet/
  août 2026 pour la plupart des championnats européens), les lignes
  ci-dessous incluent volontairement les clés inactives.

## ⚡ Fix rapide — compétitions déjà suivies mais pas mappées Odds API

Deux compétitions sont **déjà dans `seed.ts`** mais leur clé Odds API
existante n'est **pas** dans `THE_ODDS_API_SPORT_KEYS` — donc `includeInBacktest:
false` par défaut alors qu'un backtest serait possible :

| Compétition (déjà en base)       | Odds API sport key disponible    |
| -------------------------------- | -------------------------------- |
| `KOR1` — Corée du Sud K League 1 | `soccer_korea_kleague1` (active) |
| `UNL` — UEFA Nations League      | `soccer_uefa_nations_league`     |

→ Ajout d'une ligne dans `THE_ODDS_API_SPORT_KEYS`, pas de nouvelle
compétition/migration nécessaire.

## À ajouter — Groupe A (masculin D1, clé Odds API existe → backtest possible)

| Ligue                         | API-Football `leagueId` | Odds API sport key                  | Odds API le 2026-07-05                                                                                     |
| ----------------------------- | ----------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Argentine — Primera División  | 128                     | `soccer_argentina_primera_division` | active                                                                                                     |
| Autriche — Bundesliga         | 218                     | `soccer_austria_bundesliga`         | active                                                                                                     |
| Danemark — Superliga          | 119                     | `soccer_denmark_superliga`          | active                                                                                                     |
| Irlande — Premier Division    | 357                     | `soccer_league_of_ireland`          | active                                                                                                     |
| Écosse — Premiership          | 179                     | `soccer_spl`                        | active                                                                                                     |
| Brésil — Série B              | 72                      | `soccer_brazil_serie_b`             | active                                                                                                     |
| Belgique — Jupiler Pro League | 144                     | `soccer_belgium_first_div`          | inactive (reprise ~fin juillet)                                                                            |
| Grèce — Super League 1        | 197                     | `soccer_greece_super_league`        | inactive (reprise ~août)                                                                                   |
| Russie — Premier League       | 235                     | `soccer_russia_premier_league`      | inactive (reprise ~juillet)                                                                                |
| Arabie Saoudite — Pro League  | 307                     | `soccer_saudi_arabia_pro_league`    | inactive (reprise ~août)                                                                                   |
| Australie — A-League          | 188                     | `soccer_australia_aleague`          | inactive (saison Oct→Mai, reprend en octobre)                                                              |
| Chili — Primera División      | 265                     | `soccer_chile_campeonato`           | inactive                                                                                                   |
| Allemagne — 3. Liga           | 80                      | `soccer_germany_liga3`              | inactive (reprise ~août ; on couvre déjà BL1+D2, complète la profondeur allemande comme EL1/EL2/I2/SP2/F2) |

Toutes permettent un vrai backtest ROI dès l'ajout (`includeInBacktest: true`,
même modèle que POL1/SUI1/TUR1/MLS). Priorité aux 6 premières (actives
maintenant) ; les suivantes sont hors-saison mais la clé existe déjà →
`csvDivisionCode`/`leagueId` peuvent être seedés dès maintenant pour être
prêts à la reprise.

## À considérer — compétitions continentales de clubs (Amérique du Sud)

**Trouvaille notable** : `soccer_conmebol_copa_libertadores` (id API-Football 13) et `soccer_conmebol_copa_sudamericana` (id 11) sont **actives** sur The
Odds API et ne sont **pas du tout** suivies — alors qu'on couvre déjà
l'équivalent européen (UCL/UEL/UECL). Ce sont les plus grosses compétitions de
clubs sud-américaines (marché de paris important). ⚠️ Format à élimination
directe par phases de groupes puis KO — vérifier que le moteur gère bien ce
format (marchés/`allowedMarkets` par phase) avant d'activer, comme pour
UCL/UEL. Recommandé en évaluation avant ajout définitif.

## À ajouter (Groupe B — masculin, aucune clé Odds API → observation seule)

Pas de cotes historiques chez The Odds API sous aucun format, donc pas de
backtest ROI, mais volume/tier suffisants pour élargir l'engine (Poisson/xG
ne dépend pas des cotes historiques pour tourner) :

| Ligue                                | API-Football `leagueId` |
| ------------------------------------ | ----------------------- |
| Argentine — Primera Nacional (D2)    | 129                     |
| Chili — Segunda División             | 711                     |
| Corée du Sud — K League 2            | 293                     |
| Chine — League One                   | 170                     |
| Finlande — Ykkösliiga (D2)           | 1087                    |
| USA — USL Championship (vraie D2 US) | 255                     |

## Coupes domestiques & tournois internationaux à élimination directe

Vus dans le catalogue Odds API mais **volontairement écartés de ces deux
groupes** — format single-elim/matchs aller-retour, logique de settlement et
`allowedMarkets` différente du pattern ligue actuel, à traiter comme un
chantier à part si un jour pertinent : FA Cup, Copa del Rey, Coppa Italia,
Coupe de France, DFB-Pokal, EFL Cup (coupes nationales) ; CAN, CONCACAF Gold
Cup, CONCACAF Leagues Cup, Copa América, FIFA Club World Cup, UEFA Euro
(tournoi + qualifications), UEFA Champions League Women (tournois
internationaux/continentaux). `soccer_fifa_world_cup_winner` est un marché
outright (vainqueur du tournoi), pas une compétition à fixtures — hors sujet
pour notre moteur par-match.

## Ligues féminines — pas de backtest possible aujourd'hui

Vérification directe de `/v4/sports` : sur tout le catalogue soccer, **seules
2 entrées féminines existent** — `soccer_germany_bundesliga_women` et
`soccer_uefa_champs_league_women` (toutes deux inactives actuellement, y
compris hors-saison comme le reste). **Aucune clé** pour WSL (Angleterre),
NWSL (USA), Liga F (Espagne) ou Première Ligue/D1 Arkema (France) chez ce
fournisseur — donc contrairement au masculin, ce n'est pas un problème de
saisonnalité, ces ligues n'existent simplement pas dans le catalogue.

La recherche web confirme que ces ligues ont bien des marchés de paris chez
d'autres bookmakers/agrégateurs (OddsPortal, Oddspedia, FanDuel...), mais ça
ne nous aide pas : EVCore consomme spécifiquement The Odds API pour
l'historique et API-Football pour fixtures/xG, pas ces agrégateurs. Sources :
[WSL — OddsPortal](https://www.oddsportal.com/football/england/wsl/), [NWSL —
OddsDigger](https://oddsdigger.com/football/usa/nwsl).

API-Football a bien les fixtures de ces ligues (`FA WSL` id 44, `NWSL Women`
id 254, `Frauen-Bundesliga` id 82, `Belgium Super League Women` id 146,
etc.) — donc un suivi **observation seule** est techniquement possible, mais
zéro backtest ROI (même contrainte que le Groupe B) et qualité/densité du xG
probablement plus faible (pas vérifié empiriquement).

**Recommandation : ne pas ajouter pour l'instant.** Hors scope produit actuel
(EVCore ne suit que du masculin aujourd'hui) et aucun gain de backtestabilité
par rapport au Groupe A/B masculin qui a déjà la priorité.

## À ignorer

- **Australie NPL** (ACT/NSW/SA/Northern NSW/Queensland — ligues régionales
  semi-pro, distinctes de l'A-League ci-dessus) — cotes quasi inexistantes,
  volume trop fragmenté par État.
- **USA — USL League One/Two, MLS Next Pro** — divisions de développement,
  pas dans Odds API, stats API-Football probablement pauvres.
- **Argentine — Torneo Federal A, Primera B, Primera C** — 3e-4e division
  amateur, même problème.
- **Bhoutan Premier League, Bolivie Division Profesional** — volume trop
  faible, pas de cotes.
- **MONDE: Amical Club** (id 667, _Friendlies Clubs_, distinct du `FRI`
  international déjà suivi) — matchs amicaux de clubs, signal trop bruité.
- **Ligues féminines** — cf. section dédiée ci-dessus.

## Prochaine étape

1. ✅ **Fix rapide** — `KOR1`/`UNL` ajoutés dans `THE_ODDS_API_SPORT_KEYS`
   (`packages/db/src/seed.ts` + `apps/backend/src/config/etl.constants.ts`).
2. ✅ **Groupe A (13 lignes)** ajoutées dans `seed.ts` +
   `THE_ODDS_API_SPORT_KEYS` (`includeInBacktest: true`) : `ARG1, AUT1, DEN1,
IRL1, SCO1, BRA2` (actives maintenant sur Odds API) + `BEL1, GRE1, RUS1,
KSA1, AUS1, CHI1, D3` (clé existante, hors-saison au 2026-07-05 — pas
   d'action supplémentaire attendue à la reprise). Backend typecheck/lint ✅,
   pas de doublon `leagueId`/`code` (62 compétitions au total).
   > ⚠️ **Reste à toi** : migration/seed (`pnpm --filter @evcore/db` via ton
   > CLI) pour peupler la DB — non lancé ici (règle projet : jamais `db
generate`/`db build` depuis Claude).
3. ✅ **Groupe B (6 lignes vues sur le book)** ajoutées dans `seed.ts`
   (`includeInBacktest: false`, aucune clé Odds API) : `ARG2` (Primera
   Nacional, id 129), `CHI2` (Segunda División, id 711), `KOR2` (K League 2,
   id 293), `CHN2` (League One, id 170), `FIN2` (Ykkösliiga, id 1087), `USA2`
   (USL Championship, id 255). 68 compétitions au total, pas de doublon.
4. ✅ **`csvDivisionCode`** passé en revue pour toutes les ligues ajoutées cette
   session, contre les deux sources football-data.co.uk (ligues "principales"
   par saison vs "extra leagues" fichier unique) :
   - Nouveaux codes ajoutés : `ARG1→ARG`, `AUT1→AUT`, `DEN1→DNK`, `IRL1→IRL`,
     `RUS1→RUS` (extra leagues) ; `SCO1→SC0`, `BEL1→B1`, `GRE1→G1` (ligues
     principales, dossier par saison).
   - **Gaps préexistants corrigés au passage** : `BRA1→BRA`, `CSL→CHN`,
     `FIN1→FIN` avaient une source CSV disponible mais laissée `null`.
   - Le worker `odds-csv-import.worker.ts` distingue les deux formats d'URL
     via `EXTRA_LEAGUE_DIVISION_CODES` (fichier unique `new/<code>.csv` vs
     dossier par saison `<code>.csv`) — étendu avec `ARG, AUT, BRA, CHN, DNK,
FIN, IRL, RUS` pour que ces nouveaux codes pointent vers la bonne URL.
   - Aucune source CSV pour `KSA1, AUS1, CHI1, CHI2, D3, KOR1, KOR2, CHN2,
USA2, ARG2` (pas de coverage football-data.co.uk pour Arabie Saoudite,
     Australie, Chili, Allemagne 3e div., Corée, USA D2, Argentine D2) —
     restent `null`, backtest uniquement via Odds API quand disponible.
   - Backend typecheck/lint ✅.
5. Évaluer séparément Copa Libertadores/Sudamericana (format à clarifier avant
   d'ajouter — élimination directe par phases, `allowedMarkets` à revoir).

Migration/seed appliqués par l'utilisateur (CLI) dans tous les cas.
