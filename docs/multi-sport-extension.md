# Extension multi-sport — cadrage

> Statut : note de cadrage stratégique, **non planifiée, non implémentée**.
>
> Objectif : poser les critères et l'architecture d'une extension d'EVCore
> au-delà du football, pour éviter d'ajouter des sports « pour avoir plus de
> sports ». Aucune décision d'activation ici — seulement le cadre de décision.

## 1. Principe directeur

On n'ajoute pas un sport parce qu'il existe. On ajoute un sport quand les quatre
conditions sont réunies **simultanément** :

1. les bookmakers y font encore des erreurs de pricing exploitables ;
2. les données historiques et live sont accessibles via un pipeline fiable ;
3. les marchés sont assez liquides pour absorber les mises sans bouger la cote ;
4. un modèle statistique peut réellement créer un avantage mesurable.

Un cinquième critère, propre à EVCore et souvent oublié : **le volume**. Toute la
mécanique de calibration et de risque du moteur exige du débit (minimum 50 paris
par marché pour ajuster un poids, suspension automatique à ROI < −15 % sur 50+
paris, corrélations shadow sur 50+ observations). Un sport à faible volume ne
peut pas nourrir la boucle d'apprentissage et est donc structurellement
incompatible avec le design, quel que soit son edge théorique.

## 2. Ce qui est réutilisable — et ce qui ne l'est pas

C'est la distinction la plus importante, et la plus contre-intuitive.

**Le cœur probabiliste d'EVCore est 100 % football** : Poisson bivarié, lambdas
domicile/extérieur, xG, dérivation BTTS / Over-Under / 1X2 depuis la grille de
scores. Rien de ce socle ne se transpose à un autre sport. Le tennis, par
exemple, se modélise en chaîne hiérarchique point → jeu → set → match
(probabilité de point au service/retour → formule fermée, ou Elo par surface),
sans aucun rapport avec une distribution de Poisson de buts.

**Conséquence : « ajouter un sport » n'est pas une config — c'est un second
socle probabiliste à écrire de zéro.**

En revanche, toute la **colonne vertébrale** est réutilisable et a justement
vocation à le devenir :

| Couche                                   | Réutilisable | Remarque                                  |
| ---------------------------------------- | ------------ | ----------------------------------------- |
| Socle probabiliste (Poisson, lambdas…)   | ❌            | Spécifique au sport — un socle par sport  |
| Marchés (`Market`, picks)                | ⚠️            | À abstraire — aujourd'hui football-shaped |
| ETL / ingestion / Zod                    | ✅            | Pattern réutilisable, sources distinctes  |
| `ModelRun` + grain d'exécution           | ✅            | Voir architecture des canaux              |
| Canaux / décision / sélection            | ✅            | Voir `channel-strategy-architecture.md`   |
| Settlement (analytique + financier)      | ✅            | Logique par marché à étendre              |
| Calibration + couche de correction ML    | ✅            | Réentraînée par sport                     |
| Discipline de risque (seuils, suspension)| ✅            | Identique, alimentée par le volume        |

L'architecture des canaux de stratégie
([channel-strategy-architecture.md](channel-strategy-architecture.md)) est, de
fait, **le précurseur du multi-sport** : elle sépare le socle commun des
stratégies qui l'interprètent. Le multi-sport ajoute un cran d'abstraction :
plusieurs **socles** (un par sport) derrière la même colonne stratégie/décision.
Cela suppose d'abstraire la notion de `sport` dans le schéma (le `Market` enum et
`ChannelSelection` sont aujourd'hui implicitement football).

## 3. Préconditions (non négociables)

L'extension multi-sport ne doit pas démarrer tant que ces deux conditions ne sont
pas remplies :

1. **L'edge football est prouvé.** Aujourd'hui le ML est toujours en *shadow
   mode* (jamais promu, voir Phase 3 / étape 7ter) et le canal `EV / ONE_X_TWO`
   présente un biais structurel de surestimation des top picks (edge affiché
   ≈ +19,6 %, ROI réel ≈ −54,9 % sur l'échantillon de référence ; seul
   `SV / OVER_UNDER` est sain à +5,2 %). Construire un second sport sur une base
   non porteuse, c'est bâtir le 2ᵉ étage avant que le 1ᵉʳ soit porteur.
2. **L'abstraction `sport` existe dans le schéma** (Market, ChannelSelection,
   socle pluggable), livrée à la suite du refactor des canaux.

Tant que (1) n'est pas atteint, l'effort multi-sport se limite à de la
**recherche/lecture**, pas à du code.

## 4. Classement des sports candidats (pour EVCore)

Classement pondéré par les critères §1, **volume inclus**.

**Disponibilité des données (critère §1.2).** Le basket est couvert par
**API-SPORTS**, la même famille de fournisseur qu'API-Football déjà intégré au
projet — l'ETL existant se réplique avec un minimum de friction. Le tennis n'est
pas dans cette offre : il faut passer par des datasets dédiés (jeux de données
ATP/WTA de Jeff Sackmann, cotes historiques de tennis-data.co.uk) ou un fournisseur
multi-sport (Sportradar, The Rundown pour l'historique de cotes). Donc, paradoxe à
assumer : le tennis a le **meilleur modèle** mais un **pipeline data à construire**,
là où le basket a un pipeline facile mais un **edge plus fin**.

### Tennis 🎾 — meilleur candidat

- volume quotidien énorme (nourrit la calibration), sport individuel (moins de
  variables cachées), historique riche ;
- **modèle propre et bien documenté** : littérature académique (Klaassen-Magnus,
  Barnett, modèles de Markov hiérarchiques) et Elo par surface établis → le moins
  « from scratch » malgré un socle distinct. Faits mesurés : la séparation
  service/retour améliore la précision de **20-30 %** ; le rating par surface pèse
  ≈ **44 %** du rating total ; 100 points d'Elo ≈ 64 % de probabilité de victoire ;
- marchés exploitables : vainqueur, totaux jeux, handicap jeux, 1ᵉʳ set ;
- features EVCore-style : Elo tennis, rating par surface (terre/dur/gazon), score
  de fatigue, head-to-head.

**Edge réel : modeste, pas spectaculaire.** Les marges moyennes sont ≈ 8 %
(comparable au football), plus serrées en Grand Chelem, plus larges sur les petits
tournois. La preuve académique d'edge existe mais reste mesurée (ROI ≈ +3,8 % d'un
modèle de Markov hiérarchique sur ATP 2011 ; approches Elo pondéré profitables sur
stratégies simples). Le tennis présente surtout un **favorite-longshot bias** marqué
(le taux de perte réel des parieurs y est ≈ 40 % au-dessus du prédit, contre ≈ 20 %
au football) : les books gagnent surtout sur les outsiders. **Directive de
modélisation : viser les favoris correctement pricés, fuir les longshots.**

**Piège méthodologique (déjà vécu sur EVCore).** Certains modèles ATP publics
affichent des ROI flatteurs (ex. +34,7 %) **uniquement à seuil d'edge élevé
(20 %)** — exactement le profil du biais `EV / ONE_X_TWO` du moteur football
(+19,6 % d'edge affiché → −54,9 % de ROI réel). Un backtest tennis à haut seuil
d'edge **surestimera** le ROI de la même manière. Tout prototype tennis doit être
jugé à edge réaliste et sur volume settlé, pas sur un seuil d'edge optimisé.

**Piège d'intégrité à cadrer dès le départ.** La faiblesse des books sur
ITF / Challenger reflète en partie le **bruit et les matchs arrangés** de ces
tiers, pas seulement du mispricing : sur une période de référence, **40 alertes sur
53** concernaient le bas du tableau (Challenger / ITF Futures), et l'ITIA continue
d'y concentrer ses enquêtes (2024). L'edge défendable est donc sur le **circuit
principal ATP/WTA** (totaux et handicaps jeux), pas dans le chaos des bas tiers.

### Basketball 🏀 — tiède

Bon volume (NBA, Euroleague, championnats européens), marchés moneyline /
handicap / total points. Inefficience documentée surtout sur les **totaux en début
de saison** (biais non entièrement corrigé entre ouverture et clôture) et via une
stratégie **closing-line value** (un edge de 2-5 % sur la clôture ≈ +15-25 % de ROI
annuel). Mais le marché est **de plus en plus efficient** : sur 10 000+ matchs, le
total points ressort comme un pari quasi équitable. Edge fin et qui se referme →
possible, pas prioritaire, et seulement avec un avantage data réel.

### Esports 🎮 — sous-estimé mais coûteux

Le « les books sont faibles » est daté (des books esports sharp existent
désormais) et la collecte de données structurées (odds historiques + stats) est
un véritable chantier d'ingénierie. À reconsidérer seulement si une source de
données fiable apparaît.

### Hors périmètre EVCore

- **MMA / UFC** : volume trop faible. L'edge « biais émotionnel » est réel mais le
  débit ne permet ni de prouver statistiquement un avantage ni de faire tourner la
  calibration (50+ paris). Incompatible avec la mécanique de risque. **Écarté.**
- **Tennis de table** : haute fréquence (Liga Pro / Setka), données variables et
  forte exposition aux matchs truqués. La **Setka Cup est littéralement un tournoi
  organisé par un bookmaker « primarily for betting purposes »** ; le New Jersey a
  suspendu les paris sur le table tennis ukrainien après alerte de fixing. Mauvais
  fit total avec une thèse « valeur disciplinée sur long horizon ». **Écarté.**
- **Baseball / Hockey / Rugby** : data complexe ou marché trop petit (contexte
  africain) pour le rapport effort/retour actuel.

## 5. Recommandation

1. **Maintenant** : ne pas ouvrir de sport. Finir le refactor des canaux, puis
   **promouvoir le ML hors shadow et corriger le biais top-picks**. C'est
   l'« ouverture » à plus forte valeur : elle transforme un moteur non prouvé en
   socle de confiance.
2. **Quand le football est porteur** : abstraire `sport` dans le schéma, puis
   prototyper le **tennis comme 2ᵉ socle** derrière la même colonne
   stratégie/décision. Vrai chantier d'architecture, pas une config.
3. **Cadrer l'edge tennis** sur le circuit principal (totaux / handicaps jeux),
   pas sur ITF / Challenger.
4. **Ne jamais lancer plusieurs sports en parallèle.** Un socle validé à la fois.

Ordre de priorité d'effort de développement, à terme :

1. Football ⚽ — continuer à améliorer (calibration, ML hors shadow) ;
2. Tennis 🎾 — 2ᵉ socle, après préconditions §3 ;
3. Basketball 🏀 — si le 2ᵉ socle valide le pattern multi-sport ;
4. Esports 🎮 — uniquement si une source de données fiable émerge.

## 6. Références

Sources consultées (juin 2026) ; les chiffres cités au §4 en sont issus.

- Marges & (in)efficience par sport, favorite-longshot bias, marges Grand Chelem :
  Whelan/UCD, « Calculating The Bookmaker's Margin »
  (<https://www.ucd.ie/economics/t4media/WP23_04.pdf>), « Estimating Expected Loss
  Rates » (<https://www.karlwhelan.com/Papers/Overround.pdf>).
- Modélisation tennis (Elo par surface, service/retour, Markov, ROI) :
  Harvard « Producing Win Probabilities… »
  (<https://dash.harvard.edu/bitstreams/dc501d43-9be0-4c8a-8066-480bd5ff5be5/download>),
  « Weighted Elo rating for tennis » (ScienceDirect,
  <https://www.sciencedirect.com/science/article/abs/pii/S0377221721003234>),
  ratings par surface (<https://sharp-9.com/building-player-ratings-elo-by-surface-and-recency-decay/>).
- Piège du ROI à haut seuil d'edge : ATP value-betting algorithm (+34,72 % ROI à
  edge 20 %) — <https://github.com/jacksonpc2024/ATP-Value-Betting-Algorithm>.
- Intégrité tennis bas tiers : ESPN/ITIA
  (<https://www.espn.com/tennis/story/_/id/29461093/tennis-officials-bracing-uptick-match-fixing-alerts-tours-resume>).
- Intégrité table tennis (Setka Cup, suspension NJ) : ESPN
  (<https://www.espn.com/chalk/story/_/id/29436278/new-jersey-suspends-betting-ukrainian-table-tennis-match-fixing-alert>).
- Efficience NBA / totaux / CLV : NBA early-season bias (ScienceDirect,
  <https://www.sciencedirect.com/science/article/abs/pii/S1544612307000177>),
  Unabated « NBA Betting: Path To Profitability »
  (<https://unabated.com/articles/nba-betting-path-to-profitability>).
- Données multi-sport : LSports « Best Sports Data APIs »
  (<https://www.lsports.eu/blog/best-sports-data-apis/>), API-SPORTS
  (<https://www.api-football.com/>).
