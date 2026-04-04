# EVCore — TODO

Pour un modèle de Poisson basé sur les xG comme le vôtre, certains championnats sont naturellement plus "bénéfiques" car ils présentent une plus grande régularité statistique ou des inefficacités de marché que votre "sniper" peut exploiter.
D'après les analyses de performance et les caractéristiques des ligues en 2024-2025, voici les championnats à intégrer en priorité :

## 1. Eredivisie (Pays-Bas) 🇳🇱 — Le paradis du xG

C’est historiquement la ligue la plus compatible avec les modèles de Poisson.

- Pourquoi : C'est un championnat très offensif avec un volume élevé d'occasions franches (xG élevé par match).
- Bénéfice : Les modèles basés sur les buts (Over 2.5) y sont très performants car les défenses sont souvent moins expérimentées, ce qui rend les scores plus "mécaniques" et prédictibles par la loi de Poisson. [1, 2]

## 2. 2. Bundesliga (Allemagne) 🇩🇪 — Volume et Profit

Moins médiatisée que la BL1, la deuxième division allemande est une mine d'or pour le value betting.

- Pourquoi : Elle combine une haute compétitivité avec une moyenne de buts très élevée (+2.5 buts en moyenne).
- Bénéfice : Le marché est moins "efficient" que la PL ou la BL1, ce qui signifie que les cotes des bookmakers s'ajustent plus lentement aux pics de xG de certaines équipes. [1, 3]

## 3. J1 League (Japon) 🇯🇵 — Fiabilité Statistique

Un championnat souvent négligé mais très structuré. [1]

- Pourquoi : Les équipes comme Sanfrecce Hiroshima ou Cerezo Osaka affichent des xG très stables (autour de 1.5-1.7 xG/match).
- Bénéfice : Les données y sont de haute qualité, et le style de jeu discipliné réduit les anomalies de variance sauvage que vous avez rencontrées en Bundesliga 1. [4, 5, 6, 7]

## 4. Liga MX (Mexique) 🇲🇽 — Exploitation de la Variance

- Pourquoi : C’est une ligue avec une forte disparité entre les attaques et les défenses (ex: Toluca avec 41 buts marqués pour 22 encaissés).
- Bénéfice : Votre filtre sur les lambdas et les seuils de probabilité directionnelle y trouverait de nombreuses sélections "Under" ou "Dog" à forte valeur, car le public sur-miseen souvent sur les favoris connus (Club América, Cruz Azul). [8]

## 5. Liga Portugal 🇵🇹 — La Domination des Favoris

- Pourquoi : La hiérarchie est très marquée (Benfica, Sporting, Porto).
- Bénéfice : Semblable à la Liga espagnole où vous avez déjà un bon ROI, le marché des favoris y est "propre". Votre seuil adaptatif à 1.80 pourrait y débloquer beaucoup de volume rentable sur les victoires à domicile. [9]

Conseil pour votre moteur :
Si vous intégrez l'Eredivisie, gardez un $\alpha$ de 0.70 mais abaissez peut-être le MIN_PROBABILITY_DIRECTIONAL à 0.42, car le volume d'occasions est tel qu'un avantage xG y est plus significatif qu'ailleurs.
Voulez-vous que je vérifie les moyennes de xG actuelles pour l'une de ces ligues afin d'ajuster vos constantes ?

[1] [https://www.onlinebettingacademy.com](https://www.onlinebettingacademy.com/blog/2025/11/best-football-leagues)
[2] [https://www.performanceodds.com](https://www.performanceodds.com/eredivisie/)
[3] [https://www.performanceodds.com](https://www.performanceodds.com/how-to-guides/expected-goals-deep-dive-how-xg-can-predict-your-next-winning-bet/)
[4] [https://www.jleague.co](https://www.jleague.co/stats/clubs/j1/2025/expected_goals_pg/)
[5] [https://makeyourstats.com](https://makeyourstats.com/football/league/japan/j-league/968/stats/xg)
[6] [https://technart2023.com](https://technart2023.com/using-xg-metrics-to-predict-future-match-outcomes/)
[7] [https://www.formationsfootball.fr](https://www.formationsfootball.fr/blog/xg-foot#:~:text=*%20Data.%20*%20Expected%20Goals%20%28xG%29%20:%20Tout%20savoir%20sur%20cet%20indicateur.)
[8] [https://support.google.com](https://support.google.com/knowledgepanel/answer/9787176)
[9] [https://www.soccerway.com](https://www.soccerway.com/portugal/liga-portugal/)
