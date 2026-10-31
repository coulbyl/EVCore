# ML v2 — une direction qui aide vraiment (proposition du 29/10/2026)

_**Décidé le 29/10** : les trois décisions du § 5 sont prises ; ROADMAP.md (Phase 3) et CLAUDE.md sont mis à jour. Suite de [ML-UTILITE.md](ML-UTILITE.md) : l'ombre ML ne battait pas le marché, et aucun modèle sur nos features ne le bat. L'utilisateur veut un ML utile. Ce document dit où la littérature situe un avantage, ce que nos propres données en disent (cinq mesures faites aujourd'hui, scripts dans `scripts/ml-utilite/`), et propose un programme. Tout est jugé contre le prix de Pinnacle au même instant, hors échantillon, avec intervalle._

## 0. En une page

**Ce qui est établi.** Le prix du marché est le meilleur estimateur qu'on connaisse, et **1xBet, le book de nos joueurs, le suit à 92 % en moins de 50 minutes**. Chez 1xBet, il n'y a ni ligne mal cotée exploitable (0,16 par match, rendement nul), ni retard sur les compositions (sauf un filet de 2 lignes par jour), ni meilleur moment pour jouer (la veille vaut l'heure d'avant). Les trois avenues documentées de la littérature sont fermées pour notre joueur. **Le ML ne nous fera pas battre 1xBet.**

**Ce qui est ouvert, et mesuré.** Une grille de score impliquée par le prix Pinnacle (λ domicile, λ extérieur, dépendance), ajustée match par match, est **calibrée à la quatrième décimale** sur 294 000 lignes de score exact, et meilleure que 1xBet lui-même sur chacun de ses marchés. Notre moteur est 0,02 de Brier derrière elle. Et 1xBet vend ses marchés dérivés avec des marges de 9 % à 21 % (mi-temps, HT/FT, double chance) là où il ne prend que 7 % sur le 1X2 : **le joueur paie le plus cher précisément là où personne ne lui dit la vraie probabilité**.

**La direction proposée : le ML au service du prix, pas contre lui.** Le moteur de probabilités devient la grille de marché quand un prix affûté existe (98 % de nos matchs), et le ML apprend **ce que le prix ne dit pas** : la mi-temps, les corners et cartons, la dépendance entre les buts, et la marge à retirer quand seul 1xBet cote. Chaque sous-modèle est validé contre les lignes Pinnacle correspondantes quand elles existent, et ne sort que s'il fait aussi bien que le prix. Le ML n'appelle plus rien à l'analyse : Python entraîne chaque semaine, exporte des paramètres JSON, et `analysis-core` les applique.

**Ce que ça apporte.** Les « 8 sur 10 » du produit deviennent exacts (DOMINANT annonce 0,64 et réalise 0,55 aujourd'hui), « Vérifie ton ticket » devient juste sur tous les marchés, les chasseurs mi-temps et corners ont un prix honnête, les abstentions se décident sur le prix, et l'audit « le moteur est derrière le marché » se referme. Ce n'est pas un avantage sur le book : c'est la fin de la sur-promesse, qui est le cœur de la marque.

**Ce qu'il me faut** : trois décisions (§ 5), rien d'autre. Les données sont là.

## 1. Ce que dit la littérature

| Avenue | Source | Ce qui est établi | Pour nous |
| --- | --- | --- | --- |
| **Acheter le prix mou avec le prix dur** | Kaunitz, Zhong, Kreiner (2017), _Beating the bookies with their own numbers_ ([arXiv 1710.02824](https://arxiv.org/abs/1710.02824)) | Cote juste déduite de la moyenne des books, pari chez le book qui paie au-dessus ; rentable en simulation sur 10 ans et en argent réel 5 mois, **puis les comptes sont limités**. Un commentateur résume : « les books qu'on peut battre refusent votre action » ([Sportshandle](https://sportshandle.com/sportsbooks-vs-academics-one-wins-battle/)). | Il faut plusieurs books et des comptes jetables. Nos joueurs ont 1xBet. Mesuré § 2.1 : rien chez 1xBet. |
| **Se décorréler du book** | Hubáček, Šourek, Železný (2019), _Exploiting sports-betting market using ML_, Int. J. Forecasting ([pdf](http://ida.felk.cvut.cz/zelezny/pubs/ijf.2019.pdf)) | Un modèle aussi précis que le book ne gagne rien ; un modèle **moins corrélé** au book, même moins précis, gagne un peu (NBA 2007–2014). | Demande un modèle qui sait quelque chose que le prix ignore. Nos features n'ont rien de tel (ML-UTILITE § 2). |
| **Le mouvement de ligne et les compositions** | Guides praticiens, aucune étude rigoureuse trouvée ([footymetrics](https://www.footymetrics.com/blog/how-to-use-football-lineup-data-for-betting), [squaringthenet](https://squaringthenet.org/latest/pre-match-odds-movement-and-what-it-actually-signals/)) | Les compositions (60–75 min avant) font bouger les lignes ; l'avance supposée est de « quelques minutes » chez les books lents. | Mesuré § 2.3 : Pinnacle bouge peu, 1xBet suit presque instantanément. API-Football publie les compositions 20 à 40 min avant ([doc](https://www.api-football.com/news/post/how-to-save-calls-to-the-api)), trop tard. |
| **Prédire le football avec des stats publiques** | Revue systématique ([arXiv 2410.21484](https://arxiv.org/pdf/2410.21484)) ; deux projets ouverts récents ([1](https://github.com/zakariae-boui/football-prediction-ml), [2](https://github.com/mperi1208/value-bet-model)) | Les modèles atteignent le plafond de précision du book et **ne battent jamais la clôture** ; quand un profit apparaît, il vient d'un écart de prix entre books, pas de la prédiction. | Même conclusion que notre partie 2. |
| **Inférer la grille de score depuis le prix** | Dixon & Coles (1997) ; outils ([penaltyblog](https://penaltyblog.readthedocs.io/en/latest/models/goal_expectancy.html), [ImpliedScore](https://impliedscore.com/dixon-coles-model/)) | Les λ se déduisent du 1X2 et du plus/moins 2,5 sans marge ; tous les marchés dérivés sortent de la même grille. | C'est la base de la direction proposée, mesurée § 2.2. |

## 2. Ce que disent nos données (29/10)

### 2.1 1xBet paie-t-il parfois plus que le juste ? Non.

Pour 2 442 matchs terminés (juillet → octobre), dernier prix 1xBet au moins 1 h avant, prix Pinnacle le plus proche, marge retirée par la méthode de Shin (la méthode proportionnelle gonfle les outsiders et fabrique de faux avantages : −23 % réalisé sur les mêmes lignes).

| Book | Lignes payées au-dessus du juste | Par match | Réalisé à mise fixe |
| --- | ---: | ---: | ---: |
| **1xBet** | 386 | 0,16 | **+0,002 [−0,14 ; +0,17]** |
| Bet365 | 437 | — | +0,035 [−0,12 ; +0,20] |
| Unibet | 569 | — | −0,090 [−0,22 ; +0,02] |
| Betano | 352 | — | −0,094 [−0,21 ; +0,04] |
| Tous les books mous | 2 188 | 0,34 | −0,039 [−0,12 ; +0,03] |

Les lignes à plus de 10 % d'avantage annoncé réalisent −41 %. L'avantage annoncé est, ici aussi, un détecteur de sur-estimation.

### 2.2 La grille de marché : exacte, et 1xBet ne la contredit presque jamais.

Pour chaque match, λ domicile, λ extérieur et ρ (Dixon-Coles) ajustés sur le 1X2, les lignes de plus/moins et les totaux d'équipe Pinnacle sans marge (8,5 cibles par match, erreur médiane 0,0005). Puis chaque pick 1xBet est pricé depuis la grille (150 lignes par match).

| Marché 1xBet | Brier grille | Brier 1xBet (1/cote) | Lignes au-dessus du juste par match | Réalisé |
| --- | ---: | ---: | ---: | ---: |
| 1X2 | 0,1938 | 0,1944 | 0,16 | +0,002 |
| Plus/moins | 0,1896 | 0,1918 | 0,10 | −0,032 |
| Total domicile | 0,1664 | 0,1682 | 0,06 | −0,101 |
| Total extérieur | 0,1746 | 0,1766 | 0,05 | −0,072 |
| Double chance | 0,1950 | 0,1978 | 0,01 | — |
| Les deux marquent | 0,2432 | 0,2447 | 0,00 | — |
| Score exact | 0,0077 | 0,0079 | 0,05 | bruit (cote 32) |

Calibration de la grille sur le score exact : tranche 1–3 % annoncée 0,0183, réalisée 0,0180 ; tranche 3–6 % : 0,0440 contre 0,0445. 1xBet annonce 0,0317 et 0,0686 sur les mêmes lignes. **La grille est un meilleur estimateur que 1xBet sur tous ses marchés, et 1xBet ne laisse rien au-dessus d'elle.**

### 2.3 La fenêtre des compositions : 1xBet suit Pinnacle en direct.

314 matchs depuis le 10/10 avec les quatre relevés (Pinnacle et 1xBet à T−60 et T−10, balayage de clôture toutes les 10 min).

- Pinnacle bouge peu entre T−60 et T−10 : écart médian 0,018 logit, plus de 0,10 sur 11 % des lignes.
- 1xBet suit : pente 0,92 (corrélation 0,80) sur le 1X2, 1,00 sur les gros mouvements ; 0,61 sur le plus/moins.
- Un pari 1xBet pris à T−60 vaut **−6,7 % contre la clôture** : exactement sa marge.
- Le seul filet : quand Pinnacle monte de plus de 0,10 logit (51 lignes en trois semaines), 1xBet monte de 0,153 au lieu de 0,177, soit +6 % de valeur à la clôture. Deux lignes par jour, tous championnats confondus, à prendre dans les minutes qui suivent. Pas un produit.

### 2.4 Quand jouer ? Ça ne change rien.

1 346 matchs : un pari 1xBet pris la veille (15–36 h) vaut −7,3 % contre la clôture ; pris à T−10, −7,2 %. Les favoris sont un peu mieux la veille (−3,6 % contre −4,6 %), les outsiders un peu mieux à la fin. La cote de la veille est meilleure sur 32 % des lignes, identique sur 33 %. **Aucun modèle de « quand » n'a de matière.**

### 2.5 Ce que le joueur paie, par marché (1xBet, marge médiane)

| Marché | 1xBet | Pinnacle |
| --- | ---: | ---: |
| 1X2 | 7,0 % | 4,0 % |
| Les deux marquent | 8,0 % | — |
| Totaux d'équipe | 8,7 % | 5,2 % |
| Plus/moins mi-temps | 8,9 % | 5,3 % |
| Vainqueur mi-temps | 10,1 % | 4,5 % |
| Plus/moins | 10,3 % | 4,4 % |
| Double chance | 14,3 % | — |
| Mi-temps / fin de match | 21,3 % | — |
| Score exact | 1xBet annonce 0,032 là où 0,018 se réalise | — |

**La marge grimpe exactement là où le joueur n'a pas de vraie probabilité sous les yeux.** C'est là que vaut une grille honnête.

## 3. La direction : le ML au service du prix

### 3.1 Le principe

Aujourd'hui le moteur estime λ depuis les statistiques (forme, xG, dom/ext), puis en déduit tous les marchés par Poisson. Il est à +0,02 de Brier du marché et sur-annonce. Demain, **quand un prix affûté existe (Pinnacle sur 64 % des matchs, Bet365 sinon : 98 % au total), λ et ρ viennent du prix**, pas des stats. Les stats ne servent plus qu'à expliquer (« PSG a gagné ses 9 derniers à domicile » reste un fait de la fiche) et à combler les 2 % sans prix.

Ce n'est pas abandonner le moteur : c'est lui donner la meilleure entrée qui existe. Et c'est honnête vis-à-vis du joueur : on ne prétend plus savoir mieux que le marché, on lui montre ce que le marché implique, sans la marge.

### 3.2 Ce que le ML apprend : quatre sous-modèles, chacun avec son juge

| Sous-modèle | Ce qu'il apprend | Données d'entraînement (en base) | Juge |
| --- | --- | --- | --- |
| **A. Mi-temps** | La distribution des buts de première période sachant (λ dom, λ ext, championnat). Donne le vainqueur mi-temps, le plus/moins mi-temps, le HT/FT. | 65 150 matchs terminés avec score à la mi-temps | Lignes Pinnacle `OVER_UNDER_HT` et `FIRST_HALF_WINNER` (≈ 2 400 matchs depuis septembre) : résidu contre Pinnacle, hors échantillon |
| **B. Corners et cartons** | La distribution des corners (et cartons) sachant (λ, championnat, style des équipes). Donne le Chasseur Corners un prix. | 47 419 matchs avec corners, 46 592 avec cartons | Lignes Pinnacle `CORNERS` (2 468 matchs) et `CARDS` (666) |
| **C. Retrait de marge appris** | Comment 1xBet (ou Bet365) répartit sa marge entre favori et outsider, par marché et championnat, pour lire un prix juste **quand Pinnacle ne cote pas** (championnats africains, divisions inférieures). La correction linéaire de Kaunitz, apprise sur nos résultats. | 47 000 matchs 2023–2026 avec 1X2 et résultat (sources PREMATCH + HISTORICAL) | Calibration réalisé/annoncé par tranche, hors échantillon, et résidu contre Pinnacle là où les deux existent |
| **D. Dépendance des buts** | ρ (et au besoin la sur-dispersion) par championnat, au lieu d'un ajustement par match sur des lignes bruitées. | Les mêmes 47 000 matchs | Brier sur score exact et BTTS contre la grille à ρ libre |

Tous sont des modèles **de petite taille** (quelques dizaines de paramètres par championnat) : une régression ou un gradient boosting sur quatre ou cinq variables, pas un réseau. Ils s'exportent en JSON.

### 3.3 Architecture : Python entraîne, TypeScript applique

- **`apps/ml-worker`** (gardé, recentré) : un job hebdomadaire par sous-modèle, qui lit la base, entraîne, **valide contre son juge**, et écrit une version dans `ml_model_version` avec ses paramètres **en JSON** (plus de `.pkl`). Une version ne s'active que si elle passe sa porte (§ 3.4) ; sinon elle reste en base avec son rapport.
- **`packages/analysis-core`** : un module `market-grid` (λ, ρ depuis les prix sans marge, grille, tous les marchés) et un module par sous-modèle qui lit les paramètres JSON actifs. **Aucun appel HTTP à l'analyse**, aucune dépendance Python à l'exécution : la passe du soir ne s'allonge pas, elle raccourcit (les 1 000 inférences par jour disparaissent).
- **`apps/backend`** : le moteur demande ses probabilités au `market-grid` quand un prix affûté existe, sinon au Poisson-stats actuel, et **écrit la source** dans `model_run.features.predictionSource` (déjà présent : `POISSON_MAIN` devient `MARKET_GRID` ou `POISSON_FALLBACK`). Les canaux, les chasseurs, les coupons et « Vérifie ton ticket » ne changent pas d'interface.
- **Le vantage-worker** ne change pas : il lit les mêmes décisions.

### 3.4 Les portes de validation (non négociables)

1. **Le juge est le résidu contre Pinnacle au même instant**, jamais le Brier absolu ni une métrique interne du worker (c'est ce qui a laissé des modèles faux paraître bons six semaines).
2. **Hors échantillon, par mois glissant**, avec intervalle à 95 % par bootstrap groupé par match.
3. **Un sous-modèle sort s'il fait aussi bien que Pinnacle** sur les lignes où Pinnacle cote (résidu dont l'intervalle contient zéro), et mieux que le Poisson-stats actuel. On ne lui demande pas de battre le prix : on lui demande de ne pas être pire là où on n'a pas de prix.
4. **Un seul modèle actif par sous-modèle et par championnat**, activé par la porte, jamais à la main ; rollback par `AdjustmentProposal` comme pour le reste.
5. **Volume** : pas d'activation par championnat sous 300 matchs réglés ; en dessous, le paramètre global.

### 3.5 Ce que ça change, concrètement

| Pour | Aujourd'hui | Avec la grille |
| --- | --- | --- |
| Le « 8 sur 10 » du Favori et du Combiné | DOMINANT annonce 0,64, réalise 0,55 (écart +0,038 au marché) | Annoncé = réalisé à ±0,01 ; l'écart disparaît par construction |
| « Vérifie ton ticket » | Fréquence du marché sur les marchés principaux, Poisson-stats ailleurs | Grille sur tout, mi-temps et corners compris : « 1 fois sur 9 » devient juste sur un ticket mixte |
| Les chasseurs mi-temps et corners | Poisson-stats, non validé contre un prix | Sous-modèles A et B, validés contre Pinnacle |
| Les abstentions | Règles de bande sur le prix 1xBet | Inchangées, mais la probabilité qui les accompagne est juste |
| Les championnats sans Pinnacle (2 %) | Poisson-stats | Sous-modèle C depuis le prix 1xBet, ou Poisson-stats signalé |
| L'audit « moteur derrière le marché » | Brier 0,639 contre 0,599 | Refermé pour 98 % des matchs ; le reste est mesuré à part |
| La passe du soir | ~2 h, 1 000 appels ml-worker | Plus courte, zéro appel |

## 4. Ce qu'on ne fera pas, et pourquoi

- **Chercher des lignes mal cotées chez 1xBet** : 0,16 par match, rendement nul (§ 2.1). Et tout ce qui dépasse 10 % d'avantage annoncé perd 41 %.
- **Jouer les compositions** : 1xBet suit Pinnacle à 0,92 en moins de 50 minutes, les compositions API-Football arrivent après (§ 2.3). Le balayage T−60/T−10 continue de tourner ; on relit le filet des gros mouvements le 10/12, pour la science, pas pour le produit.
- **Conseiller un moment pour jouer** : la veille vaut l'heure d'avant (§ 2.4).
- **Prédire le football avec des stats** : partie 2 de ML-UTILITE, et toute la littérature.
- **Un réseau de neurones, des embeddings d'équipes, un LLM qui pronostique** : rien dans les données ne le justifie, et le juge du § 3.4 les renverrait.

## 5. Plan et ce qu'il me faut

**Lot ML-1 — la grille** (une PR) : `market-grid` dans `analysis-core` (Shin, λ/ρ, tous les marchés), `predictionSource`, moteur branché avec repli, rejeu sur 2026 et rapport résidu contre Pinnacle par canal avant fusion. Rien à entraîner : c'est le § 2.2 industrialisé.

**Lot ML-2 — mi-temps et dépendance** (sous-modèles A et D) : jobs d'entraînement, export JSON, porte de validation, premier rapport.

**Lot ML-3 — corners et cartons** (sous-modèle B) : idem, et le Chasseur Corners passe dessus.

**Lot ML-4 — retrait de marge appris** (sous-modèle C) : pour les 2 % sans prix affûté et pour afficher « 1xBet prend X % » de façon juste par tranche de cote.

**Trois décisions — prises le 29/10 par l'utilisateur (« ok pour les 3 »)**

1. **La frontière de phase** : CLAUDE.md range le ML en phase 3. Ce programme n'est pas « XGBoost qui pronostique », c'est le prix comme entrée du moteur ; je propose de l'écrire ainsi dans ROADMAP.md.
2. **Le moteur-stats devient le repli**, pas la référence. C'est la décision la plus lourde : les canaux garderont leurs noms et leurs règles, mais leurs probabilités viendront du prix.
3. **Le ml-worker est recentré** (entraînement hebdomadaire, export JSON) et ne tourne plus à l'analyse : ça règle au passage `ML_CORRECTION` du lot config (constante `false`).

**Ce dont je n'ai pas besoin** : de nouvelles données, de clés, de quota. Tout est en base. Le premier rapport du lot ML-1 (résidu par canal après rejeu) est faisable sans toucher à la prod.

**Relecture** : le 10/12, avec six semaines de balayage de clôture, pour les sous-modèles A et D, et pour relire le filet du § 2.3.
