# Force des championnats dans les coupes d'Europe

Rejeu du 2026-11-04 sur la base locale (copie de prod, derniers matchs européens terminés le 2026-10-22). Suite de [ESTIMATION-LOIN-DU-MARCHE.md](ESTIMATION-LOIN-DU-MARCHE.md). Script : `pnpm --filter @evcore/backtest-core backtest:league-strength`. Sortie complète : [force-championnats.txt](force-championnats.txt). Verdict : **expédié**.

## 1. Où se fait le mélange

En UCL, UEL et UECL, `analyzeFixture` (`betting-engine.service.ts`) mélange la ligne team_stats de la coupe avec la dernière ligne hors saison de la coupe, en pratique le championnat national ou une autre coupe. Le mélange passe par `blendTeamStats`, avec un poids xG de 0,6 pour cette ligne (`EUROPEAN_CROSS_COMP_XG_WEIGHT = 0.4` pour la coupe, `team-stats-resolution.ts`). Les xG mélangés entrent ensuite dans `deriveLambdas` (`match-stats.ts`) sans aucun terme qui dépende du championnat. Le rejeu point-in-time de Rennes – Olympiakos (UEL, analysé le 02/11 à 17:05) redonne **λ 1,151 / 1,551**, ce qui correspond au model_run (1,1506 / 1,5512). Les championnats lus sont L1 et GRE1.

## 2. Méthode (figée avant le rejeu)

- **Championnat national d'une équipe** : la compétition de sa dernière ligne team_stats avant l'instant d'analyse, en excluant les coupes d'Europe, les sélections et les amicaux. Dans la moitié des matchs, la ligne mélangée est elle-même une autre coupe, d'où cette règle plutôt que la ligne mélangée.
- **Modèle** : buts dom. ~ Poisson(λ0_dom · e^(r_D − r_E)), buts ext. ~ Poisson(λ0_ext · e^(r_E − r_D)). λ0 est le λ du moteur actuel, rejoué. On fait un ajustement Poisson pénalisé (σ a priori 0,2, au moins 10 matchs inter-championnats, sinon r = 0, facteur borné à 1,5). On n'estime qu'un seul paramètre par championnat, et rien n'est réglé sur la validation.
- **Correctif** : λ_dom × e^(r_D − r_E) et λ_ext × e^(r_E − r_D), appliqué dans `deriveLambdas` avant le H2H, le blend 1X2 et le shrinkage. Il ne s'applique qu'aux matchs européens.
- **Walk-forward** : pour chaque saison S, les forces sont ajustées sur les saisons antérieures à S seulement, puis figées. Décision à coup d'envoi − 1 h. La référence est la clôture Pinnacle 1X2 la plus proche du coup d'envoi (0 à 72 h), marge retirée proportionnellement. IC 95 % par bootstrap en blocs de jours.
- **Règle d'expédition** : meilleur sur au moins 2 saisons sur 3, IC agrégé du gain entièrement sous 0, et aucun type de match avec un IC de ΔBrier entièrement au-dessus de 0.

## 3. Résultats hors échantillon

3 295 matchs européens, 3 136 rejoués (les autres n'ont pas de team_stats), 1 564 évalués avec une clôture Pinnacle.

| Saison    | n     | Brier actuel / corrigé / Pinnacle | Résidu actuel → corrigé | ΔBrier [IC 95 %]             | Δlog-loss | Plafonnés   |
| --------- | ----- | --------------------------------- | ----------------------- | ---------------------------- | --------- | ----------- |
| 2024-25   | 535   | 0,6245 / 0,5983 / 0,5503          | 0,074 → 0,048           | −0,026 [−0,042 ; −0,009]     | −0,035    | 47 % → 34 % |
| 2025-26   | 500   | 0,6136 / 0,5770 / 0,5512          | 0,062 → 0,026           | −0,037 [−0,052 ; −0,021]     | −0,051    | 44 % → 24 % |
| 2026-27   | 529   | 0,6293 / 0,6016 / 0,5381          | 0,091 → 0,064           | −0,028 [−0,043 ; −0,012]     | −0,043    | 48 % → 37 % |
| **Total** | 1 564 | 0,6227 / 0,5926 / 0,5465          | **0,076 → 0,046**       | **−0,030 [−0,039 ; −0,021]** | −0,043    | 46 % → 32 % |

Le résidu est le Brier du moteur moins celui de Pinnacle. « Plafonnés » est la part des matchs dont au moins une issue 1X2 dépasse un plafond d'EV (0,90, ou le plafond souple européen) à la meilleure cote disponible. L'écart moyen |p − Pinnacle| passe de 0,117 à 0,087.

**Par type de match, toutes saisons confondues** (championnat national dom. / ext.) :

| Type                   | n   | ΔBrier [IC 95 %]         | Résidu actuel → corrigé | Plafonnés   |
| ---------------------- | --- | ------------------------ | ----------------------- | ----------- |
| Big-5 / autre          | 199 | −0,084 [−0,116 ; −0,051] | 0,120 → 0,037           | 78 % → 40 % |
| autre / Big-5          | 195 | −0,040 [−0,079 ; +0,002] | 0,076 → 0,037           | 47 % → 23 % |
| autre / autre          | 329 | −0,018 [−0,035 ; −0,002] | 0,060 → 0,041           | 44 % → 35 % |
| Big-5 / Big-5          | 225 | −0,007 [−0,018 ; +0,005] | 0,034 → 0,028           | 20 % → 16 % |
| un championnat inconnu | 616 | −0,025 [−0,037 ; −0,012] | 0,086 → 0,062           | 47 % → 35 % |

Aucun type ne se dégrade. Saison par saison, deux cases sont légèrement positives, toutes deux dans le bruit : « autre / autre » 2024-25 (+0,0006, IC [−0,025 ; +0,027]) et « Big-5 / Big-5 » 2026-27 (+0,0008, n = 24).

**Paris retenus** (issues 1X2 avec EV entre 0,08 et le plafond) : réalisé ÷ annoncé passe de 0,749 à 0,779 (n 1 080 → 1 132), et réalisé − Pinnacle de +0,007 ± 0,026 à +0,008 ± 0,026. En 2026-27 le ratio baisse (0,752 → 0,695, n = 352). **Pas d'avantage** : le correctif rapproche le moteur du prix, il ne le bat pas.

Rennes – Olympiakos, avec la carte de production : facteurs 1,235 / 0,810, λ 1,421 / 1,256, 1X2 0,322 / 0,224 / 0,454 → **0,424 / 0,229 / 0,347** (Pinnacle ≈ 0,43 / 0,27 / 0,31).

## 4. Ce qui est expédié

- `fitLeagueStrengths` et `crossLeagueLambdaFactors` (`analysis-core/src/probability/league-strength.ts`, fonctions pures testées) ; `LambdaConfig.crossLeagueFactors` dans `deriveLambdas`, à 1 / 1 par défaut.
- `LEAGUE_STRENGTH_MAP` (`league-strength-map.ts`) : la sortie du script ajustée sur les 3 136 matchs, recopiée telle quelle, de PL +0,58 à EST1 −0,36. Le 0 de référence correspond aux clubs sans ligne de championnat en base. **À ré-ajuster à chaque début de saison européenne**, avec le même script.
- Backend : `TeamLeagueRepository.findDomesticLeagueCode` et `buildLambdaConfig(code, leagues)`. Les facteurs ne sont appliqués qu'en coupe d'Europe et sont tracés dans `model_run.features.league_strength`. Un match de championnat ne change pas.

## 5. Limites

- Le moteur reste derrière le marché : il garde un résidu de +0,046 [0,033 ; 0,061], et 32 % des matchs européens ont encore une issue plafonnée (la mesure se fait par match, elle ne se compare pas directement aux 3,6 % par pari du national). Les plafonds `ev_above_*` et les plafonds souples UEL/UECL sont gardés tels quels. Les coupes ne sont pas exclues.
- Le blend 1X2 européen (UEL 0,20, UECL 0,35) lit toujours des taux de victoire nationaux aveugles au niveau. Ce n'est pas touché ici.
- Les team_stats sont « telles que recalculées », pas versionnées. Les cotes de 2023 à 2025 sont bornées par l'heure du bookmaker (`captureGuard: "snapshotAt"`), et un match sur deux de la fenêtre n'a pas de clôture Pinnacle.
- La carte de production inclut le début de la saison 2026-27. La validation, elle, n'a utilisé que les saisons antérieures.
