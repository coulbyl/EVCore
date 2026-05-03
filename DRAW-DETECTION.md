# Canal DRAW — Limitation structurelle du modèle Poisson

## Constat (2026-05-03)

Le canal DRAW est désactivé sur toutes les ligues testées à ce jour (PL, LL) non pas parce que les nuls sont rares, mais parce que le modèle Poisson est un mauvais discriminateur de nul.

## Pourquoi le modèle Poisson ne détecte pas les nuls

Le modèle calcule `P(buts domicile = buts extérieur)` sur deux distributions de Poisson indépendantes. Cette approche a deux défauts structurels :

**1. Plafond à ~0.32**
Pour des lambdas typiques (1.2–1.8 buts/équipe), la probabilité de nul ne dépasse jamais 0.32. Le scan ne trouve donc jamais de matchs "très probablement nul" — tout le monde est entre 0.20 et 0.30.

**2. Pas de pouvoir discriminant**
Quand le modèle dit 0.28 de probabilité de nul, le match finit en nul ~27% du temps — le même taux que la moyenne de la ligue. Monter le seuil ne sélectionne pas les vrais nuls, il réduit juste le volume.

### Données PL (3 saisons, ~950 matchs)

| Seuil | n   | Hit rate | Verdict           |
| ----- | --- | -------- | ----------------- |
| 0.20  | 863 | 24.7%    | FAIL              |
| 0.24  | 457 | 23.9%    | FAIL              |
| 0.26  | 70  | 22.9%    | FAIL              |
| 0.28  | 3   | 33.3%    | INSUFFICIENT_DATA |

Le hit rate **baisse** en montant le seuil — signal inverse d'un bon détecteur.

### Données LL (3 saisons, ~940 matchs)

| Seuil | n   | Hit rate | Verdict |
| ----- | --- | -------- | ------- |
| 0.20  | 863 | 27.0%    | FAIL    |
| 0.26  | 410 | 29.0%    | FAIL    |
| 0.28  | 152 | 27.0%    | FAIL    |
| 0.30  | 43  | 35.0%    | FAIL    |

Légèrement meilleur (LL a plus de nuls tactiques) mais toujours loin du seuil de validation à 55%.

## Ce que Poisson ignore

- Les nuls tactiques (équipe qui défend un résultat aller/retour)
- La sur-représentation empirique des scores 0-0 et 1-1 (Dixon-Coles 1997 corrige ça avec un paramètre ρ)
- Le style de jeu des équipes (certains duels ont un historique de nul systématique)
- Les cotes bookmaker, qui intègrent ces informations contextuelles

## Ligues où DRAW reste activé malgré tout

Certaines ligues ont un DRAW activé dans `prediction.constants.ts` (POR, MX1, UEL) avec des seuils très bas (0.34–0.36). Ces configs ont été posées avant ce diagnostic. À revalider au backtest pour confirmer si le signal tient ou si c'est du bruit sur petit échantillon.

## Pistes pour un vrai détecteur de nul (Phase 2+)

| Approche            | Description                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **Dixon-Coles ρ**   | Paramètre de correction qui sur-pondère 0-0 et 1-1 dans le calcul de probabilité         |
| **Cotes bookmaker** | Quand la cote de nul est < 3.20, le marché intègre un signal tactique que Poisson ignore |
| **H2H draw rate**   | Taux de nul historique pour un pairing d'équipes spécifique                              |
| **Form on draws**   | Certaines équipes ont un % de nul systématiquement supérieur à la moyenne                |

## Décision actuelle

Le canal DRAW reste désactivé par défaut (`enabled: false, threshold: 0.99`) jusqu'à ce qu'un meilleur signal soit intégré au modèle. Ne pas tenter de calibrer le seuil Poisson — c'est une perte de temps sur une feature structurellement limitée.
