# World Cup 2026 — Plan d'intégration EVCore

## Calendrier

| Étape                   | Date                                             |
| ----------------------- | ------------------------------------------------ |
| Match d'ouverture       | 11 juin 2026 (Mexique vs Afrique du Sud, Azteca) |
| Fin de phase de groupes | 27 juin 2026                                     |
| Round of 32             | 28 juin – 3 juillet 2026                         |
| Round of 16             | 4 – 7 juillet 2026                               |
| Quarts de finale        | 9 – 11 juillet 2026                              |
| Demi-finales            | 14 – 15 juillet 2026                             |
| Match pour la 3e place  | 18 juillet 2026                                  |
| Finale                  | 19 juillet 2026 (MetLife Stadium, New Jersey)    |

**Format :** 48 équipes · 12 groupes de 4 · 104 matchs au total  
**Qualification :** Top 2 de chaque groupe + 8 meilleurs 3es = 32 équipes en knockout

---

## Intégration API

### API Football

| Champ                 | Valeur                               |
| --------------------- | ------------------------------------ |
| `leagueId`            | `1` (identique à 2022)               |
| `season`              | `2026`                               |
| Endpoint fixtures     | `GET /fixtures?league=1&season=2026` |
| Endpoint vérification | `GET /leagues?id=1&season=2026`      |

### The Odds API

| Champ                         | Valeur                                           |
| ----------------------------- | ------------------------------------------------ |
| Sport key                     | `soccer_fifa_world_cup`                          |
| Outright/futures              | `soccer_fifa_world_cup_winner`                   |
| Qualif. UEFA (historique)     | `soccer_fifa_world_cup_qualifiers_europe`        |
| Qualif. CONMEBOL (historique) | `soccer_fifa_world_cup_qualifiers_south_america` |

La clé `soccer_fifa_world_cup` est active uniquement pendant le tournoi — même comportement que 2022.

---

## Seed — Entrée à ajouter

```typescript
// packages/db/src/seed.ts — dans le tableau COMPETITIONS
{
  code: 'WC26',
  name: 'FIFA World Cup 2026',
  country: 'World',
  leagueId: 1,
  csvDivisionCode: null,
  apiSeasonOverride: 2026,
  isActive: false, // activer manuellement à J-7 du tournoi
},
```

---

## ETL Constants — Entrée à ajouter

```typescript
// apps/backend/src/config/etl.constants.ts — dans THE_ODDS_API_SPORT_KEYS
WC26: 'soccer_fifa_world_cup',
```

---

## Particularités du marché — Ajustements modèle

### Buts par match

| Phase                  | Moyenne historique (2014–2022) | Impact canal                    |
| ---------------------- | ------------------------------ | ------------------------------- |
| Phase de groupes J1    | ~2.38 buts/match               | Over 2.5 moins fiable           |
| Phase de groupes J2    | ~2.94 buts/match               | Over 2.5 plus porteur           |
| Phase de groupes J3    | ~2.54 buts/match               | Attention aux matchs simultanés |
| Knockout (temps régl.) | ~2.0–2.4 buts/match            | Under souvent value             |

### BTTS

- **Phase de groupes :** ~40–50% (nettement inférieur aux championnats club ~55–65%)
- **Knockout :** ~62.5% (équipes contraintes d'attaquer)
- **Implication EVCore :** le canal BTTS est systématiquement surévalué en J1 quand une grande nation affronte un outsider. `BTTS Yes` à éviter sur ce profil de match.

### Nul (canal NUL)

- **Taux historique groupes :** 22–29% selon édition (2014: 29.2%, 2018: 22.9%, 2022: 23.4%)
- Comparable aux championnats club en moyenne
- **Attention J3 :** les deux derniers matchs de chaque groupe sont simultanés → les deux équipes peuvent rationnellement accepter un nul même sans entente directe

### Buts sur coup de pied arrêté

~25–30% des buts en Coupe du Monde viennent de phases arrêtées, soit significativement plus que les championnats club. Le modèle lambda (Poisson) doit intégrer ce facteur si les données de corner/coup franc sont disponibles.

### Penalty / Prolongation

~25% des matchs knockout se décident aux prolongations ou tirs au but. La cote 1X2 en temps réglementaire est la seule surface de scoring pertinente pour EVCore — ne pas scorer sur des marchés "90 minutes + AET".

---

## Seuils modèle recommandés

Ces seuils de `finalScore` sont provisoires (pas de backtest disponible sur tournoi international). À ajuster après calibration.

```typescript
// apps/backend/src/modules/ai-engine/signal-window.service.ts
// MODEL_THRESHOLD — entrée WC26 à ajouter
WC26: 0.52,  // seuil conservateur, ajuster après 10+ matchs observés
```

Justification : format inédit (48 équipes), forte hétérogénéité des adversaires en groupes, aucun historique EVCore sur cette compétition.

---

## Fenêtre signal (windowDays)

Pour le canal CONF/BTTS/NUL, la fenêtre de 14 jours standard est inadaptée : il peut s'écouler plusieurs jours entre deux matchs de la même équipe. Recommandation :

- **Phase de groupes :** `windowDays: 30` (couvre les 3 journées de groupe + qualifs récentes)
- **Knockout :** `windowDays: 45` (incorpore tout le groupe + R32/R16)

---

## Plan d'activation

| Quand                         | Action                                                           |
| ----------------------------- | ---------------------------------------------------------------- |
| Dès maintenant                | Ajouter `WC26` dans seed + `etl.constants.ts`, `isActive: false` |
| 7 jours avant le 11 juin 2026 | `isActive: true`, lancer sync fixtures via ETL                   |
| 11 juin 2026                  | Le moteur commence à analyser et générer des coupons WC26        |
| Après 20+ matchs              | Calibrer `MODEL_THRESHOLD['WC26']` via le hit rate observé       |
| 19 juillet 2026 (fin)         | `isActive: false`, débrief backtest interne                      |

---

## Volumes attendus

| Phase                    | Matchs/jour    | Fixtures totales |
| ------------------------ | -------------- | ---------------- |
| Phase de groupes (J1–J2) | 4              | 48               |
| Phase de groupes J3      | 6 (simultanés) | 24               |
| Round of 32              | 2–3            | 16               |
| Round of 16              | 1–2            | 8                |
| QF → Finale              | 1              | 8                |
| **Total**                |                | **104**          |

Avec 48 équipes et ~2 picks par match (EV + CONF ou BTTS), le pool journalier peut atteindre **8–12 picks/jour** en phase de groupes — dans les limites du `MAX_POOL_SIZE: 25` actuel.

---

## Ce qu'EVCore ne fait pas (limites)

- Pas de scoring sur les marchés de qualification individuelle (meilleur buteur, etc.)
- Pas de modèle pour les tirs au but — les matchs knockout en AET doivent être exclus du canal NUL
- Le modèle lambda actuel n'est pas calibré sur les confrontations inter-confederation — les EV calculés sur J1 de groupe seront moins fiables

(trouver une solution si possible tout en ne derangeant pas les autres ligues)
