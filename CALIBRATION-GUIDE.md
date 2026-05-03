# EVCore - Workflow Backtest Ligue

## Objectif

Avoir une methode claire et reusable pour analyser une ligue, corriger sa calibration si necessaire, puis documenter les signaux a garder dans le produit.

Critere principal:

- verifier si la ligue est vraiment exploitable
- identifier les marches et segments rentables
- retirer ou durcir les branches qui detruisent le ROI

## Canaux disponibles

Le systeme produit trois canaux de prediction independants. Chaque canal a ses propres configs par ligue dans `prediction.constants.ts` et ne depend pas des autres.

| Canal | Marche    | Pick           | Fourchette de seuil | Ce qu'on mesure                               |
| ----- | --------- | -------------- | ------------------- | --------------------------------------------- |
| CONF  | ONE_X_TWO | HOME/DRAW/AWAY | 0.50 – 0.95         | Le resultat le plus probable depasse le seuil |
| DRAW  | ONE_X_TWO | DRAW           | 0.20 – 0.50         | La probabilite de nul depasse le seuil        |
| BTTS  | BTTS      | YES            | 0.50 – 0.75         | La probabilite BB depasse le seuil            |

Les canaux EV et Safe Value ne font pas partie de ce workflow — ils ont leur propre calibration dans `ev.constants.ts`.

## Workflow

1. Le backend de backtest tourne localement sur le port 3001.
2. Lancer le backtest de la ligue via `POST /backtest/{competitionCode}` via curl.
3. Recuperer et lire la reponse complete du backtest.
4. Extraire les metriques globales EV/SV :
   - nombre total de paris
   - gains / pertes
   - profit
   - ROI
   - performance par marche
5. Lire `apps/backend/logs/backtest-analysis.latest.ndjson` pour comprendre :
   - pourquoi des picks ont ete places
   - pourquoi d'autres ont ete rejetes
   - quelles directions et quelles fourchettes de cotes sont bonnes ou mauvaises
6. Isoler les branches toxiques :
   - marches negatifs
   - picks negatifs
   - buckets de cotes negatifs
   - segments a EV eleve mais resultats mauvais
7. Regarder le code du moteur pour trouver le bon levier :
   - seuil de probabilite
   - floor / cap de cote
   - EV floor
   - EV soft cap
   - seuil de qualite
   - desactivation d'un marche ou d'une direction
8. Appliquer une correction minimale et ciblee dans la configuration du moteur.
9. Relancer le backtest de la ligue apres patch.
10. Comparer avant / apres :

- ROI global
- volume de paris
- contribution par marche
- robustesse du signal restant

11. Si le backtest devient satisfaisant, ajouter ou ajuster les tests relies a la calibration retenue.
12. Si la ligue devient propre :

- garder les segments rentables
- laisser de cote les segments encore trop fragiles

13. Mettre a jour la documentation produit dans l'aide web :

- signaux a jouer
- signaux a eviter
- plages de cotes utiles
- avertissements sur les segments fragiles

## Calibration des canaux DRAW et BTTS

Ces etapes viennent en complément des etapes 3-12 ci-dessus.

### Ou lire les resultats

La reponse JSON du backtest contient un tableau `predictionBacktests` avec une entree par canal :

```json
"predictionBacktests": [
  {
    "channel": "CONF",
    "enabled": true,
    "threshold": 0.55,
    "hitRate": 0.62,
    "coverageRate": 0.18,
    "verdict": "PASS",
    "predicted": 34,
    "thresholds": [...],
    "recommendation": { "action": "KEEP", "threshold": 0.55, "reason": "..." }
  },
  {
    "channel": "DRAW",
    "enabled": false,
    "threshold": 0.99,
    "hitRate": 0,
    "coverageRate": 0,
    "verdict": "INSUFFICIENT_DATA",
    ...
  },
  {
    "channel": "BTTS",
    "enabled": false,
    "threshold": 0.99,
    ...
  }
]
```

Le champ `predictionBacktest` (sans `s`) ne contient que CONF — toujours utiliser `predictionBacktests[]` pour lire DRAW et BTTS.

### Lire le tableau `thresholds`

Chaque entree du tableau contient les resultats pour un seuil candidate :

```json
{
  "threshold": 0.34,
  "predicted": 18,
  "correct": 11,
  "hitRate": 0.61,
  "coverageRate": 0.12,
  "verdict": "PASS"
}
```

- `verdict: "PASS"` = hit rate >= 55% ET couverture >= 10% ET echantillon suffisant
- `verdict: "FAIL"` = hit rate sous le plancher a cet echantillon
- `verdict: "INSUFFICIENT_DATA"` = moins de `minSampleN` predictions qualifiees

### Criteres d'activation DRAW

- Seuil cible dans la fourchette `[0.20, 0.50]` — en dessous de 0.20, on capte presque tous les matchs
- Hit rate >= 55% sur >= `minSampleN` predictions (default 20)
- Couverture >= 10% des matchs analyses
- Preferer un seuil qui donne au moins 15 predictions sur la saison

### Criteres d'activation BTTS

- Seuil cible dans la fourchette `[0.50, 0.75]`
- Meme criteres hit rate / couverture que CONF
- Attention : BTTS > 0.65 reduit souvent trop la couverture sauf en ligues a fort volume offensif

### Lire la `recommendation`

La recommendation contient trois champs : `enabled`, `threshold`, `reason`.
Comparer avec la config courante pour savoir quoi faire :

| situation                                      | lecture                                           |
| ---------------------------------------------- | ------------------------------------------------- |
| `enabled:true` + `threshold` < config actuelle | Abaisser le seuil (hit rate fort, plus de volume) |
| `enabled:true` + `threshold` = config actuelle | Rien a changer, seuil valide                      |
| `enabled:true` + canal actuellement desactive  | Activer le canal au seuil suggere                 |
| `enabled:false` + canal actuellement desactive | Garder desactive, aucun seuil ne valide           |
| `enabled:false` + canal actuellement actif     | Desactiver (hit rate insuffisant partout)         |

### Appliquer la correction

Dans `prediction.constants.ts`, modifier uniquement l'entree du canal concerne pour la ligue :

```typescript
PL: {
  CONF: { enabled: true, threshold: 0.55, minSampleN: 10 },
  DRAW: { enabled: false, threshold: 0.34, minSampleN: 10 },  // ← modifier ici
  BTTS: { enabled: true, threshold: 0.55, minSampleN: 10 },
},
```

Ne pas toucher aux autres canaux de la meme ligue ni aux autres ligues.

## Regles pratiques

- Ne pas corriger une ligue avec un changement global si le probleme est localise a un marche ou a un pick.
- Preferer une calibration par `competitionCode|market|pick` quand un segment precis est en cause.
- Ne pas garder un marche juste parce qu'il est legerement positif sur un echantillon minuscule.
- Si un marche secondaire est bruite mais qu'un sous-segment est bon, essayer d'abord une fenetre stricte avant de le supprimer.
- Toujours revalider la ligue complete apres chaque changement.
- N'ecrire les tests qu'une fois la calibration jugee satisfaisante au backtest, pour eviter de les reecrire a chaque iteration.
- Les canaux DRAW et BTTS sont independants du canal CONF : les activer ou les desactiver ne change pas les picks EV/SV ni le canal CONF.

## Notes d'execution

- Utiliser `curl` pour declencher le backtest.
- Le fichier `apps/backend/logs/backtest-analysis.latest.ndjson` est la source principale pour le diagnostic fin des canaux EV/SV.
- Pour DRAW et BTTS, lire directement le champ `predictionBacktests[]` dans la reponse JSON.
- Les logs de saison emettent `prediction_conf`, `prediction_draw`, `prediction_btts` avec hitRate, coverageRate, verdict et threshold pour chaque canal.
- Si une reponse JSON temporaire est stockee localement, la supprimer une fois l'analyse terminee.
- Si le backtest ne reflete pas le patch, verifier que le backend a bien recharge le nouveau code.

## Contexte technique

- La base de donnees est accessible via Docker si une analyse plus poussee est necessaire.
- La logique de calibration EV/SV vit dans `ev.constants.ts`.
- La logique de calibration CONF/DRAW/BTTS vit dans `prediction.constants.ts`.
- La restitution utilisateur des signaux de ligue vit dans l'aide web.

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/evcore

on va traiter league après league
