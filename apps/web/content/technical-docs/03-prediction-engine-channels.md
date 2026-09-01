# Canaux de prédiction

EVCore émet une décision de pari par match via 21 canaux : 19 canaux de
prédiction pure spécialisés par marché, 2 méta-canaux qui n'émettent pas de
pick, et un canal LLM (`VANTAGE`) qui tourne hors du socle déterministe. Ce
document décrit la redéfinition architecturale du 2026-08-17/18 — un canal
n'est plus un consommateur indépendant d'un unique moteur Poisson, mais le
lecteur d'une **famille de moteur prédictif** dédiée à son marché —, les 3
phases d'orchestration, la table complète des canaux, et les deux
conséquences produit de l'audit du 2026-08-22 : l'edge revendiqué est
anti-prédictif, et Investir n'affiche plus 18 modes mais 3 vues.

Sources : `docs/prediction-engine-families.md`,
`docs/channel-strategy-architecture.md`,
`docs/audit-canaux-investir-2026-08-22.md`, code réel dans
`packages/analysis-core/src/strategies/`,
`apps/backend/src/modules/investment/`,
`apps/backend/src/modules/coupon/`.

## Nomenclature

Les canaux sont toujours identifiés par leur code anglais dans le code, les
logs, les colonnes de base de données et cette documentation : `DRAW`,
`SAFE`, `BTTS`, `DOUBLE_CHANCE`, etc. Les anciens tags français (`NUL`, `SV`,
`BB`, `CONF`) sont retirés du code partout — ils n'apparaissent plus que
comme note historique dans certains commentaires, jamais comme identifiant
actif. Ne jamais réintroduire un nom français comme clé de canal, même dans
du texte utilisateur.

## Familles de moteurs prédictifs

Avant le 2026-08-17, chaque canal lisait la même fiche de match et le même
λ Poisson plein-match, y compris les canaux mi-temps et le canal DRAW. La
redéfinition sépare la question « quel processus génère la probabilité » de
la question « quel canal choisit une décision sur ce marché ». En football,
sur les marchés déjà en scope (EVCORE.md §3.3), 3 familles alimentent les 19
canaux de prédiction pure :

| Famille | Processus générateur | Canaux nourris | Statut du moteur |
| --- | --- | --- | --- |
| A — Poisson plein-match | `lambda.home` / `lambda.away`, corrigé H2H | DOMINANT, GOALS, CLEAN_SHEET, TEAM_TOTAL, DOUBLE_CHANCE, DRAW_NO_BET, WIN_TO_NIL, RESULT_TOTAL_GOALS, RESULT_BTTS, BTTS | Existant, mature |
| A-bis — matrice de score complète | Distribution complète de la famille A + signal H2H scoreline | CORRECT_SCORE | Existant, validé le 2026-08-15 (signal H2H, sans staking) |
| A' — distribution 1ère mi-temps | Fraction fixe `FIRST_HALF_GOAL_FRACTION = 0.44` du λ plein-match | WIN_EITHER_HALF, OVER_UNDER_HT, FIRST_HALF, HALF_TIME_FULL_TIME | **Faux moteur** — pas de calibration ligue/équipe ; un backtest walk-forward existant montre la fraction déjà bien calibrée sur les ligues où `OverUnderHtStrategy` tourne, donc aucun chantier n'a été ouvert sans preuve d'un biais réel |
| D — implicite marché | Lecture directe de la cote dévigée (`1/drawOdds`), aucun calcul interne | DRAW | Existant, correct — le Poisson plafonne structurellement autour de 0.32 de probabilité de nul, donc le marché fait mieux que le modèle sur ce point précis |

VALUE et SAFE ne sont **pas une famille** : ce sont des filtres transversaux
qui relisent les décisions déjà prises par les 16 autres canaux de marché
(voir la section Phases ci-dessous). CONSENSUS et AVOID lisent, eux, la
totalité des décisions de toutes les familles — ce sont des méta-canaux, pas
un moteur de plus.

Le pipeline de lecture d'une fiche de match reste, dans son principe :

1. **Fiche brute** — `BettingEngineService.analyzeFixture()` calcule les
   stats rolling, xG, forme, volatilité de ligue, et la dernière snapshot de
   cotes.
2. **Chaque famille calcule sa distribution** à partir de cette même fiche
   (aujourd'hui, une seule fonction — `listEvaluatedPicks` — le fait depuis
   un unique λ ; les familles A' et D sont déjà séparées conceptuellement
   mais pas encore extraites en moteurs indépendants pour A').
3. **`buildStrategyContext()` groupe les picks évalués par marché**
   (`evaluatedMarkets`), quel que soit le nombre de moteurs qui les
   alimentent.
4. **L'orchestrateur exécute les 3 phases** décrites ci-dessous.
5. **Sortie** : jusqu'à 20 `StrategyDecision` par fixture (les 19 canaux de
   prédiction pure + les méta-canaux qui, même sans pick, produisent une
   décision `NO_BET`/`AVOID` tracée), stockées comme `ChannelDecision` et
   agrégées dans le `ModelRun`. `VANTAGE` s'ajoute séparément, après coup,
   depuis `apps/vantage-worker` (voir plus bas).

## Les 3 phases de l'orchestrateur

`ChannelStrategyOrchestrator.evaluate()`
(`packages/analysis-core/src/strategies/orchestrator.ts`) accumule les
décisions dans une même Map, phase après phase, chaque phase voyant tout ce
que les phases précédentes ont déjà décidé :

### Phase 1 — canaux de marché

Un canal par marché (ou par petit groupe de marchés apparentés). Chacun est
le spécialiste de son marché : il choisit la meilleure prédiction disponible
dans `evaluatedMarkets`, via un argmax ou un seuil calibré par ligue — jamais
un scan transversal de tous les marchés. C'est la même logique pour les 16
canaux, quelle que soit la famille qui les nourrit.

### Phase 2 — filtres (VALUE, SAFE)

Depuis le 2026-08-18, VALUE et SAFE ne scannent plus `evaluatedMarkets` de
façon indépendante. Ils lisent `previousDecisions` — les décisions déjà
prises par les canaux de marché de la Phase 1 — et re-sélectionnent parmi
elles selon leur propre critère (edge pour VALUE, probabilité/volatilité
pour SAFE). Avant ce changement, ils tournaient en Phase 1 comme des
scanners indépendants du même socle Poisson.

Mesuré le 2026-08-22 : 89,5 % des sélections VALUE et 93,3 % des sélections
SAFE dupliquent exactement un pick déjà émis en Phase 1 (même run, même
marché, même pick, même probabilité à 4 décimales). Et l'acte de
resélectionner **dégrade** la calibration — voir la section dédiée
ci-dessous.

### Phase 3 — méta-canaux (CONSENSUS, CONTRARIAN, AVOID)

Ces canaux lisent l'intégralité des décisions de Phase 1 et Phase 2 et
n'émettent **aucun pick propre** — ils qualifient l'accord ou le désaccord
entre canaux :

- `CONSENSUS` mesurait le niveau d'accord entre canaux de marché sur un même
  résultat. Il publiait `probability: best.maxProbability` — or le maximum de
  k estimations bruitées est structurellement biaisé vers le haut (ratio
  réalisé/annoncé de 0,726, alors qu'il agrège DOMINANT à 0,918 tout seul).
  Depuis le 2026-08-22, il n'émet plus de sélection (`selections: []`) ; son
  niveau d'accord reste visible dans `reasonDetails`.
- `AVOID` est un signal de rejet, pas de sélection : il détecte les
  divergences implausibles modèle↔marché et retire le pick correspondant des
  surfaces de mise. C'est le seul signal de sélection du système qui ait
  jamais tenu à la mesure (−20 % de ROI sur ce qu'il écarte, 3 saisons).
- `CONTRARIAN` figure dans l'enum `StrategyChannel` mais n'est pas
  implémenté. Une étude en lecture seule (2026-06-23, 3 saisons) a montré que
  fader le favori du modèle quand il diverge du marché perd −10,1 % de ROI, et
  que les favoris jugés « surcotés » par le modèle gagnent quand même 63,2 %
  contre 64,2 % implicite — soit aucune information exploitable. Le modèle
  ajoute de la valeur en confirmant le marché (CONSENSUS) ou en signalant son
  propre excès de confiance (AVOID), pas en s'opposant au marché.

## Table complète des canaux

Statut « staké » = présent dans le pool de coupon et/ou la vue « Ce qu'on
assume » d'Investir ; « observation » = décisions produites et tracées, sans
mise systématique.

| Canal (code) | Marché(s) | Famille | Critère de sélection | Statut mesuré (audit 2026-08-22) |
| --- | --- | --- | --- | --- |
| `DOMINANT` | ONE_X_TWO (issue dominante) | A — Poisson plein-match | Argmax sur la distribution 1X2 | Observation — ROI shrinké −1,80 % |
| `GOALS` | OVER_UNDER (buts, plusieurs lignes) | A | Argmax/seuil par ligne | Observation — ROI shrinké −4,63 %, plus gros volume (17 422 sélections) |
| `BTTS` | BTTS (deux équipes marquent) | A | Seuil de probabilité | Observation — ROI shrinké −6,50 % ; staking historique par ligue (PL, BL1) hors canal, voir `BTTS_STAKED_LEAGUES` |
| `CLEAN_SHEET` | CLEAN_SHEET_HOME / AWAY | A | Argmax entre les deux issues | Observation — ROI shrinké −7,30 % |
| `TEAM_TOTAL` | Total buts par équipe | A | Argmax par marché candidat | Observation — ROI shrinké −2,69 % |
| `DOUBLE_CHANCE` | DOUBLE_CHANCE | A | Argmax sur les 3 combinaisons | **Assumé — ROI shrinké +2,24 %**, l'un des 2 seuls canaux positifs |
| `DRAW_NO_BET` | DRAW_NO_BET | A | Argmax | Observation — ROI shrinké −4,57 % |
| `WIN_TO_NIL` | WIN_TO_NIL_HOME / AWAY | A | Argmax entre les deux issues | Observation — ROI shrinké −9,63 %, pire canal après HALF_TIME_FULL_TIME |
| `RESULT_TOTAL_GOALS` | Résultat + total buts (composite) | A | Argmax sur le produit cartésien | Observation — ROI shrinké −5,62 %, volume faible (poids 0,29) |
| `RESULT_BTTS` | Résultat + BTTS (composite) | A | Argmax sur le produit cartésien | Observation — ROI shrinké −6,60 %, volume faible (poids 0,27) |
| `CORRECT_SCORE` | Score exact | A-bis — matrice complète | Argmax sur la matrice de scores + signal H2H scoreline | Observation — ROI shrinké −8,64 %, exclu d'Investir (volume réglé quasi nul) |
| `WIN_EITHER_HALF` | TO_WIN_EITHER_HALF | A' — distribution 1ère MT | Seuil de probabilité | Observation — ROI shrinké −6,24 % ; moteur mi-temps non calibré par ligue |
| `OVER_UNDER_HT` | OVER_UNDER_HT (0.5 / 1.5 uniquement) | A' | Seuil par ligne | Observation — ROI shrinké −4,73 % ; désactivé temporairement lors de la recalibration WC 2026-07-01 |
| `FIRST_HALF` | FIRST_HALF_WINNER | A' | Argmax | Observation — ROI shrinké dans le groupe « FIRST_HALF » de l'audit (−4,77 %) |
| `HALF_TIME_FULL_TIME` | HALF_TIME_FULL_TIME | A' | Argmax sur les 9 combinaisons MT/FT | Observation — pire ROI shrinké du système (−8,66 %) |
| `DRAW` | ONE_X_TWO (nul) | D — implicite marché | `1/drawOdds` dévigée | **Assumé — ROI shrinké +0,74 %**, meilleur ratio réalisé/annoncé du système (1,016) ; staking restreint aux ligues `I2`, `POR`, `BL1`, `CSL` (`DRAW_STAKED_LEAGUES`) |
| `VALUE` | Transversal (Phase 2) | Filtre, pas une famille | Edge (`p − 1/cote`) parmi les picks Phase 1 | Exclu du pool de coupon ; 92 % de doublons Phase 1 (ratio 0,721, ROI −0,80 %) ; ses 8 % de picks propres sont mieux calibrés (ratio 0,845, ROI +14,1 %, n=173 — non établi statistiquement) |
| `SAFE` | Transversal (Phase 2) | Filtre | Probabilité/volatilité parmi les picks Phase 1 | Exclu du pool de coupon ; 95 % de doublons Phase 1, ses picks propres sont les pires du système (ROI −19,7 %, n=29) — recommandé à la suppression comme canal |
| `CONSENSUS` | Aucun (méta) | Lit tout | Niveau d'accord entre canaux — n'émet plus de sélection depuis le 2026-08-22 | Exclu du pool de coupon, méta |
| `CONTRARIAN` | Aucun (méta) | Lit tout | Non implémenté | N'existe pas en base de décisions |
| `AVOID` | Aucun (garde-fou) | Lit tout | Divergence modèle↔marché implausible | Exclu du pool de coupon comme pick, mais son exclusion elle-même est le signal le plus fiable du système |
| `VANTAGE` | Transversal, hors orchestrateur | Aucune (LLM, `apps/vantage-worker`) | Second avis indépendant, lit les décisions de tous les canaux + fiabilité mesurée par compétition | En production depuis le 2026-08-28 ; calibration globale proche de la cible (53,3 % vs 53,2 % annoncé, n=158) mais aucun marché n'a encore n≥50 |

`UNDERDOG`, `FAVORITE`, `LIVE_VALUE`, `MARKET_MOVE` existent dans l'enum
`StrategyChannel` (base de données) mais n'ont jamais été implémentés en
stratégie — aucune décision en base, exclus d'Investir et du pool de coupon.

## L'edge revendiqué est anti-prédictif

C'est le résultat le plus lourd de conséquence de l'audit du 2026-08-22.
Sur 51 860 sélections réglées, classées par tranche d'edge revendiqué
(`p − 1/cote`) :

| edge revendiqué | n | taux annoncé | taux réel | ratio réalisé/annoncé |
| --- | --- | --- | --- | --- |
| < 0 | 18 750 | 0,481 | 0,511 | 1,062 |
| 0,00–0,05 | 16 880 | 0,463 | 0,421 | 0,910 |
| 0,05–0,10 | 8 162 | 0,550 | 0,447 | 0,814 |
| 0,10–0,15 | 4 053 | 0,597 | 0,452 | 0,758 |
| 0,15–0,25 | 2 776 | 0,637 | 0,435 | 0,683 |
| > 0,25 | 1 239 | 0,699 | 0,375 | 0,537 |

Le taux réel reste **plat** (0,511 → 0,375) pendant que le taux annoncé
grimpe de 0,481 à 0,699. L'edge ne porte aucune information sur le résultat —
il mesure l'ampleur de l'erreur du modèle, pas un avantage réel. Là où le
modèle price en dessous du marché (edge négatif), il est même sous-confiant.

Conséquence concrète, déjà en place : `MAX_LEG_EDGE = 0.10`
(`apps/backend/src/modules/coupon/coupon.constants.ts`) sert de **plafond**,
jamais de seuil de sélection — une jambe dont l'edge calibré dépasse 0,10 est
rejetée du coupon. Le même plafond est remonté vers Investir sous
`INVESTMENT_GUARDRAILS.maxEdge` (`apps/backend/src/modules/investment/investment.constants.ts`),
accompagné d'un plancher de cote `MIN_LEG_ODDS` / `minOdds = 1.20` (la bande
1,10–1,20 est la pire des cotes courtes, ROI/jambe −5,17 % sur 742 jambes).

`VALUE_MIN_EDGE = 0.10` — le seuil qui définit une sélection VALUE — cible
exactement la région que `MAX_LEG_EDGE` rejette. Le résultat visible côté
produit : la plupart des picks du canal VALUE atterrissent dans la vue
« Écarté » d'Investir (`EXCLUSION_REASON.EDGE_TOO_HIGH`) — c'est le constat
attendu, pas un effet de bord à corriger.

## Admission au pool de coupon

Le pool de coupon (`SignalWindowService.getPoolForRange`, filtré par
`POOL_ELIGIBLE_CHANNELS` dans `apps/backend/src/modules/coupon/coupon.constants.ts`)
admet tout canal qui produit **sa propre décision**, jamais un canal jugé sur
son ROI passé. `POOL_EXCLUDED_CHANNELS` ne retire que :

- les méta-canaux `CONSENSUS`, `CONTRARIAN`, `AVOID` — ils republient ou
  rejettent des décisions d'autres canaux, ils n'en produisent pas de propre ;
- les filtres `VALUE` et `SAFE` — canaux de Phase 2 qui re-sélectionnent
  parmi les picks Phase 1 (89,5 % et 93,3 % de doublons exacts). Les admettre
  mettrait le même pari deux fois dans le pool sous deux labels, et le label
  du filtre porte la pire calibration des deux.

Une version antérieure de cette liste excluait aussi les canaux dont le
ratio réalisé/annoncé mesuré tombait sous 0,90 — ce qui retirait 11 canaux
sur 19. C'était le mauvais instrument : sélectionner des canaux sur leur
ratio passé est lui-même une sélection sur une statistique bruitée, et gelait
le pool contre un instantané que la dérive de concept rend périmé en
quelques semaines. Le biais de chaque canal est désormais **corrigé au
scoring** (`calibrateLegProbability`, courbe de Platt par canal dans
`channel-reliability.ts`) plutôt qu'excluant — un canal qui annonce 0,70 et
réalise 0,51 entre dans le pool à ~0,51 et perd sur le fond, sans qu'une
liste à maintenir ait dû l'exclure à l'avance. Corriger l'emporte sur
exclure : le canal continue de contribuer là où il A raison.

Rappel : l'admission au pool ne se décide jamais sur le ROI de coupon.
`docs/audit-canaux-investir-2026-08-22.md` le chiffre — écart-type de
13 à 18 points pour des différences de ROI de 10 points aux volumes actuels
de coupons/jour. La boucle d'apprentissage tourne au niveau **jambe**
(écart-type ~1,25 point, ~7 000 jambes/mois), jamais au niveau coupon.

## Les 3 vues d'Investir

Avant le 2026-08-22, Investir exposait 18 modes de tri (un par canal, plus
`probability` et `value`), une table `MODE_RANKING` avec un plafond `topN`
par mode. L'audit a testé les 5 plafonds `topN` existants en apparié
(top-N contre liste entière, le même jour) : **aucun n'est significatif dans
aucun sens**, et les deux qui s'en approchaient le plus étaient négatifs — sur
`DRAW`, le plafond coûtait 4,4 points de ROI par jour sur le meilleur canal
du système. `topN` a été supprimé en entier, sans exception, y compris pour
VALUE.

`investment.constants.ts` définit désormais 3 vues
(`INVESTMENT_VIEWS = ['assumed', 'watch', 'excluded']`) :

- **`assumed` (« Ce qu'on assume »)** — les canaux dont le ROI shrinké est
  mesuré positif. Au 2026-08-22 : `DOUBLE_CHANCE` (+2,24 %) et `DRAW`
  (+0,74 %), avec pour `DRAW` la restriction de ligue déjà existante
  (`DRAW_STAKED_LEAGUES` : `I2`, `POR`, `BL1`, `CSL`). Tri unique sur la
  probabilité calibrée, jamais sur l'EV ni l'edge — le tri par EV perd contre
  le tri par probabilité dans 13 configurations appariées sur 16 mesurées.
  La liste des canaux assumés **n'est pas codée en dur** : elle se recalcule
  depuis `InvestmentChannelStatsRepository`, contrairement à l'ancienne liste
  figée `NEGATIVE_ROI_CHANNELS` (2 canaux nommés le 2026-07-06, alors que 16
  canaux sur 18 sont en réalité négatifs). Plafonnée à `assumedMaxPicks = 15`
  — le seul plafond qui survit à la suppression de `topN`, global et non
  choisi parmi plusieurs variantes testées.
- **`watch` (« En observation »)** — tout le reste : une seule liste
  filtrable par canal, chaque pick affichant le ROI shrinké de son canal en
  tête plutôt qu'un onglet dédié par canal. Surface de revue, plafonnée
  seulement pour borner le rendu (`reviewMaxPicks = 300`).
- **`excluded` (« Écarté »)** — ce que les garde-fous ont retiré et pourquoi
  (`ExclusionReason` : `AVOID`, `CALIBRATION_ALERT`, `LAMBDA_INCOHERENT`,
  `EDGE_TOO_HIGH`, `ODDS_TOO_SHORT`). C'est la vue qui manquait avant
  l'audit — elle rend le filtre auditable au lieu de simplement cacher ce
  qu'il retire.

Ce qui a disparu avec la refonte : `MODE_RANKING` (18 entrées de tri),
`VALUE_MODE_CHANNELS`, `SINGLE_CHANNEL_MODE_MAP`, `SingleChannelMode`,
`NEGATIVE_ROI_CHANNELS` (liste figée), `PROBABILITY_BUCKETS` (4 niveaux) —
remplacés respectivement par le tri unique sur la probabilité calibrée, une
liste de canaux avec filtre, le ROI shrinké recalculé, et la probabilité
calibrée elle-même (ratio réalisé/annoncé désormais fiable, 1,016).

## Ce qui reste hors de portée

L'audit a aussi tranché contre le découpage plus fin. Décomposition de
variance sur 51 860 sélections réglées, part réelle de l'écart entre cases
une fois le bruit d'échantillonnage retiré :

| découpage | cases | part réelle |
| --- | --- | --- |
| canal | 16 | 72 % |
| marché | 18 | 68 % |
| canal × tranche de cote | 37 | 59 % |
| ligue | 53 | 46 % |
| ligue × canal | 94 | 15 % |
| ligue × canal × tranche | 161 | 12 % |

À la granularité la plus fine, 88 % de l'écart observé est du bruit — testé
hors échantillon, 0 case sur 117 fiablement positive, effet nul au niveau
coupon (+1,22 % ± 21,3, t=0,06). L'hétérogénéité entre ligues est réelle
(~4 points d'écart-type de ROI) mais ne s'exploite qu'au niveau canal ou
ligue seuls — jamais en croisant les deux avec une tranche de cote. Ne pas
rouvrir ce découpage sans une nouvelle preuve de signal hors échantillon.
