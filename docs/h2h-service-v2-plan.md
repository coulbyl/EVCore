# Plan — H2HService v2 : sortir le H2H du mode shadow correctement

## 0. État actuel

`apps/backend/src/modules/betting-engine/h2h.service.ts` calcule un ratio
"victoires du favori sur les 5 dernières confrontations directes", mais le
résultat (`shadowH2h`) n'est **jamais lu par la décision** — juste loggé et
stocké dans `audit.types.ts` (voir `betting-engine.service.ts:634-783`).
Limites identifiées (revue de code du 2026-07-19) :

- Aucun seuil d'échantillon minimum (n=1 donne un score 0 ou 1, aussi
  "confiant" qu'un n=5).
- Aucune pondération par récence (contrairement à `recentForm`, qui utilise
  une décroissance documentée de 0.8 sur 5 matchs).
- Les nuls comptent comme une défaite du favori (perte d'info).
- Pas de distinction domicile/extérieur par confrontation passée.
- `limit=5` fixe, non calibré (contrairement au reste de `ev.constants.ts`
  qui a des maps par ligue backtestées).
- Un seul marché couvert (victoire du favori) alors qu'EVCore trade 12+
  marchés (`packages/analysis-core/src/types/market.ts`).

## 1. Validation empirique — le signal existe et se renforce si on le corrige

Avant de coder quoi que ce soit, on a vérifié que corriger H2H a un intérêt
réel (`packages/db/scripts/backtest-h2h-signal-value.ts`, 46 679 fixtures,
favori = home/away avec la plus haute proba modèle recalibré) :

| Version                                  | n      | Corrélation (score H2H, résidu réel−modelProb) | Écart bucket extrême    |
| ---------------------------------------- | ------ | ---------------------------------------------- | ----------------------- |
| RAW (formule actuelle)                   | 36 763 | r=0.0525                                       | -3.2pp → +3.2pp (6.4pp) |
| IMPROVED (seuil n≥3, decay=0.8, nul=0.5) | 17 194 | r=0.0785                                       | -7.1pp → +5.8pp (13pp)  |

Gradient monotone sur les 5 buckets dans les deux cas — pas du bruit. La
version corrigée double quasiment l'amplitude du signal malgré un
échantillon plus petit. **Conclusion : H2H capte une info que
`recentForm`/xG/lambda/home-adv ne captent pas déjà, et vaut la peine
d'être sorti du shadow — mais comme facteur d'appoint (r reste < 0.1), pas
comme signal dominant.**

## 2. Ce que dit la littérature / pratique du secteur

⚠️ Recherche faite via recherche web générale (2026-07-19) — les sources
trouvées sont majoritairement des blogs de paris sportifs et sites
marketing SEO (`winfulltime.com`, `sportbotai.com`, `bettoolkit.com`,
`bet-analytix.com`, `11v11.com`), **pas de la littérature académique
peer-reviewed vérifiable**. Une source citait "une étude 2018 du Journal
of Sports Analytics" mais je n'ai pas pu la localiser/vérifier — à traiter
comme non confirmée, pas comme fait établi. Les points ci-dessous sont
donc à prendre comme **pratique courante du secteur**, pas comme vérité
scientifique, mais ils convergent avec notre propre résultat empirique
(§1), ce qui leur donne du crédit :

1. **Pouvoir prédictif limité au-delà de ~5 confrontations récentes**, et
   dominé par la forme récente/xG une fois ceux-ci pris en compte — cohérent
   avec notre r=0.05-0.08 (signal réel mais secondaire).
2. **Pondération par récence quasi-unanime** dans les implémentations
   décrites (EMA, poids 1.5× sur le résultat le plus récent, etc.) — déjà
   ce qu'on a testé et validé (§1, IMPROVED).
3. **Split domicile/extérieur** : plusieurs sources recommandent de
   pondérer 3× plus fort les confrontations où la configuration domicile/
   extérieur actuelle s'est déjà produite dans l'historique — pas encore
   testé chez nous, piste identifiée en §4.2.
4. **Discount pour turnover d'effectif/changement d'entraîneur** : un H2H
   vieux de plusieurs saisons perd de sa valeur si les deux effectifs ont
   beaucoup changé. On n'a pas de données fiables de composition d'équipe
   pour opérationnaliser ça finement — proxy simple proposé en §4.4.
5. **H2H par marché, pas seulement par résultat** : plusieurs sources
   évoquent des tendances H2H spécifiques BTTS ("7 des 8 dernières
   confrontations avec but des deux côtés") et Over/Under — directement
   pertinent puisqu'EVCore a des canaux BTTS/CLEAN_SHEET/TEAM_TOTAL/
   WIN_TO_NIL qui pourraient chacun bénéficier d'un signal H2H dédié à leur
   propre marché, pas juste du résultat 1X2.

Sources (qualité variable, voir avertissement ci-dessus) :

- [Head-to-Head Statistics in Football Betting](https://winfulltime.com/blog/head-to-head-statistics)
- [How Head-to-Head Records Power AI Soccer Prediction Models](https://www.sportbotai.com/blog/head-to-head-records-soccer-ai-prediction-models)
- [How H2H Records Shape Soccer Prediction Models](https://www.sportbotai.com/blog/head-to-head-records-soccer-prediction-models-ai-betting-value)
- [How Are We Misreading Football Head-to-Head Statistics](https://www.11v11.com/how-are-we-misreading-football-head-to-head-statistics-in-todays-game/)
- [Football Head-to-Head Stats — H2H Analyzer](https://bettoolkit.com/en/tools/head-to-head-analyzer)
- [Over/Under and BTTS: Betting on Offensive Action](https://www.bet-analytix.com/academy/over-under-btts)
- [Premier League Head-to-Head Analysis](https://www.sportbotai.com/blog/premier-league-head-to-head-analysis-ai-football-value)

## 3. Design proposé — approche par étapes, chaque extension validée séparément

Principe directeur (cohérent avec le reste du projet, cf. WC recalibration,
homeAdv recalibration) : **chaque extension doit repasser le même test de
valeur incrémentale (corrélation résiduelle vs modèle) avant d'être activée
— on n'ajoute pas de facteur juste parce que la théorie dit qu'il devrait
marcher.**

### 3.1 v2.0 — Score de résultat corrigé (déjà validé, §1)

`computeH2HScore` réécrit avec :

- `H2H_MIN_SAMPLE = 3` (retourne `null` en dessous, comme le cold-start
  gate des TeamStats)
- Pondération `decay=0.8` sur les manches les plus récentes en premier
  (même convention que `recentForm`)
- Nul compté `0.5` au lieu de `0`

Reste à faire : déterminer avec quel **poids** l'intégrer dans le score
composite déterministe (`deterministicScore`), en respectant `max-params:
3` (CLAUDE.md) sur toute signature touchée. Poids initial suggéré : petit
(même ordre de grandeur que `congestionScore`, cf. features déjà en place),
**à confirmer par un backtest de gain de Brier sur le score composite
complet** (pas juste la corrélation isolée du §1) avant activation.

### 3.2 v2.1 — Pondération domicile/extérieur (non encore validée)

Idée (issue de la recherche, §2 point 3) : parmi les `H2H_LIMIT` dernières
confrontations, sur-pondérer (×3 proposé, à calibrer) les manches où la
même équipe jouait déjà à domicile que dans la fixture cible. Justifié par
le biais domicile/extérieur qu'on vient de quantifier et corriger
(`ev.constants.ts`, 2026-07-19) — l'avantage du terrain est significatif
dans nos données (44.2% domicile / 30.1% extérieur), donc l'historique
"à domicile contre cet adversaire précis" est plus informatif que
l'historique toutes-configurations confondues.

**Avant d'activer** : réutiliser `backtest-h2h-signal-value.ts`, ajouter
une troisième variante `VENUE_WEIGHTED` et comparer sa corrélation
résiduelle à `IMPROVED` — si le gain n'est pas net, ne pas l'ajouter
(complexité non gratuite).

### 3.3 v2.2 — Signaux H2H par marché

Le point le plus structurant demandé : un H2H "complet" doit couvrir les
marchés qu'EVCore trade réellement, pas seulement 1X2. Sur le même pool de
confrontations point-in-time déjà récupéré par `computeH2HScore`, calculer
en plus (même méthodologie decay+seuil que 3.1) :

| Signal                          | Formule (sur les mêmes manches H2H)                                                                             | Canal cible                    |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `h2hBttsRate`                   | taux pondéré de manches où les deux équipes ont marqué                                                          | BTTS                           |
| `h2hOver25Rate`                 | taux pondéré de manches avec total buts > 2.5                                                                   | OVER_UNDER                     |
| `h2hAvgTotalGoals`              | moyenne pondérée du total de buts                                                                               | RESULT_TOTAL_GOALS, TEAM_TOTAL |
| `h2hCleanSheetRate` (home/away) | taux pondéré où l'équipe (côté domicile/extérieur actuel) a gardé sa cage inviolée face à cet adversaire précis | CLEAN_SHEET                    |
| `h2hWinToNilRate` (home/away)   | taux pondéré où l'équipe a gagné sans encaisser face à cet adversaire                                           | WIN_TO_NIL                     |

Point d'attention : `h2hCleanSheetRate`/`h2hWinToNilRate` sont **orientés
par le côté domicile/extérieur de la fixture cible**, pas par "favori" —
contrairement au score de résultat (3.1), le marché CLEAN_SHEET est défini
par la position domicile/extérieur, pas par la force relative.

**Chaque signal doit être validé indépendamment** avant intégration, avec
le même protocole que §1 : calculer le modelProb actuel du canal
correspondant (déjà backtesté pour CLEAN_SHEET/TEAM_TOTAL/WIN_EITHER_HALF
dans `docs/new-markets-calibration-backtest.md`), calculer le résidu
(réel − modelProb), corréler avec le signal H2H candidat. Risque à
anticiper : l'échantillon par (paire d'équipes × marché) sera plus petit
que pour le score de résultat global — certains signaux pourraient ne pas
avoir assez de volume pour passer le seuil `H2H_MIN_SAMPLE=3` sur assez de
fixtures pour conclure. Traiter chaque signal comme allumé/éteint
indépendamment (pas un paquet à activer d'un bloc).

### 3.4 v2.3 — Discount turnover d'effectif

Vérifié le 2026-07-19 directement sur l'API-Football (plan "Ultra" actif,
75 000 req/jour, 450 req/min — largement suffisant) : **deux sous-cas très
différents en faisabilité.**

**Continuité entraîneur — faisable, peu coûteux.** `GET /coachs?team={id}`
renvoie l'historique complet des entraîneurs d'une équipe avec dates de
début/fin de mandat (`career: [{team, start, end}]`) — testé sur Real
Madrid (541), 3 entraîneurs récents avec mandats datés. Une seule requête
par équipe donne tout l'historique (pas besoin de snapshot point-in-time
répété) : `1 725` équipes en base aujourd'hui → 1 725 requêtes pour tout
couvrir,~4 min en respectant le rate limit, refresh périodique suffisant
(les changements d'entraîneur sont rares). Permet de calculer directement
`sameCoach: boolean` entre la date d'une manche H2H passée et la fixture
cible pour les deux équipes — proxy simple et propre pour "ce H2H reflète-
t-il encore la même philosophie tactique".

**Turnover d'effectif complet — pas faisable proprement dans l'immédiat.**
`GET /players/squads?team={id}` ne renvoie que l'effectif **actuel** (40
joueurs pour Real Madrid), aucun paramètre de date pour un effectif
historique. `GET /transfers?team={id}` renvoie l'historique complet des
transferts par joueur (328 entrées pour Real Madrid) et permettrait en
théorie de reconstruire l'effectif à une date donnée en reconstituant tous
les mouvements joueur par joueur — mais c'est lourd (traitement par
joueur, pas par équipe), fragile (loans/renewals/prêts à démêler), et un
nouveau pan d'ingestion ETL (nouvelle table, nouveau worker, validation
Zod, cf. règles ETL de CLAUDE.md) pour un signal dont la valeur ajoutée
au-delà du decay temporel déjà en place n'est pas prouvée.

**Décision** : implémenter uniquement le proxy `sameCoach` (v2.3a) —
faisable à faible coût avec une seule nouvelle table (`Coach` ou
équivalent, mapping `teamId` → mandats datés) et un worker ETL simple.
Reporter le turnover d'effectif complet (v2.3b) tant qu'aucune preuve
empirique (backtest de valeur incrémentale, même protocole que §1) ne
justifie l'investissement en ingestion.

Plan d'implémentation v2.3a :

- Nouveau modèle Prisma `Coach`/`CoachTenure` (`teamId`, `coachName`,
  `startDate`, `endDate?`) — migration à la main comme le reste du projet.
- Nouveau worker ETL `coachs-sync.worker.ts` (BullMQ, calqué sur
  `injuries-sync.worker.ts`), payload validé Zod avant écriture, respecte
  le rate limit API-Football.
- `H2HService` (ou le futur service dédié §4) enrichit chaque manche H2H
  d'un flag `sameCoachHome`/`sameCoachAway` en comparant le mandat actif à
  la date de la manche vs à la date de la fixture cible.
- **Backtest de valeur incrémentale avant activation**, même protocole que
  §1 : le flag `sameCoach` change-t-il la corrélation résiduelle du score
  H2H v2.0 ? Si le gain n'est pas net, ne pas l'activer — coûte une table
  et un worker de plus pour rien.

## 4. Intégration pipeline

- `H2HService.computeH2HScore` reste dans
  `apps/backend/src/modules/betting-engine/h2h.service.ts` — réécrire la
  méthode existante (signature `ComputeH2HScoreInput` déjà sous la limite
  de 3 paramètres positionnels grâce à l'objet options, à garder).
- Les signaux par marché (3.3) : soit une méthode dédiée
  `computeH2HMarketSignals` sur le même service (une requête H2H
  réutilisée, pas une requête par marché), soit un nouveau service
  `H2HMarketSignalsService` si la méthode grossit trop — décision à prendre
  une fois la v2.2 codée, pas avant.
- **Rester en shadow même après la correction v2.0** le temps d'un
  backtest de gain de Brier sur le score composite complet (pas juste la
  corrélation isolée) — cohérent avec le pattern déjà suivi pour
  CLEAN_SHEET/TEAM_TOTAL/WIN_EITHER_HALF (observation avant activation) et
  pour le recalage homeAdv (calibration puis impact ROI avant de toucher
  `ev.constants.ts`).
- Une fois activé, poids initial **petit et documenté** dans
  `ev.constants.ts` (jamais hardcodé inline, cf. CLAUDE.md), avec un
  commentaire citant ce document + les résultats de backtest qui l'ont
  justifié.

## 5. Plan d'exécution

- [ ] Réécrire `computeH2HScore` (v2.0 : seuil n≥3, decay 0.8, nul=0.5) +
      mettre à jour `h2h.service.spec.ts` (cas n<3, cas avec nuls, cas
      pondération)
- [ ] Backtest de gain de Brier sur le score composite complet avec le
      score H2H v2.0 intégré à un poids candidat (nouveau script, réutiliser
      la méthodologie de `backtest-h2h-signal-value.ts`)
- [ ] Si gain confirmé : activer avec le poids retenu, documenté dans
      `ev.constants.ts`
- [ ] v2.1 (venue-weighting) : backtest de comparaison avant tout code
      définitif
- [ ] v2.2 (signaux par marché) : un backtest de valeur incrémentale par
      signal (BTTS, Over 2.5, clean sheet home/away, win-to-nil home/away),
      activer marché par marché selon le résultat, pas en bloc
- [ ] v2.3a (continuité entraîneur) : modèle Prisma `Coach`/`CoachTenure` +
      worker ETL `coachs-sync.worker.ts` (API-Football `/coachs`, faisable
      à faible coût — vérifié 2026-07-19, 1725 équipes ≈ 4 min à ingérer) +
      backtest de valeur incrémentale (flag `sameCoach` vs corrélation
      résiduelle du score H2H) avant activation
- [ ] v2.3b (turnover effectif complet) : reporté — `/players/squads` ne
      donne que l'effectif actuel, reconstruction via `/transfers`
      lourde/fragile, pas de plan concret tant qu'aucune preuve empirique
      ne justifie l'investissement

## 6. Limites assumées

- Recherche web de qualité inégale (§2) — traiter comme heuristiques de
  pratique courante, pas comme littérature validée.
- Pas d'ajustement pour les compétitions mélangées (coupe vs championnat)
  dans le pool H2H — toutes les confrontations `FixtureStatus.FINISHED`
  comptent aujourd'hui, quelle que soit la compétition.
- v2.2 peut se heurter à des échantillons trop petits par marché — prévoir
  d'exclure silencieusement (retourner `null`) plutôt que d'imposer un
  signal peu fiable.
