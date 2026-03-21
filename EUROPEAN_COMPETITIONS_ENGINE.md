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

Les constats suivants ont été vérifiés pendant l'exploration du sujet:

### 1. Les odds utilisées sont bien des odds pre-match

Le flux principal exploité pour EVCore correspond à des snapshots pre-match.

Conséquence:

- il est cohérent de raisonner en logique "prematch"
- le produit ne fait pas aujourd'hui d'analyse live / in-play
- la qualité de la collecte dépend surtout de la disponibilité des cotes avant coup d'envoi

### 2. La Champions League n'a pas une profondeur historique exploitable uniforme

La couverture historique des odds sur la Champions League n'est pas homogène selon les saisons.

Le constat pratique retenu est:

- la saison 2025 est exploitable dans l'API pour les besoins actuels
- les saisons antérieures ne fournissent pas une base suffisamment régulière pour un usage simple et propre

Conséquence:

- la Champions League peut être activée en mode opérationnel courant
- elle ne doit pas être traitée comme une compétition historique mature pour le backtest

### 3. Les prochains matchs UCL disposent bien de cotes pre-match

Une vérification légère sur quota réduit a confirmé:

- présence de matchs UCL à venir dans l'API
- présence de cotes pre-match pour ces matchs
- présence de bookmakers prioritaires exploitables

Conséquence:

- l'alimentation opérationnelle de la compétition est réaliste
- la génération de coupons UCL est faisable dès lors que les autres prérequis analytiques sont réunis

### 4. Le blocage principal n'est pas la disponibilité brute des matchs

Le vrai sujet n'est pas "est-ce qu'il y a des matchs UCL dans l'API ?" mais plutôt:

- la qualité et la continuité des cotes historiques
- la profondeur de contexte disponible pour les équipes
- la pertinence du moteur sur des matchs à forte dimension tactique

Autrement dit:

- l'alimentation est suffisante pour opérer
- elle n'est pas encore suffisante, à elle seule, pour prétendre à une lecture experte des compétitions UEFA

### 5. Conséquence stratégique

Le bon positionnement est donc:

- activer UCL / Europa / Conference en exploitation lorsque la donnée courante est disponible
- rester prudent sur le backtest historique
- investir dans un moteur spécialisé Europe plutôt que supposer que la seule présence des odds suffit

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
