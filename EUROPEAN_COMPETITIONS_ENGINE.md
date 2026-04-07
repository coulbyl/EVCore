# EVCore — Moteur d'analyse compétitions européennes

## Objectif

Définir une direction claire pour améliorer l'analyse et la sélection de paris sur les compétitions européennes:

- UEFA Champions League
- UEFA Europa League
- UEFA Conference League

L'objectif n'est pas seulement d'"autoriser" ces compétitions dans le pipeline, mais de construire une lecture plus pertinente de leur contexte spécifique afin d'éviter de les traiter comme de simples ligues domestiques.

---

## Pourquoi un traitement spécifique est nécessaire

Les compétitions européennes ont des propriétés structurelles différentes des championnats:

- opposition entre équipes issues de ligues très différentes
- volume de matchs plus faible
- importance plus forte du contexte de qualification
- séquences à élimination directe avec logique aller/retour
- arbitrages de rotation entre Europe et championnat
- différences fortes de niveau, de style, de calendrier et de profondeur d'effectif

Un moteur calibré principalement sur les ligues domestiques risque donc:

- de surévaluer des formes locales non transférables au contexte européen
- de sous-estimer les effets de fatigue et de rotation
- de mal interpréter les matchs retour
- de manquer les asymétries de motivation
- de produire des analyses trop "plates" sur des matchs à forte dimension tactique

---

## Ce que le moteur sait déjà faire

Aujourd'hui, EVCore sait déjà exploiter des signaux utiles:

- forme récente
- dynamique de buts/xG
- performance domicile/extérieur
- volatilité de la compétition
- cotes pre-match
- signaux shadow sur H2H, congestion et blessures

Ces briques sont utiles, mais elles restent insuffisantes pour couvrir correctement les compétitions européennes dans leur spécificité.

---

## Découvertes validées sur API-Football

Investigation complète réalisée le 2026-04-06 via appels directs API-Football (v3).

### 1. Couverture par compétition et par saison

| Compétition            | ID  | Odds prematch   | Stats / xG | Injuries        | Saison complète     |
| ---------------------- | --- | --------------- | ---------- | --------------- | ------------------- |
| UEFA Champions League  | 2   | 2025 uniquement | 2015+      | 2020+           | **2025 uniquement** |
| UEFA Europa League     | 3   | 2025 uniquement | 2015+      | 2020+           | **2025 uniquement** |
| UEFA Conference League | 848 | 2025 uniquement | 2021+      | 2025 uniquement | **2025 uniquement** |

Conséquence:

- les trois compétitions peuvent être activées en mode opérationnel courant dès la saison 2025
- les saisons antérieures ne disposent pas d'odds dans l'API — le backtest historique sur données API-Football seules n'est pas envisageable

### 2. Structure des compétitions (saison 2025)

Les trois compétitions suivent le même format:

- tours qualificatifs (données présentes mais peu exploitables — équipes inconnues, volume faible)
- League Stage 1 à 8 (format ligue, ~18 matchs par journée)
- Round of 32 → Round of 16 → Quarts → Demi-finales → Finale

Volumes saison 2025: UCL = 276 fixtures, Europa = 266, Conference = 404.

### 3. xG natif disponible sur tous les matchs terminés

Le champ `expected_goals` est renseigné nativement sur les matchs UCL/Europa/Conference terminés (vérifié sur plusieurs matchs Round of 16 2025/2026). Le proxy `shots_on_goal × 0.35` n'est pas nécessaire sur ces compétitions.

### 4. Odds prematch: bookmakers disponibles

15 bookmakers disponibles sur les matchs UCL courants. Pinnacle (ID=4) est présent avec:

- Match Winner 1X2 ✅
- Goals Over/Under (Asian lines détaillées) ✅
- **To Qualify**: absent sur Pinnacle ❌ — disponible sur Bet365, Marathonbet, 1xBet, Betano, 10Bet uniquement

Le marché "To Qualify" est donc un marché secondaire, non couvert par le bookmaker prioritaire.

### 5. Injuries: données riches et exploitables

Données injuries disponibles avec type (`Missing Fixture` / `Questionable`) et raison détaillée (`Knee Injury`, `Yellow Cards`, etc.). Doublon d'entrées constaté sur l'endpoint — à dédupliquer à l'ingestion.

### 6. Détection aller/retour: pas de champ natif

L'API ne fournit pas de champ `leg` sur les matchs à élimination directe. Le round s'appelle `"Quarter-finals"` sans distinction aller/retour.

La détection doit être inférée:

- trouver les deux fixtures avec les mêmes équipes dans le même round
- la plus ancienne par date = aller (leg 1)
- la plus récente = retour (leg 2)
- le score agrégé = calculé depuis le résultat du leg 1 stocké en base

### 7. Forme cross-compétitions accessible depuis la base

Les fixtures de toutes compétitions sont stockées avec `league.id`. La forme domestique (ex: EPL, `leagueId=39`) et la forme européenne (UCL, `leagueId=2`) d'une même équipe sont joignables directement en base sans appel API supplémentaire.

### 8. Conséquence stratégique

Le bon positionnement est:

- activer UCL / Europa / Conference en exploitation dès la saison courante
- rester prudent sur le backtest historique avec les seules données API-Football
- construire le moteur spécialisé Europe en s'appuyant sur les signaux déjà disponibles (xG natif, injuries riches, forme cross-compétitions)

---

## Stratégie d'import des odds historiques

### Pourquoi un import one-shot est nécessaire

API-Football ne fournit des odds que pour la saison 2025. Pour calibrer le moteur sur des données historiques (UCL 2020-2024), il faut une source externe.

### Sources évaluées

| Source                     | Pinnacle?               | Format       | Historique | Coût              | Verdict                                   |
| -------------------------- | ----------------------- | ------------ | ---------- | ----------------- | ----------------------------------------- |
| football-data.co.uk        | ✅ (ligues domestiques) | CSV          | 1993+      | Gratuit           | ❌ Pas de compétitions UEFA               |
| Footiqo                    | ❌ (1xBet uniquement)   | CSV export   | 2015+      | Gratuit           | ❌ Source trop molle pour EV Pinnacle     |
| OddsPapi                   | ✅                      | API JSON     | Variable   | Gratuit (limité)  | ⚠️ IDs propres, matching par date+équipes |
| **The Odds API**           | ✅                      | API JSON     | **2020+**  | **~$30 one-shot** | ✅ Recommandé                             |
| OddsPortal + OddsHarvester | ✅                      | Scraping CSV | 2003+      | Gratuit           | ⚠️ Fragile, pas d'API officielle          |

Footiqo écarté: source 1xBet uniquement — marge ~7-10% vs Pinnacle ~2-3%, les probabilités implicites extraites sont moins précises et biaisent l'EV calculé.

### Décision retenue

Import one-shot via **The Odds API** (~$30) pour les saisons **2022/2023 → 2024/2025** sur UCL, Europa League et Conference League.

Pourquoi 2022/2023 comme point de départ et pas 2020/2021:

- les saisons 2020/2021 et 2021/2022 sont marquées par le contexte COVID (matchs à huis clos, rotations atypiques) — bruit de calibration non représentatif
- 3 saisons × 3 compétitions ≈ 1 000 matchs hors tours qualificatifs — volume suffisant pour un premier Brier score significatif
- si la calibration manque de robustesse après ce premier import, on étend à 2020/2021 sans modifier le code

La constante `EUROPEAN_BACKTEST_SEASON_FROM` dans la config définit l'année de départ (valeur initiale: `2022`). Les données sont importées en base une seule fois et conservées indéfiniment.

### Impact sur OddsSnapshot: champ source

Le worker de rétention actuel (`ODDS_SNAPSHOT_RETENTION_DAYS`, défaut 30 jours) supprimerait les odds historiques importées. Pour distinguer les deux types:

```
OddsSnapshot.source: 'PREMATCH' | 'HISTORICAL'
```

- `PREMATCH` — collectées par l'ETL quotidien → nettoyées selon la politique de rétention normale
- `HISTORICAL` — importées one-shot pour le backtest → conservées indéfiniment, exclues du worker de rétention

Migration Prisma + update du retention worker à implémenter avant l'import.

---

## Ce qui manque aujourd'hui

### 1. Forme multi-compétitions

L'analyse européenne ne devrait pas reposer uniquement sur l'historique de la compétition européenne en cours.

Il faut pouvoir tenir compte:

- des derniers matchs européens
- des derniers matchs domestiques
- de la qualité moyenne des adversaires rencontrés
- de la trajectoire globale récente de l'équipe

Sans cela, les débuts de parcours européen ou certains tours à faible historique sont mal interprétés.

### 2. Contexte aller/retour

Les matchs à élimination directe ne se lisent pas comme des matchs isolés.

Il faut intégrer:

- manche aller ou manche retour
- score cumulé avant le match retour
- équipe devant protéger un avantage
- équipe obligée de remonter
- possibilité de prolongation / tirs au but
- modification naturelle des incitations tactiques selon l'état de la confrontation

Ce point est critique pour la Champions League, l'Europa League et la Conference League.

### 3. Gestion de la fatigue réelle

Le calendrier européen interagit avec le calendrier domestique.

Il faut mieux apprécier:

- jours de repos
- enchaînement des matchs
- charge récente
- proximité d'un choc domestique
- risque de rotation

### 4. Disponibilité et profondeur d'effectif

Le niveau européen est fortement sensible aux absences et à la qualité du banc.

Il faut distinguer:

- blessures de joueurs clés
- rotations probables
- stabilité du onze
- capacité d'une équipe à absorber plusieurs absences sans chute de niveau

### 5. Force relative de l'opposition

Toutes les séries récentes ne se valent pas.

Une bonne analyse européenne doit pondérer:

- le niveau réel des adversaires rencontrés
- la difficulté du calendrier récent
- la provenance des performances

Une équipe dominante dans son championnat mais peu testée face à des adversaires de haut niveau ne doit pas être lue comme une équipe déjà validée dans le contexte européen.

### 6. Spécificité psychologique et stratégique des tours européens

Les compétitions européennes font émerger des comportements particuliers:

- gestion prudente de l'aller
- bloc bas assumé au retour
- équipe favorite qui contrôle sans chercher à surproduire
- équipe outsider qui accepte un match fermé
- priorité donnée à la qualification plutôt qu'à la "performance brute"

Ce type de contexte est difficile à capturer avec les seules métriques agrégées.

---

## Position sur le H2H

Le H2H ne doit pas devenir le cœur du moteur européen.

Il peut être utile comme signal complémentaire lorsqu'il existe:

- familiarité tactique
- asymétrie récurrente entre deux clubs
- historique récent pertinent

Mais il ne faut pas en faire un levier central, car:

- l'échantillon est souvent faible
- les effectifs changent
- les contextes changent
- l'historique ancien peut être trompeur

Le H2H doit donc rester un signal secondaire, contextuel, et non une base d'estimation.

---

## Position sur le LLM

Le LLM peut avoir une place, mais pas comme moteur principal.

### Ce qu'il ne doit pas devenir

- un remplaçant du moteur déterministe
- un arbitre opaque de la décision finale
- une source d'opinions non bornées

### Ce qu'il peut apporter

Le LLM peut être utile comme couche d'ajustement contextuelle sur des situations difficiles à formaliser:

- lecture d'un match retour sous contrainte de qualification
- rotation probable après un gros match domestique
- contexte stratégique atypique
- signaux qualitatifs agrégés issus de données déjà présentes

### Condition d'usage

Le LLM n'a de sens que si:

- la base déterministe est déjà solide
- son influence est bornée
- son rôle est auditable
- il peut être désactivé sans casser le moteur

La bonne philosophie est donc:

- moteur structuré d'abord
- LLM ensuite
- LLM en soutien, pas en substitution

---

## Vision cible

Construire un moteur "European competitions specialist" qui ajoute une couche de contexte par-dessus le moteur actuel.

Cette vision repose sur trois principes:

- conserver une base quantitative robuste
- enrichir fortement le contexte Europe
- utiliser le LLM seulement pour les zones grises

---

## Plan proposé

## Phase 1 — Base analytique européenne

Objectif: rendre les compétitions européennes correctement exploitables sans dépendre d'un LLM.

Priorités:

- intégrer la forme récente cross-compétitions
- distinguer forme domestique et forme européenne
- intégrer la force de l'opposition récente
- fiabiliser la lecture fatigue / congestion
- activer proprement les signaux blessures lorsqu'ils sont jugés fiables

Résultat attendu:

- meilleure lecture des équipes ayant peu d'historique européen
- meilleur démarrage de saison européenne
- moins de dépendance à l'échantillon réduit de la seule compétition UEFA

## Phase 2 — Contexte de qualification

Objectif: traiter correctement les tours à élimination directe.

Priorités:

- reconnaître aller / retour
- intégrer le score agrégé
- reconnaître les équipes qui doivent forcer ou protéger
- modéliser le changement d'incitation tactique
- distinguer match à enjeu de qualification et match de groupe

Résultat attendu:

- meilleure lecture des matchs retour
- moins d'erreurs sur les favoris "pragmatiques"
- meilleure cohérence sur les marchés liés au rythme du match

## Phase 3 — Spécialisation par compétition

Objectif: éviter un moteur "UEFA générique" trop uniforme.

Il faut distinguer au moins:

- Champions League
- Europa League
- Conference League

Car ces compétitions diffèrent en moyenne sur:

- niveau moyen des équipes
- dispersion de niveau
- qualité de marché
- intensité tactique
- rapport entre ambition européenne et priorité domestique

Résultat attendu:

- calibration plus fine
- seuils de confiance mieux adaptés
- meilleure hiérarchisation des opportunités

## Phase 4 — Couche LLM en shadow

Objectif: observer si un raisonnement contextuel supplémentaire apporte réellement de la valeur.

Le LLM doit d'abord être utilisé en shadow:

- sans effet sur la décision finale
- avec journalisation claire
- sur un périmètre limité
- avec comparaison systématique au moteur déterministe

Exemples de questions qu'il peut aider à trancher:

- le favori a-t-il intérêt à contrôler plutôt qu'à dominer ?
- le contexte rend-il le match structurellement plus fermé qu'une lecture xG simple ?
- la pression de qualification change-t-elle la probabilité implicite de certains scénarios ?

Résultat attendu:

- validation ou rejet de l'utilité réelle du LLM
- mesure du gain sur les cas complexes
- réduction du risque de surconfiance

## Phase 5 — Activation contrôlée

Objectif: donner au LLM une place réelle, mais strictement encadrée.

Conditions minimales:

- gain observé en shadow
- impact borné
- règles d'activation explicites
- possibilité de rollback immédiat
- monitoring séparé des performances avec et sans ajustement contextuel

---

## Ce qui fera réellement la différence

Un bon moteur européen ne viendra pas d'une seule idée.

La qualité viendra de la combinaison:

- données quantitatives robustes
- contexte de confrontation
- lecture du calendrier
- statut de l'effectif
- calibration propre par compétition
- discipline dans l'usage du LLM

Le point décisif est moins "ajouter un LLM" que "mieux représenter le contexte football réel".

---

## Recommandation finale

La priorité ne doit pas être d'activer tout de suite une couche intelligente supplémentaire, mais de construire un noyau spécialisé Europe crédible.

Ordre recommandé:

1. enrichir les signaux structurés
2. traiter explicitement l'aller/retour
3. spécialiser l'analyse par compétition UEFA
4. seulement ensuite tester un ajustement LLM borné

Cette approche garde EVCore défendable, lisible et évolutif, tout en ouvrant la voie à une vraie montée en gamme sur l'UCL, l'Europa League et la Conference League.

---

## Références externes utiles

- UEFA, suppression de la règle du but à l'extérieur:
  - https://www.uefa.com/news-media/news/026a-1298aeb73a7a-5b64cb68d920-1000--abolition-of-away-goals-rule-in-all-uefa-club-competitions/
- UEFA, rappel du fonctionnement post-réforme:
  - https://www.uefa.com/uefachampionsleague/news/0295-1cd662315a16-d45212883270-1000--away-goals-rule-why-uefa-scrapped-it-for-the-champions-lea/
- Effet du match retour à domicile sur les doubles confrontations:
  - https://academic.oup.com/jrsssa/article/181/4/1009/7072053
- Congestion du calendrier et performance:
  - https://link.springer.com/article/10.1007/s40279-020-01359-9
- Congestion du calendrier et blessures:
  - https://link.springer.com/article/10.1007/s40279-022-01799-5
- Valeur prédictive des cotes de bookmaker:
  - https://www.sciencedirect.com/science/article/pii/S0169207009001733
