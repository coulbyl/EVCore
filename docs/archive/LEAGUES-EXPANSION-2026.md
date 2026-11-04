# Rapport d'intégration — Expansion des Leagues 2026

> **Date** : 2026-05-21  
> **Scope** : 11 leagues demandées, vérification via API-Football + The Odds API, analyse d'impact sur le backend EVCore.

---

## 1. Corrections critiques — IDs et disponibilités incorrects

La table de correspondance fournie contient **3 IDs API-Football erronés** et **3 erreurs sur The Odds API**.

### IDs API-Football incorrects

| Pays                      | ID fourni | ID réel | Erreur                         |
| ------------------------- | --------- | ------- | ------------------------------ |
| 🇮🇸 Islande (Úrvalsdeild)  | 188       | **164** | 188 = A-League (Australie)     |
| 🇪🇪 Estonie (Meistriliiga) | 124       | **329** | 124 = Denmark Series - Group 1 |
| 🇱🇻 Lettonie (Virsliga)    | 343       | **365** | 343 = First League (Arménie)   |

> **Source** : vérification directe via `GET /leagues?id={id}` sur `v3.football.api-sports.io`.

### Disponibilités The Odds API incorrectes

| Pays                         | Table fournie                | Réalité                                                  |
| ---------------------------- | ---------------------------- | -------------------------------------------------------- |
| 🇨🇳 Chine (Super League)      | ❌ Non disponible            | ✅ **`soccer_china_superleague`**                        |
| 🇫🇮 Finlande (Veikkausliiga)  | ❌ Non disponible            | ✅ **`soccer_finland_veikkausliiga`**                    |
| 🇰🇷 Corée du Sud (K League 1) | ✅ `soccer_korea_k_league_1` | ❌ **Clé inexistante** (non disponible sur The Odds API) |

> **Source** : `GET /v4/sports/?apiKey=...` — 36 clés soccer disponibles, liste exhaustive vérifiée.

---

## 2. Table de correspondance corrigée et complète

| Pays            | Championnat         | ID API-Football       | The Odds API Key               | football-data.co.uk | Statut backend                      |
| --------------- | ------------------- | --------------------- | ------------------------------ | ------------------- | ----------------------------------- |
| 🇧🇷 Brésil       | Brasileirão Série A | **71**                | `soccer_brazil_campeonato`     | ❌                  | À ajouter                           |
| 🇺🇸 USA / Canada | MLS                 | **253**               | `soccer_usa_mls`               | `USA`               | ✅ Déjà présent (`isActive: false`) |
| 🇸🇪 Suède        | Allsvenskan         | **113**               | `soccer_sweden_allsvenskan`    | `SWE`               | ✅ Déjà présent (`isActive: false`) |
| 🇳🇴 Norvège      | Eliteserien         | **103**               | `soccer_norway_eliteserien`    | `NOR`               | ✅ Déjà présent (`isActive: false`) |
| 🇯🇵 Japon        | J1 League           | **98**                | `soccer_japan_j_league`        | `JPN`               | ✅ Déjà actif (`isActive: true`)    |
| 🇰🇷 Corée du Sud | K League 1          | **292**               | ❌ Non disponible              | ❌                  | À ajouter                           |
| 🇨🇳 Chine        | Super League        | **169**               | `soccer_china_superleague`     | ❌                  | À ajouter                           |
| 🇫🇮 Finlande     | Veikkausliiga       | **244**               | `soccer_finland_veikkausliiga` | ❌                  | À ajouter                           |
| 🇮🇸 Islande      | Úrvalsdeild         | **164** _(était 188)_ | ❌ Non disponible              | ❌                  | À ajouter                           |
| 🇪🇪 Estonie      | Meistriliiga        | **329** _(était 124)_ | ❌ Non disponible              | ❌                  | À ajouter                           |
| 🇱🇻 Lettonie     | Virsliga            | **365** _(était 343)_ | ❌ Non disponible              | ❌                  | À ajouter                           |

---

## 3. Disponibilité des saisons sur API-Football

Toutes les leagues ont été vérifiées. Saisons disponibles confirmées :

| League                     | 2024 | 2025 | 2026 |
| -------------------------- | ---- | ---- | ---- |
| Brasileirão (71)           | ✅   | ✅   | ✅   |
| K League 1 (292)           | ✅   | ✅   | ✅   |
| Chinese Super League (169) | ✅   | ✅   | ✅   |
| Veikkausliiga (244)        | ✅   | ✅   | ✅   |
| Úrvalsdeild (164)          | ✅   | ✅   | ✅   |
| Meistriliiga (329)         | ✅   | ✅   | ✅   |
| Virsliga (365)             | ✅   | ✅   | ✅   |

---

## 4. Analyse backtest

Aucune des nouvelles leagues (hors celles déjà en base) ne dispose de données CSV sur `football-data.co.uk` (`mmz4281/` — 404 pour tous). Les odds historiques pour les leagues avec clé The Odds API seront importables via `odds-historical-import`, mais sans cotes de fermeture CSV, le backtest sera limité aux odds The Odds API uniquement.

| League               | `includeInBacktest` | Source odds historiques |
| -------------------- | ------------------- | ----------------------- |
| Brasileirão          | `false`             | The Odds API uniquement |
| K League 1           | `false`             | Aucune                  |
| Chinese Super League | `false`             | The Odds API uniquement |
| Veikkausliiga        | `false`             | The Odds API uniquement |
| Úrvalsdeild          | `false`             | Aucune                  |
| Meistriliiga         | `false`             | Aucune                  |
| Virsliga             | `false`             | Aucune                  |

---

## 5. Calendriers et `seasonStartMonth`

Ces leagues utilisent le **calendrier civil** (saison = année, ex. 2025 = jan–déc 2025), contrairement aux leagues européennes (août–mai). Le champ `seasonStartMonth` est **0-indexed** (0 = janvier).

| League               | Démarrage saison | `seasonStartMonth` |
| -------------------- | ---------------- | ------------------ |
| Brasileirão          | Avril            | `3`                |
| K League 1           | Février          | `1`                |
| Chinese Super League | Mars             | `2`                |
| Veikkausliiga        | Avril            | `3`                |
| Úrvalsdeild          | Avril            | `3`                |
| Meistriliiga         | Mars             | `2`                |
| Virsliga             | Mars             | `2`                |

> **Déjà correctement configurés** : MLS (`seasonStartMonth: 2`), Allsvenskan (`seasonStartMonth: 2`), Eliteserien (`seasonStartMonth: 2`), J1 League (`seasonStartMonth: 1`).

---

## 6. Modifications à apporter au backend

### 6.1 `packages/db/src/seed.ts` — Ajouter dans `COMPETITIONS`

```typescript
// --- Leagues Asie / Amériques / Nordiques (nouveaux) ---
{
  leagueId: 71,
  code: "BRA1",
  name: "Brasileirão Série A",
  country: "Brazil",
  isActive: false,
  csvDivisionCode: null,
  seasonStartMonth: 3, // avril
  includeInBacktest: false,
},
{
  leagueId: 292,
  code: "KOR1",
  name: "K League 1",
  country: "South-Korea",
  isActive: false,
  csvDivisionCode: null,
  seasonStartMonth: 1, // février
  includeInBacktest: false,
},
{
  leagueId: 169,
  code: "CSL",
  name: "Super League",
  country: "China",
  isActive: false,
  csvDivisionCode: null,
  seasonStartMonth: 2, // mars
  includeInBacktest: false,
},
{
  leagueId: 244,
  code: "FIN1",
  name: "Veikkausliiga",
  country: "Finland",
  isActive: false,
  csvDivisionCode: null,
  seasonStartMonth: 3, // avril
  includeInBacktest: false,
},
{
  leagueId: 164,
  code: "ISL1",
  name: "Úrvalsdeild",
  country: "Iceland",
  isActive: false,
  csvDivisionCode: null,
  seasonStartMonth: 3, // avril
  includeInBacktest: false,
},
{
  leagueId: 329,
  code: "EST1",
  name: "Meistriliiga",
  country: "Estonia",
  isActive: false,
  csvDivisionCode: null,
  seasonStartMonth: 2, // mars
  includeInBacktest: false,
},
{
  leagueId: 365,
  code: "LAT1",
  name: "Virsliga",
  country: "Latvia",
  isActive: false,
  csvDivisionCode: null,
  seasonStartMonth: 2, // mars
  includeInBacktest: false,
},
```

### 6.2 `apps/backend/src/config/etl.constants.ts` — Ajouter dans `THE_ODDS_API_SPORT_KEYS`

```typescript
// Asie / Amériques / Nordiques (nouveaux)
BRA1: 'soccer_brazil_campeonato',
CSL:  'soccer_china_superleague',
FIN1: 'soccer_finland_veikkausliiga',
// KOR1 : pas de clé The Odds API disponible
// ISL1, EST1, LAT1 : pas de clé The Odds API disponible
```

---

## 7. Recommandation de groupement

### Groupe A — Activer maintenant (fixtures + odds disponibles)

Ces leagues ont une clé The Odds API et peuvent contribuer au moteur EV dès leur activation.

| Code   | League               | Clé Odds API                   |
| ------ | -------------------- | ------------------------------ |
| `BRA1` | Brasileirão Série A  | `soccer_brazil_campeonato`     |
| `CSL`  | Chinese Super League | `soccer_china_superleague`     |
| `FIN1` | Veikkausliiga        | `soccer_finland_veikkausliiga` |

> MLS, Allsvenskan, Eliteserien sont aussi dans ce groupe mais **déjà en base** — il suffit de mettre `isActive: true` via migration ou UI.

### Groupe B — Fixtures uniquement (pas de cotes via Odds API)

Ces leagues peuvent être trackées (fixtures, résultats, stats) mais sans intégration odds.

| Code   | League       | Usage recommandé                      |
| ------ | ------------ | ------------------------------------- |
| `KOR1` | K League 1   | Backtest si CSV trouvé ultérieurement |
| `ISL1` | Úrvalsdeild  | Suivi fixtures uniquement             |
| `EST1` | Meistriliiga | Suivi fixtures uniquement             |
| `LAT1` | Virsliga     | Suivi fixtures uniquement             |

---

## 8. Impact quotidien API-Football (estimation)

Toutes les 7 nouvelles leagues actives en parallèle des 14 existantes :

| Métrique                   | Avant (14 leagues actives) | Après (14 + 7 = 21)          |
| -------------------------- | -------------------------- | ---------------------------- |
| Appels fixtures/jour       | ~14                        | ~21                          |
| Appels stats/jour          | ~14 × N fixtures           | ~21 × N fixtures             |
| Appels injuries/jour       | ~14 × M matchs             | ~21 × M matchs               |
| **Quota Pro** (7 500/jour) | Utilisé à ~60%             | Estimé à ~90% selon activité |

> Activer progressivement (Groupe A d'abord) pour surveiller la consommation API avant d'activer le Groupe B.

---

## 9. Checklist d'implémentation

- [ ] Corriger les IDs dans toute documentation interne (Islande 164, Estonie 329, Lettonie 365)
- [ ] Ajouter les 7 entrées dans `packages/db/src/seed.ts`
- [ ] Ajouter les 3 clés Odds API dans `etl.constants.ts` (`THE_ODDS_API_SPORT_KEYS`)
- [ ] Exécuter `pnpm --filter @evcore/db seed` pour upsert les nouvelles compétitions
- [ ] Activer les 3 leagues Groupe A via UI ou migration Prisma (`isActive: true`)
- [ ] Décider si Groupe B leagues doivent être activées (fixtures seulement, pas de cotes)
- [ ] Surveiller la consommation API-Football les 7 premiers jours après activation
