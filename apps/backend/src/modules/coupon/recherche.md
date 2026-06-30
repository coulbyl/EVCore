- GEMINI

Pour concevoir un module de génération de coupons (ou _accumulateurs_) performant, analytique et attractif pour les utilisateurs, l'approche purement "statistique" (comme se contenter de compiler les victoires des favoris) ne suffit pas. Les meilleurs algorithmes combinent **modélisation prédictive**, **recherche de valeur (Value Betting)** et **optimisation combinatoire**.

Voici les formules, algorithmes et techniques clés indispensables à intégrer dans le code de ton module :

---

## 1. Modéliser la Probabilité Brute (La Base)

Avant de regrouper des matchs dans un coupon, ton système doit estimer la probabilité précise de chaque issue ($1$, $X$, $2$, Over/Under, BTTS).

- **La Loi de Poisson (Goals Prediction) :** C'est l'incontournable pour le football. Elle permet de calculer la probabilité d'un score exact (ex: 2-1) en fonction de la force d'attaque de l'équipe A et de la force de défense de l'équipe B (calculées sur l'historique récent et le contexte Domicile/Extérieur).

$$P(X = k) = \frac{\lambda^k e^{-\lambda}}{k!}$$

_Où $\lambda$ est le nombre de buts attendus (xG ou moyenne historique ajustée) et $k$ le nombre de buts._

- **Modèles de Rating Dynamiques (Système Elo ou Glicko) :** Attribue un score de force à chaque équipe qui s'actualise après chaque match. Une victoire contre une équipe forte rapporte plus de points qu'une victoire contre un relégable. C'est idéal pour capter la "forme du moment".

---

## 2. Le Graal : Le Filtre Expected Value (EV)

Un bon coupon ne choisit pas juste les équipes "sûres", il choisit les erreurs de cotation des bookmakers. Pour chaque sélection potentielle, ton algorithme doit calculer l'**Expected Value (EV)**.

$$\text{EV} = (P \times K) - 1$$

- $P$ : Ta probabilité calculée par ton modèle (ex: 0.65 pour 65%).
- $K$ : La cote offerte par le bookmaker (ex: 1.65).
- **Règle d'or de l'algo :** N'autoriser l'entrée dans le générateur de coupon **que** si $\text{EV} > 0$. Si un favori a 80% de chances de gagner mais que sa cote est à 1.15, l'EV est négative ($0.80 \times 1.15 - 1 = -0.08$), l'algorithme doit l'exclure du coupon car à long terme, ce pari détruit du capital.

---

## 3. Algorithmes de Génération de Coupons (Le Moteur)

Une fois que ton système a une liste de 50 matchs "rentables" (EV > 0) pour le week-end, comment l'algorithme assemble-t-il le coupon parfait ?

- **La Programmation Linéaire / Optimisation Binaire :** Ne crée pas des coupons au hasard. Définis le problème comme une maximisation de la probabilité globale sous contrainte de cote totale ou de nombre de matchs.
- **Gestion de la Corrélation (Multi-marchés sur un match) :** Si ton utilisateur veut combiner "Victoire de l'Équipe A" et "Plus de 2.5 buts" **sur le même match**, tu ne peux pas simplement multiplier les cotes, car les événements sont dépendants. Ton algorithme doit bloquer les combinaisons corrélées non autorisées ou appliquer des matrices de probabilités jointes (modèle de Skellam ou Copules).
- **Contrôle du Risque Composé :** La probabilité finale d'un coupon est le produit des probabilités individuelles.

$$P_{\text{total}} = P_1 \times P_2 \times \dots \times P_n$$

Plus tu ajoutes de matchs, plus le _Favorite-Longshot Bias_ (la marge cumulative du bookmaker) te pénalise. Ton algorithme doit proposer des filtres de configuration à l'utilisateur :

- _Mode Safe :_ 2 à 3 matchs max (Cote totale entre 2.00 et 3.50).
- _Mode Fun / Funky :_ 5 matchs et plus, mais basé uniquement sur des "Double Chance" ou des "Over 1.5" pour maximiser la variance positive.

---

## 4. Stratégie d'Architecture Technique pour ton Module

Puisque tu es sur un workflow de développement moderne, voici comment structurer cela proprement :

1. **Ingestion des données :** Récupère les flux bruts (stats, blessés, cotes en temps réel via tes APIs de sport) et stocke-les ou mets-les en cache de manière ultra-performante.
2. **Calculateur asynchrone (Worker) :** Fais tourner tes scripts mathématiques en tâche de fond (Node.js/TypeScript ou Python si tu as des briques de Machine Learning comme XGBoost pour l'analyse textuelle/historique) pour mettre à jour les probabilités "maison" dès que les cotes ou les compositions d'équipes changent.
3. **L'API de génération (`/api/coupons/generate`) :** Elle doit accepter des paramètres d'entrée flexibles issus de ton UI :

```json
{
  "targetOdds": [2.0, 5.0],
  "riskLevel": "medium",
  "markets": ["1X2", "BTTS", "OVER_UNDER"],
  "maxMatches": 4
}
```

Ton algorithme pioche alors dans la base des matchs à EV positive de la journée, filtre selon les critères, et applique un tri par "Indice de Confiance" (le ratio entre ta probabilité et celle du bookmaker).

En combinant **Poisson + Filtre EV strict + Limitation du nombre de sélections (Max 3 à 5 par coupon)**, ton application ne proposera pas de simples pronostics au doigt mouillé, mais un outil d'ingénierie financière appliqué au sport.

Sur quel type de marché (1X2, Buts, Corners...) veux-tu que ton algorithme mette l'accent en priorité pour le lancement du module ?

- GOOGLE MODE AI

Pour générer des coupons (ou combinés) performants dans votre application d'analyse sportive, vous devez diviser votre module en deux grandes composantes : l'algorithme de prédiction de match (pour trouver des pronostics fiables) et la logique d'optimisation du coupon (pour maximiser la rentabilité en limitant le risque). [1, 2]
Voici les formules, algorithmes et techniques standards indispensables pour concevoir un tel module.

---

## 1. Prédire les scores et résultats : La Loi de Poisson (L'Incontournable)

La formule mathématique la plus utilisée pour modéliser le nombre de buts marqués au football est la Loi de Poisson. Elle part du principe que les buts sont des événements indépendants. [3, 4, 5]

## La Formule fondamentale

La probabilité P qu'une équipe marque exactement k buts dans un match, sachant que son espérance (moyenne) de buts est λ, s'exprime ainsi :
$$P(k; \lambda) = \frac{\lambda^k \cdot e^{-\lambda}}{k!}$$
[6]

## Comment calculer λ (Espérance de buts) ?

Pour un match opposant l'Équipe A (Domicile) et l'Équipe B (Extérieur), vous devez d'abord calculer la moyenne de buts globale de la ligue, puis la force d'attaque et de défense de chaque équipe sur la base de la saison en cours. [7, 8]

- $\lambda_{\text{Dom}}$ = Force Attaque Domicile (A) × Force Défense Extérieur (B) × Moyenne de buts marqués à domicile dans la ligue
- $\lambda_{\text{Ext}}$ = Force Attaque Extérieur (B) × Force Défense Domicile (A) × Moyenne de buts marqués à l'extérieur dans la ligue [9]

Une fois $\lambda_{\text{Dom}}$ et $\lambda_{\text{Ext}}$ obtenus, vous générez une matrice de scores exacts (de 0-0 à 5-5) en multipliant les probabilités indépendantes. En additionnant les cases de cette matrice, votre application obtiendra de manière fluide les probabilités pour le 1N2, les Over/Under 2.5, ou le Les deux équipes marquent. [10, 11, 12]
Note technique avancée : La loi de Poisson pure a tendance à sous-estimer les matchs nuls. Pour corriger cela dans votre code, vous pouvez appliquer l'extension mathématique appelée Modèle de Dixon-Coles. [13]

---

## 2. Évaluer la force des équipes : Le classement Elo dynamique

Au lieu de simples moyennes de buts qui varient peu, utilisez le système de classement Elo (le même qu'aux échecs) adapté au football. Il permet de recalculer la force théorique d'une équipe après chaque match en fonction du niveau de l'adversaire et du score. [14]
La formule de mise à jour des points Elo d'une équipe est la suivante :
$$R_{\text{new}} = R_{\text{old}} + K \times (G - W_e)$$
Où :

- K : Le facteur d'importance du match (ex: poids plus fort pour la Ligue des Champions que pour un match amical).
- G : Le résultat réel (1 pour une victoire, 0.5 pour un nul, 0 pour une défaite).
- $W_e$ : Le résultat attendu par l'algorithme avant le match, calculé selon l'écart initial de points entre les deux équipes. [15, 16]

---

## 3. Sélectionner les matchs : La technique du "+EV" (Expected Value)

Un coupon composé de "favoris" à des cotes de 1.20 finit souvent par perdre à cause d'une surprise. Votre algorithme de coupon doit chercher la Valeur Attendue Positive (+EV), c'est-à-dire les cas où le bookmaker sous-estime une équipe par rapport à vos calculs. [1, 2]

## Formule de la Valeur Attendue

$$EV = (P_{\text{app}} \times \text{Cote}) - 1$$

- $P_{\text{app}}$ : La probabilité calculée par votre application (ex: 0.60 pour 60%).
- Cote : La cote au format décimal proposée par le bookmaker (ex: 1.85).

## Règle d'or de votre algorithme : N'autorisez le module coupon à ajouter un match que si EV > 0. Si votre app estime qu'un événement a 60% de chances de se produire, la cote du bookmaker doit être strictement supérieure à 1 / 0.60 = 1.66. [1]

## 4. Structure de l'algorithme "Générateur de Coupon"

Pour coder le générateur automatique de votre application, vous devez implémenter un algorithme de filtrage et d'optimisation combinatoire. Voici les étapes algorithmiques recommandées : [17, 18]

## Étape 1 : Le filtrage par entrées utilisateurs

Laissez l'utilisateur choisir ses contraintes de base :

- Mise totale disponible.
- Plage de cotes globale du coupon (ex: entre 3.00 et 7.00).
- Nombre de matchs maximum (les experts conseillent de limiter à 2, 3 ou maximum 4 sélections par coupon pour limiter l'impact de la marge cumulative du bookmaker). [1]

## Étape 2 : Le scoring et tri des value bets [18]

Votre algorithme analyse tous les matchs des prochaines 48 heures. Il calcule l'indice EV de chaque option de pari (1N2, double chance, etc.). Les matchs sont triés par ordre décroissant de valeur (EV le plus élevé en premier). [18, 19]

## Étape 3 : L'algorithme du sac à dos (Knapsack Problem)

Pour assembler les matchs de manière à atteindre exactement la cote globale demandée par l'utilisateur tout en maximisant la fiabilité, utilisez une variante de l'algorithme du sac à dos.

- Le "poids" est le logarithme de la cote (car les cotes se multiplient : $\log(A \times B) = \log(A) + \log(B)$).
- La "valeur" à maximiser est la probabilité cumulative du coupon ou l'indice EV global.

---

## 5. Gestion des mises : Formule de Kelly pour les combinés

Si votre module propose aussi la mise idéale à placer sur le coupon généré, intégrez le Critère de Kelly. Elle calcule le pourcentage optimal du capital (bankroll) à engager. [2, 19, 20]
$$f^* = \frac{p \cdot (b - 1) - q}{b - 1}$$
[20]
Où :

- $f^*$ : Le pourcentage de la bankroll à miser.
- b : La cote totale du coupon combiné.
- p : La probabilité conjointe que tous les matchs du coupon passent (P₁ × P₂ × P₃).
- q : La probabilité de perdre le coupon (1 - p). [20]

## Astuce UX pour votre app : Le critère de Kelly pur est souvent agressif. Intégrez dans votre code un "Fractional Kelly" (généralement divisé par 4, soit le "Quarter-Kelly") pour protéger le capital de vos utilisateurs des séries de défaites.

Pour que votre module se démarque de la concurrence, si vous prévoyez d'utiliser des algorithmes de Machine Learning (comme XGBoost ou des réseaux de neurones), pensez à inclure en variables d'entrée l'indicateur xG (Expected Goals) ainsi que les tirs cadrés récents, qui sont statistiquement de bien meilleurs prédicteurs de performance future que le simple historique des scores bruts. [10, 21]
Si vous le souhaitez, nous pouvons nous pencher sur un aspect plus précis de votre projet. Indiquez-moi simplement :

- Quel langage de programmation vous utilisez pour le backend (Python, Node.js, etc.) ?
- Quel type de données vous possédez déjà en base (historique des scores simples ou statistiques avancées type tirs/xG) ?
- Si vous souhaitez que nous rédigions un exemple de script en Python pour générer la matrice Poisson.

[1] [https://www.youtube.com](https://www.youtube.com/watch?v=b0c--xDjslg)
[2] [https://valuebetfactory.com](https://valuebetfactory.com/betting-education/sports-betting-algorithms)
[3] [https://opisthokonta.net](https://opisthokonta.net/?p=276)
[4] [https://www.thepunterspage.com](https://www.thepunterspage.com/kickform/algorithm/)
[5] [https://github.com](https://github.com/Amar0302/FootballMatchPredictionPoisson)
[6] [https://artiebits.com](https://artiebits.com/blog/predicting-football-results-with-statistical-modelling/)
[7] [https://www.youtube.com](https://www.youtube.com/watch?v=P8n_i5t650o&t=741)
[8] [https://www.sbo.net](https://www.sbo.net/strategy/football-prediction-model-poisson-distribution/)
[9] [https://www.youtube.com](https://www.youtube.com/watch?v=vg5BxFCdYnE&t=213)
[10] [https://towardsdatascience.com](https://towardsdatascience.com/i-built-11-models-to-predict-the-2026-world-cup-they-crown-four-different-champions/)
[11] [https://www.youtube.com](https://www.youtube.com/watch?v=BJ7I76PlQJM&t=1)
[12] [https://caanberry.com](https://caanberry.com/poisson-distribution-to-predict-football-scores/)
[13] [https://www.quora.com](https://www.quora.com/What-formula-do-you-use-to-predict-outcomes-of-soccer-football-matches)
[14] [https://www.betburger.com](https://www.betburger.com/blog/the-best-algorithms-for-sports-betting)
[15] [https://www.mdpi.com](https://www.mdpi.com/2076-3417/14/16/7230)
[16] [https://blog.crea-troyes.fr](https://blog.crea-troyes.fr/6909/machine-learning-et-paris-sportifs-prediction-match-de-ligue-1/)
[17] [https://www.soccerwidow.com](https://www.soccerwidow.com/football-gambling/betting-knowledge/value-betting-academy/combinatorics-probability-betting-football/)
[18] [https://www.rowdie.co.uk](https://www.rowdie.co.uk/football-betting-strategy/)
[19] [https://www.sportbotai.com](https://www.sportbotai.com/blog/sports-betting-algorithms-explained-ai-football-predictions)
[20] [https://www.rowdie.co.uk](https://www.rowdie.co.uk/the-mathematics-behind-football-predictions-and-betting-picks-how-to-identify-value-bets/)
[21] [https://www.youtube.com](https://www.youtube.com/watch?v=CK7LyOODP6c)

-- CHAT GPT

Oui. Pour ton module **coupon**, la bonne approche n’est pas de générer un “top coupon” avec les matchs qui ont le plus gros score de confiance. C’est exactement là que beaucoup de modèles se trompent. Un bon coupon doit maximiser :

**probabilité réelle × cote totale − risque − incertitude du modèle**

Autrement dit : **value + calibration + contrôle du risque**, pas seulement “match safe”.

## 1. Base solide : prédire les scores, pas seulement le résultat

Pour le football, le socle classique reste un modèle de buts : **Poisson / Dixon-Coles / Skellam / xG-based model**.

Le modèle Dixon-Coles est important parce qu’il corrige un défaut du Poisson simple : les petits scores comme `0-0`, `1-0`, `0-1`, `1-1` sont mal capturés si on suppose une indépendance naïve entre les buts domicile et extérieur. Leur papier propose un modèle basé sur les forces offensives/défensives, l’avantage domicile et une correction de dépendance sur les petits scores.

Formule de base :

```txt
λ_home = exp(attack_home - defense_away + home_adv + context)
λ_away = exp(attack_away - defense_home + context)
```

Ensuite tu construis une matrice de scores :

```txt
P(score = i-j) = Poisson(i, λ_home) × Poisson(j, λ_away)
```

Puis tu déduis les marchés :

```txt
P(1)      = somme P(i-j) où i > j
P(X)      = somme P(i-j) où i = j
P(2)      = somme P(i-j) où i < j

P(Over 2.5) = somme P(i-j) où i + j >= 3
P(BTTS)     = somme P(i-j) où i > 0 et j > 0
P(1X)       = P(1) + P(X)
P(12)       = P(1) + P(2)
P(X2)       = P(X) + P(2)
```

Pour ton app, je recommande de générer les probabilités à partir d’une **matrice de scores**. C’est beaucoup plus puissant, parce qu’un seul moteur peut produire : 1X2, double chance, over/under, BTTS, score exact, team goals, DNB, handicap asiatique.

## 2. Ne compare jamais ton modèle à la cote brute

La cote bookmaker contient une marge. Tu dois convertir les cotes en probabilités “fair”.

Pour un marché 1X2 :

```txt
raw_home = 1 / odd_home
raw_draw = 1 / odd_draw
raw_away = 1 / odd_away

overround = raw_home + raw_draw + raw_away

p_market_home = raw_home / overround
p_market_draw = raw_draw / overround
p_market_away = raw_away / overround

bookmaker_margin = overround - 1
```

Exemple :

```txt
Home: 2.00 => 0.500
Draw: 3.40 => 0.294
Away: 4.00 => 0.250

overround = 1.044
margin = 4.4%

p_fair_home = 0.500 / 1.044 = 47.9%
```

C’est ce `p_fair_market` que tu compares à ta probabilité modèle. Des travaux récents rappellent aussi que l’overround sous-estime parfois les pertes réelles, surtout à cause du biais favori–outsider : les longshots peuvent avoir une marge effective plus mauvaise que ce que laisse penser la marge globale. ([econstor.eu][1])

## 3. La formule centrale : Expected Value

Pour chaque sélection :

```txt
EV = p_model × odd - 1
```

Exemple :

```txt
p_model = 0.58
odd = 1.95

EV = 0.58 × 1.95 - 1
EV = 0.131 = +13.1%
```

Donc la sélection est value si :

```txt
p_model > 1 / odd
```

Mais en production, ne fais pas seulement ça. Utilise une probabilité robuste :

```txt
p_robust = p_model_calibrated - uncertainty_penalty - freshness_penalty
EV_robust = p_robust × odd - 1
```

Tu ne prends la sélection que si :

```txt
EV_robust >= seuil
```

Je mettrais par défaut :

```txt
EV_robust >= 3% pour les marchés très liquides
EV_robust >= 5% à 8% pour les marchés secondaires
EV_robust >= 10%+ pour les cotes longues
```

## 4. Calibration : probablement le point le plus important

Ton problème actuel — “les tops ont un gros score mais ne rentrent pas” — vient souvent d’une mauvaise calibration. Un modèle peut être bon en ranking, mais mauvais en probabilité réelle.

Exemple : si ton modèle dit 70% sur 100 matchs, environ 70 doivent passer. S’il n’en passe que 55, ton modèle est surconfiant.

Un papier sur le betting sportif montre que pour le betting, choisir un modèle sur la **calibration** peut être plus pertinent que choisir sur la simple accuracy. ([arXiv][2])

Métriques à suivre :

```txt
Brier Score = moyenne((p - résultat)^2)

Log Loss = -log(probabilité donnée au vrai résultat)

Calibration par bins :
- groupe 50%-60%
- groupe 60%-70%
- groupe 70%-80%
```

Exemple de rapport :

```txt
Bin 60%-70%
Nombre de picks : 240
Probabilité moyenne prédite : 65%
Taux réel : 58%
Écart : -7%
=> modèle surconfiant sur cette zone
```

Dans ton moteur coupon, chaque sélection doit avoir un champ du genre :

```ts
calibrationPenalty: number;
confidenceReliability: 'GOOD' | 'OVERCONFIDENT' | 'UNSTABLE';
```

## 5. Utilise le marché comme un signal, pas comme un ennemi

Les cotes bookmaker sont souvent très fortes parce qu’elles agrègent énormément d’informations. Un papier récent sur la Bundesliga montre qu’un modèle simple basé sur les xG + Skellam + calibration isotonic peut trouver de la value, mais les probabilités implicites du marché restent souvent très bien calibrées. Le même papier obtient un ROI simulé autour de 10% avec les cotes moyennes, presque 15% avec les meilleures cotes, mais les performances varient selon les saisons et les types de paris. ([Sage Journals][3])

Donc je te recommande un modèle hybride :

```txt
p_final = blend(p_model, p_market_fair)
```

Version simple :

```txt
p_final = 0.65 × p_model_calibrated + 0.35 × p_market_fair
```

Version plus propre :

```txt
p_final = sigmoid(
  w_model × logit(p_model_calibrated)
  + w_market × logit(p_market_fair)
  + context_adjustments
)
```

Et tu ajustes `w_model` selon les backtests :

```txt
Si ton modèle bat le marché sur LogLoss/Brier => w_model augmente
Sinon => w_market augmente
```

Cette idée de calibration au marché est aussi utilisée dans des modèles football récents, notamment en in-play, où les paramètres sont calibrés aux prix Betfair avant d’intégrer les signaux live comme les tirs et le PSxG. ([arXiv][4])

## 6. Génération de coupon : formule propre

Pour un coupon avec plusieurs sélections supposées indépendantes :

```txt
P_coupon = p1 × p2 × p3 × ... × pn

Odd_coupon = odd1 × odd2 × odd3 × ... × oddn

EV_coupon = P_coupon × Odd_coupon - 1
```

Exemple :

```txt
Leg 1: p=0.72, odd=1.45
Leg 2: p=0.68, odd=1.55
Leg 3: p=0.63, odd=1.70

P_coupon = 0.72 × 0.68 × 0.63 = 30.8%
Odd_coupon = 1.45 × 1.55 × 1.70 = 3.82

EV_coupon = 0.308 × 3.82 - 1 = +17.6%
```

Mais attention : **l’indépendance est une hypothèse dangereuse**. Pour les sélections du même match, tu ne dois jamais faire `p1 × p2`. Les parlays/coupons corrélés sont un vrai sujet de recherche : certaines combinaisons ont une dépendance forte, par exemple favori qui gagne + over. ([ubplj.org][5])

Pour un même match, utilise ta matrice de scores :

```txt
P(Home win AND Over 2.5)
= somme P(i-j) où i > j ET i + j >= 3
```

Exemple :

```txt
P(PSG gagne) = 62%
P(Over 2.5) = 58%

Naïf :
0.62 × 0.58 = 35.9%

Correct :
somme des scores compatibles :
2-1, 3-0, 3-1, 4-0, 4-1, 4-2...
=> peut donner 44%, par exemple
```

Donc règle MVP :

```txt
Interdire plusieurs sélections du même match
OU
Autoriser seulement si jointProbability est calculé via score matrix
```

## 7. Staking : Fractional Kelly

Pour proposer une mise, utilise Kelly mais en version réduite.

Formule :

```txt
f* = (p × odd - 1) / (odd - 1)
```

Où :

```txt
f* = fraction de bankroll à miser
p = probabilité réelle estimée
odd = cote décimale
```

Puis tu réduis :

```txt
stake_fraction = 0.25 × f*
```

Et tu limites :

```txt
stake_fraction <= 1% à 3% de la bankroll
```

Kelly vient du papier de J. L. Kelly sur la croissance exponentielle du capital avec des probabilités et des odds favorables. En pratique, le full Kelly est agressif, donc le fractional Kelly est plus adapté à ton app. ([Princeton University][6])

Exemple :

```txt
p_coupon = 0.308
odd_coupon = 3.82

f* = (0.308 × 3.82 - 1) / (3.82 - 1)
f* = 0.0624 = 6.24%

Quarter Kelly = 1.56%

Bankroll = 50 000 FCFA
Mise recommandée = 780 FCFA
```

## 8. Score final d’un coupon

Je te propose ce scoring :

```txt
couponScore =
  35% valueScore
+ 25% hitProbabilityScore
+ 15% calibrationScore
+ 10% oddsQualityScore
+ 10% diversificationScore
+ 5% freshnessScore
- riskPenalty
```

Avec :

```txt
valueScore = normalize(EV_coupon)
hitProbabilityScore = normalize(P_coupon)
calibrationScore = moyenne fiabilité des legs
oddsQualityScore = faible marge bookmaker + bonne cote disponible
diversificationScore = pas trop de même ligue / même équipe / même marché
freshnessScore = cote récente + line movement favorable
riskPenalty = nombre de legs + corrélation + incertitude + longshots
```

Mais pour classer les coupons, je préfère une fonction plus mathématique :

```txt
ExpectedLogGrowth =
P_coupon × log(1 + stake × (Odd_coupon - 1))
+ (1 - P_coupon) × log(1 - stake)
```

Tu génères plusieurs coupons, puis tu tries par :

```txt
1. ExpectedLogGrowth
2. EV_robust
3. P_coupon
4. Drawdown risk
```

## 9. Contraintes pratiques à mettre dans EVCore

Je mettrais trois profils de coupons.

| Profil     |  Legs |  Cote totale | P_coupon minimum | EV minimum | Usage                 |
| ---------- | ----: | -----------: | ---------------: | ---------: | --------------------- |
| Safe       | 2 à 3 |  1.60 à 2.50 |             45%+ |        3%+ | utilisateurs prudents |
| Balanced   | 2 à 4 |  2.20 à 5.00 |             25%+ |        8%+ | meilleur compromis    |
| Aggressive | 3 à 5 | 4.00 à 12.00 |             10%+ |       15%+ | faible mise seulement |

Je limiterais fortement les coupons de plus de 5 matchs. Les accumulations longues donnent une illusion de gros gain, mais la probabilité de succès chute très vite. Les analyses récentes sur les parlays montrent justement qu’ils sont très profitables aux books parce que les utilisateurs sous-estiment la chute de probabilité quand on ajoute des legs. ([The Washington Post][7])

## 10. Algorithme concret pour ton module coupon

```txt
Input:
- matchs à venir
- cotes bookmakers
- probabilités modèle
- historique calibration
- bankroll utilisateur
- profil risque utilisateur

Étape 1: Générer toutes les sélections candidates
- 1X2
- double chance
- over/under
- BTTS
- DNB
- team over 0.5 / 1.5

Étape 2: Convertir les cotes en probabilités fair market
- enlever overround
- calculer marge bookmaker

Étape 3: Calibrer / ajuster p_model
- isotonic regression ou Platt scaling
- pénalité si marché historiquement mal calibré
- blend avec p_market_fair

Étape 4: Calculer EV robuste
- EV = p_final × odd - 1
- filtrer EV <= seuil
- filtrer cotes trop anciennes
- filtrer marchés instables

Étape 5: Générer combinaisons
- max 3 legs safe
- max 4 balanced
- max 5 aggressive
- éviter même match sauf joint probability
- éviter trop de même équipe/ligue

Étape 6: Calculer métriques coupon
- P_coupon
- Odd_coupon
- EV_coupon
- Kelly stake
- correlation risk
- expected log growth

Étape 7: Classer
- expected log growth
- EV robuste
- probabilité de hit
- stabilité historique

Output:
- coupon recommandé
- explication par leg
- probabilité réelle estimée
- cote totale
- EV
- mise recommandée
- niveau de risque
```

## 11. Pseudo-code TypeScript

```ts
type Candidate = {
  matchId: string;
  market: string;
  selection: string;
  odd: number;
  pModel: number;
  pMarketFair: number;
  pFinal: number;
  ev: number;
  calibrationPenalty: number;
  uncertaintyPenalty: number;
  riskTags: string[];
};

type Coupon = {
  legs: Candidate[];
  probability: number;
  totalOdd: number;
  ev: number;
  kellyFraction: number;
  expectedLogGrowth: number;
  score: number;
};

function impliedProbability(odd: number) {
  return 1 / odd;
}

function removeOverround(odds: number[]) {
  const raws = odds.map((o) => 1 / o);
  const overround = raws.reduce((a, b) => a + b, 0);

  return raws.map((p) => p / overround);
}

function expectedValue(p: number, odd: number) {
  return p * odd - 1;
}

function kellyFraction(p: number, odd: number) {
  const f = (p * odd - 1) / (odd - 1);
  return Math.max(0, f);
}

function fractionalKelly(p: number, odd: number, fraction = 0.25, cap = 0.02) {
  return Math.min(kellyFraction(p, odd) * fraction, cap);
}

function independentCouponMetrics(legs: Candidate[]): Coupon {
  const probability = legs.reduce((acc, leg) => acc * leg.pFinal, 1);
  const totalOdd = legs.reduce((acc, leg) => acc * leg.odd, 1);
  const ev = expectedValue(probability, totalOdd);
  const stake = fractionalKelly(probability, totalOdd);

  const expectedLogGrowth =
    probability * Math.log(1 + stake * (totalOdd - 1)) +
    (1 - probability) * Math.log(1 - stake);

  const riskPenalty =
    legs.length * 0.03 +
    legs.reduce(
      (sum, leg) => sum + leg.calibrationPenalty + leg.uncertaintyPenalty,
      0,
    );

  const score = expectedLogGrowth * 1000 + ev * 100 - riskPenalty * 100;

  return {
    legs,
    probability,
    totalOdd,
    ev,
    kellyFraction: stake,
    expectedLogGrowth,
    score,
  };
}
```

## 12. Ce que je mettrais en priorité dans ton MVP

Pour EVCore, je ferais ceci :

1. **Coupon Safe** : 2 ou 3 legs max, `P_coupon >= 45%`, `EV_robust > 3%`.
2. **Coupon Value** : 2 à 4 legs, `EV_robust > 8%`, `P_coupon >= 25%`.
3. **Coupon Solo Value** : parfois le meilleur pari est un single, pas un coupon.
4. **Blocage automatique** : pas de coupon si toutes les sélections sont juste “confiantes” mais sans value.
5. **Explication utilisateur** : “ce coupon n’est pas choisi parce qu’il est sûr, il est choisi parce que la cote semble supérieure à la probabilité estimée.”

La règle produit la plus importante :

```txt
Un bon coupon n’est pas celui qui a le plus de matchs.
Un bon coupon est celui qui conserve une EV positive après calibration, marge bookmaker, corrélation et incertitude.
```

La prochaine étape logique serait de transformer ça en **design technique du module coupon EVCore** : tables Prisma, services NestJS, jobs de génération, scoring, backtest et endpoint API.

[1]: https://www.econstor.eu/bitstream/10419/296678/1/WP23_04.pdf "Calculating the bookmaker's margin: Why bets lose more on average than you are warned"
[2]: https://arxiv.org/abs/2303.06021 '[2303.06021] Machine learning for sports betting: should model selection be based on accuracy or calibration?'
[3]: https://journals.sagepub.com/doi/10.1177/22150218261416681 'Can simple models predict football — and beat the odds? Lessons from the German Bundesliga - Sascha Wilkens, 2026 '
[4]: https://arxiv.org/abs/2605.16066 'A market-calibrated accelerated failure time model for in-play football forecasting'
[5]: https://www.ubplj.org/index.php/jpm/article/view/1562 '
		Correlated Parlay Betting: An Analysis of Betting Market Profitability Scenarios in College Football
							| The Journal of Prediction Markets
			'
[6]: https://www.princeton.edu/~wbialek/rome/refs/kelly_56.pdf 'kelly.tex typeset'
[7]: https://www.washingtonpost.com/sports/interactive/2025/parlay-popularity-odds-sportsbooks/?utm_source=chatgpt.com "Americans can't stop betting parlays. Sportsbooks are cashing in."
