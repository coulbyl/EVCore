# EVA — Recommandation analyste avec contexte d'évaluation complet

## Intention produit

Un parieur qui ouvre EVA ne vient pas chercher la liste brute des picks du moteur.
Il a déjà cette vue ailleurs dans le produit.

Il vient pour obtenir une **lecture analyste** :

- quels sont les meilleurs picks du jour ;
- quels sont les picks à éviter ;
- pourquoi un match ressort plus qu'un autre ;
- pourquoi certains marchés ont été retenus ou rejetés ;
- quels signaux rendent un pick plus solide ou plus fragile.

EVA ne doit donc pas se comporter comme une page "sélections" en conversation.
Sa valeur ajoutée est la **priorisation**, la **mise en contexte** et l'**explication**.

---

## Problème actuel

Aujourd'hui, quand un user demande :

- "qu'est-ce que je peux parier aujourd'hui ?"
- "donne-moi les meilleurs picks du soir"
- "quels matchs tu retiens ?"

EVA s'appuie surtout sur une sortie proche d'une **liste de picks acceptés**.

Exemple de vue trop plate :

```text
BTTS YES  — Mexico vs Cameroun  — prob 0.478 — cote 1.82 — EV +0.128
CONF HOME — Brazil vs Morocco   — prob 0.710 — cote 1.54 — EV +0.094
```

Cette vue est insuffisante pour un rôle d'analyste, car elle ne montre pas :

- les autres picks évalués sur la fixture ;
- les rejets utiles à l'interprétation ;
- la convergence éventuelle entre plusieurs canaux ;
- le contexte quantitatif du match ;
- les signaux secondaires qui renforcent ou fragilisent la lecture.

Résultat : EVA risque de ressembler à un simple relai des sélections, alors que le
user attend une recommandation argumentée.

---

## Ce qu'EVA doit voir pour être utile

Pour produire une vraie recommandation, EVA doit recevoir une vue complète par fixture :

- les lambdas du match ;
- les picks évalués, acceptés et rejetés ;
- la raison de rejet quand un pick n'est pas retenu ;
- les signaux shadow utiles à l'interprétation ;
- la possibilité d'identifier des convergences ou des contradictions entre canaux ;
- le niveau de complétude des données qui ont permis l'évaluation ;
- la distinction entre rejet moteur, absence d'évaluation et absence de run exploitable.

Exemple :

```text
Mexico vs Cameroun   λH=0.93  λA=1.22  λ_total=2.15
  ✓ BTTS YES       0.478  cote 1.82  EV +0.128
  ✗ NUL            0.248  rejeté → probabilité insuffisante
  ✗ OVER 2.5       0.552  rejeté → EV insuffisant

Brazil vs Morocco   λH=1.76  λA=1.67  λ_total=3.42
  ✓ BTTS YES       0.712  cote 1.65  EV +0.174
  ✓ CONF HOME      0.710  cote 1.54  EV +0.094
  ✗ OVER 3.5       0.446  rejeté → marché bloqué
  shadow : h2h_btts_rate=0.67, line_move=stable
```

Avec ce niveau d'information, EVA peut dire :

- Brazil vs Morocco est prioritaire car plusieurs signaux vont dans le même sens ;
- Mexico vs Cameroun propose un signal plus isolé, donc moins fort ;
- certains marchés doivent être évités non pas par intuition, mais parce qu'ils ont
  été évalués puis rejetés par le moteur ;
- un pick peut être bon sans être "le meilleur", si la convergence autour de lui est faible.

---

## Cas d'absence de recommandation

Le rapport d'audit montre qu'il faut distinguer plusieurs situations très différentes :

- **pick rejeté** : le moteur a évalué le marché mais l'a écarté pour une raison précise ;
- **aucun pick évalué** : le moteur a un run, mais n'a produit aucun marché exploitable ;
- **sans model run** : il n'existe pas d'analyse moteur exploitable pour la fixture ;
- **fallback de données** : l'analyse existe, mais elle est dégradée ou incomplète.

Ces cas ne doivent pas être résumés par un simple "rien à jouer".

EVA doit pouvoir dire, selon le cas :

- "le moteur a regardé ce match et a rejeté les marchés";
- "le moteur n'a retenu aucun marché exploitable";
- "le moteur n'avait pas d'analyse exploitable sur cette fixture";
- "l'analyse est trop incomplète pour soutenir une recommandation forte".

Autrement dit, l'abstention doit être **expliquée**, pas seulement constatée.

---

## Solution produit

Le chat EVA doit s'appuyer, pour les demandes de recommandation, sur un **outil
d'analyse orienté fixture**, et non sur une simple liste de picks.

Cet outil doit retourner, pour une date ou une période courte :

- les fixtures évaluées par le moteur ;
- leur contexte quantitatif ;
- les picks retenus ;
- les picks rejetés ;
- les raisons de rejet ;
- les signaux complémentaires utiles à l'analyse ;
- la source de l'analyse ;
- les éventuels fallbacks ;
- les indicateurs minimum de qualité/disponibilité des données.

Le but n'est pas d'exposer plus de données au user.
Le but est de donner à EVA assez de matière pour produire une réponse du type :

- "voici les 2 à 4 picks que je retiens" ;
- "voici les marchés que j'éviterais" ;
- "voilà pourquoi".

---

## Forme de réponse attendue côté outil

Exemple de structure :

```json
{
  "date": "2026-06-14",
  "asOf": "2026-06-14T18:34:00Z",
  "fixtures": [
    {
      "fixtureId": "uuid",
      "match": "Brazil vs Morocco",
      "kickoff": "2026-06-14T21:00:00Z",
      "competition": "WC",
      "status": "SCHEDULED",
      "analysisContext": {
        "predictionSource": "POISSON_MAIN",
        "fallbackReason": null,
        "dataQuality": {
          "marketOdds": true,
          "pinnacle": true,
          "eloHome": true,
          "eloAway": true
        }
      },
      "lambda": {
        "home": 1.755,
        "away": 1.666,
        "total": 3.421
      },
      "shadowSignals": {
        "h2hBttsRate": 0.67,
        "lineMovement": "stable",
        "congestion": false
      },
      "evaluatedPicks": [
        {
          "channel": "BTTS",
          "market": "BTTS",
          "pick": "YES",
          "probability": 0.712,
          "odds": 1.65,
          "ev": 0.174,
          "decision": "BET",
          "rejectionReason": null
        },
        {
          "channel": "CONF",
          "market": "ONE_X_TWO",
          "pick": "HOME",
          "probability": 0.71,
          "odds": 1.54,
          "ev": 0.094,
          "decision": "BET",
          "rejectionReason": null
        },
        {
          "channel": "EV",
          "market": "OVER_UNDER",
          "pick": "OVER_3_5",
          "probability": 0.446,
          "odds": 3.54,
          "ev": 0.579,
          "decision": "NO_BET",
          "rejectionReason": "market_blocked"
        }
      ]
    }
  ]
}
```

Le nom exact de l'outil est secondaire.
Ce qui compte, c'est son rôle : **fournir à EVA une vue d'analyste, pas une liste de catalogue**.

---

## Qualité et provenance de l'analyse

Le rapport d'audit montre qu'une recommandation n'a pas la même valeur selon le
contexte de production du signal.

L'outil doit donc idéalement remonter, pour chaque fixture :

- `predictionSource` ;
- un éventuel `fallbackReason` ;
- la présence ou non de données marché ;
- la présence ou non des entrées de rating nécessaires ;
- tout indicateur simple de complétude utile à l'analyste.

Exemples de signaux utiles :

- `marketOdds=true|false`
- `pinnacle=true|false`
- `eloHome=true|false`
- `eloAway=true|false`
- `fallbackReason=missing_market_odds`

EVA n'a pas besoin d'afficher ces drapeaux bruts à chaque réponse.
En revanche, elle doit pouvoir s'en servir pour nuancer son langage :

- recommandation solide ;
- recommandation prudente ;
- abstention par manque de matière exploitable.

---

## Ce que ça change pour EVA

### Avant

EVA voit surtout les picks retenus.
Elle peut les reformuler, mais elle analyse peu.

### Après

EVA voit le tableau complet d'évaluation par fixture.
Elle peut alors :

1. prioriser les matchs où plusieurs signaux convergent ;
2. éviter de pousser des picks isolés ou fragiles ;
3. signaler les marchés à éviter ;
4. expliquer un rejet sans inventer ;
5. contextualiser un pick avec les lambdas et les signaux shadow ;
6. différencier un "pick acceptable" d'un "pick prioritaire" ;
7. expliquer pourquoi elle s'abstient sur certains matchs ;
8. nuancer sa confiance selon la qualité des données disponibles.

Le comportement attendu n'est plus :

- "voici les picks disponibles"

mais :

- "voici ce que je retiens"
- "voici ce que j'éviterais"
- "voici pourquoi"

---

## Ce que ça ne change pas

- EVA ne génère jamais ses propres picks ;
- le moteur reste l'autorité finale ;
- les picks rejetés restent rejetés ;
- EVA n'invente ni cote, ni probabilité, ni justification ;
- les calculs dérivés restent dans les briques dédiées quand ils sont nécessaires.

---

## Règle d'expérience utilisateur

Le user n'a pas besoin de connaître les fonctions internes.

EVA ne doit jamais répondre avec une formulation du type :

- "je vais utiliser telle fonction"
- "j'appelle tel tool"
- "je vais lancer une recherche puis une explication"

Ces éléments relèvent de l'orchestration interne, pas de l'expérience utilisateur.

Dans la réponse finale, EVA parle uniquement :

- du moteur ;
- des matchs ;
- des picks ;
- des signaux ;
- des raisons qui justifient la recommandation.

Le user doit avoir l'impression de parler à une analyste, pas à une couche de routing technique.

---

## Règle de déduplication

Le contexte transmis à EVA ne doit pas contenir plusieurs fois le même pick pour une
même fixture, un même marché et un même choix.

Avant exposition au chat, il faut dédupliquer toute répétition technique du type :

- même fixture ;
- même canal ;
- même market ;
- même pick ;
- même probabilité / cote / EV.

Sinon EVA risque de lire une répétition accidentelle comme une convergence réelle.

Une convergence doit correspondre à **des signaux distincts**, pas à des doublons de sortie.

---

## Règle de posture EVA

Pour une demande comme :

- "quoi parier aujourd'hui ?"
- "quels sont les meilleurs picks de ce soir ?"
- "quels matchs tu retiens ?"

EVA doit :

1. identifier les 2 à 4 recommandations les plus solides ;
2. mentionner, si utile, les picks ou marchés à éviter ;
3. expliquer chaque recommandation en une phrase claire fondée sur les données ;
4. signaler quand un match a un seul signal faible ou trop peu de convergence ;
5. dire explicitement quand il n'y a pas de recommandation forte ;
6. expliquer l'absence de recommandation quand elle vient d'un rejet, d'un manque de données ou d'une absence de run.

EVA ne doit pas :

- dérouler une liste exhaustive ;
- paraphraser la page sélections ;
- exposer son outillage interne ;
- transformer un pick rejeté en suggestion implicite ;
- recommander par défaut s'il n'y a pas de signal assez propre ;
- confondre "pas de pick", "pas de données" et "pick rejeté".

---

## Sources de données

La matière existe déjà dans les données moteur :

- `model_run.features` pour les lambdas, picks évalués et signaux associés ;
- `bet` pour les picks effectivement retenus par le moteur ;
- `fixture` pour le contexte match, date, compétition et statut.

Le contexte EVA gagne aussi à exposer explicitement :

- la source de prédiction ;
- les drapeaux de complétude des données ;
- les raisons de fallback éventuelles ;
- l'état d'analyse : `BET`, `NO_BET`, `NO_EVALUATION`, `NO_MODEL_RUN`.

L'implémentation doit réutiliser les briques de parsing déjà partagées du backend
pour éviter toute duplication ou divergence d'interprétation.

Le script d'audit peut servir de référence produit ou de contrôle visuel, mais il ne
doit pas devenir la source de vérité de l'architecture chat.

---

## Impacts backend

### À ajouter

- un outil de lecture orienté recommandation avec contexte d'évaluation complet ;
- un contrat de sortie exploitable par EVA pour distinguer retenu, rejeté et à éviter ;
- un contrat qui distingue clairement rejet moteur, absence d'évaluation et absence de run ;
- des champs de qualité/provenance d'analyse pour nuancer la confiance ;
- une déduplication des picks identiques avant exposition au chat ;
- des tests golden qui vérifient la posture de recommandation et non une simple restitution.

### À ajuster dans le prompt EVA

Le prompt doit orienter EVA vers une réponse de synthèse analyste.

Exemple de règle :

```text
Quand le user demande quoi parier aujourd'hui, quels matchs retenir, ou les meilleurs picks du soir :
- récupère le contexte d'évaluation complet ;
- sélectionne 2 à 4 recommandations maximum ;
- mentionne les marchés à éviter s'ils éclairent la décision ;
- explique les choix avec les convergences, les rejets utiles et le contexte du match ;
- ne mentionne jamais les fonctions, outils ou étapes internes dans la réponse.
```

### Limite de taille

Pour ne pas saturer le contexte :

- filtrer les fixtures sans pick retenu et sans signal suffisamment pertinent ;
- limiter le volume à `CHAT_LIMITS.maxToolRows` fixtures par appel ;
- privilégier les fixtures où l'information aide réellement EVA à arbitrer.

---

## Positionnement par rapport à l'existant

### Ce qui reste utile

- un outil léger de liste brute peut rester pour des cas secondaires ou techniques ;
- une explication détaillée par fixture reste utile pour les deep-dives ;
- l'outil principal de recommandation doit devenir la voie normale pour les demandes
  analyste du quotidien.

### Ce qui doit changer

La demande "quoi jouer aujourd'hui ?" ne doit plus être traitée comme une simple
demande de récupération de picks.

C'est une demande de **recommandation éditorialisée par EVA**.

Autrement dit :

- la page sélections montre ce qui existe ;
- EVA dit ce qu'elle retient ;
- EVA dit aussi ce qu'elle écarte ;
- EVA explique pourquoi.
