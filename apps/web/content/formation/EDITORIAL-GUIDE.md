# Guide éditorial — Formation EVCore

Objectif : produire des cours **simples, actionnables et cohérents** (articles + vidéos) en gardant un vocabulaire accessible, aligné avec `apps/web/content/glossaire-evcore.md`.

## 1) Règles de style (lisible pour tous)

- Une idée = une phrase courte.
- Éviter le jargon quand un mot simple existe.
- Si un terme est “tech”, l’expliquer immédiatement (entre parenthèses) puis l’utiliser de façon constante.
- Prioriser l’exemple concret (1 match, 1 cote, 1 calcul).
- Toujours finir par une mini-checklist “À retenir”.

## 2) Structure recommandée d’un cours

### 2.1 Template “article”

1. **Titre** (bénéfice clair)
2. **Pourquoi c’est important** (2–3 lignes)
3. **Définitions clés** (3–6 termes max, niveau débutant)
4. **Exemple guidé** (avec chiffres)
5. **Erreurs fréquentes** (3 points)
6. **Checklist** (5 bullets max)
7. **Pour aller plus loin** (liens “related” vers 1–3 contenus)

### 2.2 Template “vidéo”

- Intro 10s : promesse + ce que l’utilisateur va savoir faire.
- Partie 1 : définitions (ultra-courtes).
- Partie 2 : démonstration dans l’app (1 scénario).
- Outro : recap + next content.

## 3) Vocabulaire “niveau débutant” (canon)

Ces définitions sont volontairement **non académiques** : elles sont pensées pour aider quelqu’un à _prendre une bonne décision_.

### `odds` (cote)

La cote = “combien je récupère si je gagne”.

- `2.00` : si je mise 10, je récupère 20 (gain net = 10).

### `implied probability` (probabilité implicite)

La probabilité “cachée” dans la cote.

- Formule : `P = 1 / cote`
- Exemple : `2.50 → 1 / 2.50 = 0.40 (40%)`

### `EV` (Expected Value)

L’EV = “est-ce que, sur le long terme, ce pari vaut le coup ?”

- Formule EVCore : `EV = (P_estimée × cote) - 1`
- Interprétation :
  - `EV > 0` : théoriquement rentable
  - `EV < 0` : théoriquement perdant

### `de-vig` (retirer la marge)

Les bookmakers ajoutent une marge. “De-vig” = enlever cette marge pour obtenir une probabilité plus propre.

### `market` (marché)

Le type de pari (`1N2`, `Over/Under`, `BTTS`, etc.). Un marché = une question.

Exemple : “Combien de buts au total ?” → `OVER_UNDER`.

### `model`

Le “moteur” qui transforme des données en probabilités.

### `feature`

Une information utilisée par le modèle (forme récente, xG, etc.).

### `calibration` (calibration)

Si le modèle dit souvent “60%”, alors l’événement doit arriver environ 6 fois sur 10.

## 4) Règles “pédagogie”

- Limiter à **1 nouveau concept** par section.
- Toujours répondre à : “_Qu’est-ce que je fais concrètement dans l’app ?_”
- Éviter les grandes théories : préférer “Si tu vois X, alors Y”.
- Toujours préciser le **risque** et les **conditions** (quand ne pas jouer).

## 5) Organisation conseillée des cours (P8)

### Les bases (fondations)

- EV : probabilités, cotes, EV, erreurs classiques
- Les canaux EVCore (EV / Sécurité / Confiance / NUL / BB) et quand utiliser chacun
- Lire un pick : où regarder en premier, comment décider en 30 secondes

### Bankroll & discipline (survie long terme)

- Unités, variance, drawdown
- Pourquoi “bon pick” ≠ résultat immédiat

### Guide par ligue (application)

- 1 page par ligue : signaux principaux, rares, à éviter, volume recommandé

## 6) Check de cohérence avant publication

- Frontmatter OK : `title`, `category`, `difficulty`, `readTime`, `slug`, `summary`, `updatedAt`.
- 1–3 `related` pertinents.
- Les termes techniques sont soit expliqués, soit présents dans le glossaire.
- Le cours améliore une action concrète : “mieux lire”, “mieux filtrer”, “mieux gérer le risque”.
