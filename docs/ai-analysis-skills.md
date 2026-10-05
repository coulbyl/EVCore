# AI skills pour l'analyse EVCore

## Périmètre

Ces skills guident les agents de développement et d'audit du dépôt. Ils ne
changent ni les probabilités ni la génération en production, et ne sont pas
injectés automatiquement dans EVA/VANTAGE. Une intégration au runtime demande
un chantier distinct avec contrat d'entrée/sortie, replay et évaluation.

Les fichiers canoniques vivent dans `.agents/skills/`; les liens relatifs
dans `.claude/skills/` rendent les mêmes instructions accessibles à Claude
Code, sans dupliquer les politiques. `AGENTS.md` indique leur routage.

| Skill                   | Utilisation                                                                                     | Exemple de demande                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `betting`               | Diagnostic déterministe hors ligne des cotes, de-vig, EV, Kelly, arbitrage, combiné indépendant | « Utilise betting pour contrôler l'EV de ces prix. »                                         |
| `evcore-forecast-audit` | Fraîcheur, calibration, edge, classement Top-N, replay chronologique                            | « Utilise evcore-forecast-audit pour comprendre la surévaluation des premiers picks. »       |
| `evcore-coupon-review`  | Pool, contrôles, probabilité jointe, LLM versus shadow déterministe, settlement                 | « Utilise evcore-coupon-review pour comparer les deux compositions sur les mêmes journées. » |

Les deux skills EVCore sont originaux et s'appuient sur les implémentations
existantes. Aucun coefficient ni seuil venant d'un autre projet n'est copié.
Ils couvrent collecte/qualité → probabilités/calibration → marché/EV →
classement → coupons → validation → revue après settlement.

## Recherche et décisions — 5 octobre 2026

Comparer les sources primaires et le code plutôt que les fiches de catalogues.
Une procédure intéressante ne constitue pas une preuve de gains hors échantillon.

| Source primaire examinée                                                                                    | Révision examinée                          | Décision et motif                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Machina sports-skills / betting](https://github.com/machina-sports/sports-skills)                          | `a56f7fbb81b1516cb8466911934d7eda79fdccc2` | Retenir le module de calcul autonome sous MIT. Fournir les fichiers exacts, licence, hashes et un wrapper JSON restreint. Aucun SDK complet, API, service premium ou trading.                                            |
| [Football-Skill / football-match-forecasting](https://github.com/Football-Skill/football-match-forecasting) | `0e509d58c3effe10a2955270d9264a003c063bef` | Ne pas redistribuer : aucun fichier de licence explicite trouvé dans ce checkout. Les coefficients Elo, affirmations de supériorité de l'ensemble et ajustements LLM nécessiteraient une validation EVCore indépendante. |
| [canyonqian / football-betting-skill](https://github.com/canyonqian/football-betting-skill)                 | `41bc5e701756ff255bf2ecd908a2a28ec1e1e41d` | Ne pas intégrer : aucun fichier de licence explicite trouvé ; collecte Sporttery/Flashscore et handicap trois issues à distinguer du handicap asiatique EVCore.                                                          |
| [coryeleven / sporttery-advisor-skill](https://github.com/coryeleven/sporttery-advisor-skill)               | `fa02a6698cf1a807f99d0a1353d42cfe291c6e89` | Ne pas intégrer : aucun fichier de licence explicite trouvé ; consigne de produire des décisions différentes selon le LLM, contraire à l'objectif de reproductibilité des audits.                                        |

Le `calibrated-forecasting` évoqué auparavant via un catalogue n'a pas été
retenu : aucune source primaire/licence suffisamment vérifiée dans cette
recherche. L'article financier cité dans la discussion précédente ne sert
pas de justification à cette PR et aucune amélioration chiffrée n'est revendiquée.

## Diagnostic Machina

Python 3.10+ et bibliothèque standard seulement, depuis la racine :

```bash
python3 .agents/skills/betting/scripts/calculate.py devig <<'JSON'
{"odds":[2.0,3.5,4.0],"format":"decimal"}
JSON
python3 .agents/skills/betting/scripts/calculate.py find_edge <<'JSON'
{"fair_prob":0.6,"market_prob":0.5}
JSON
```

Le second exemple vérifie une probabilité de 60 % à une cote décimale 2 :
EV = 20 %. Son edge renvoyé vaut 10 points contre la probabilité brute du
prix. L'edge EVCore contre le marché **de-vig** doit être calculé séparément.
Les calculs binaires ne modélisent pas les pushes ni les payouts partiels.

Les instructions d'origine et la référence API sont conservées pour
traçabilité. Seul `betting/SKILL.md` décrit la procédure adaptée. Le wrapper
limite les commandes, rejette les valeurs non finies, les cotes décimales
invalides et la correction de corrélation heuristique. Les sorties Kelly et
arbitrage sont théoriques. Le module externe reste un outil d'audit ; les
fonctions TypeScript partagées restent canoniques pour la production.

## Vérifier et mettre à jour

```bash
python3 scripts/validate-analysis-skills.py
pnpm lint
```

Le validateur contrôle frontmatter, liens Claude, ressources, hashes upstream
et comportements du diagnostic (EV, de-vig, arbitrage, combiné et entrées
invalides). Il ne prouve ni calibration ni rentabilité d'un modèle.

Pour une mise à jour upstream, examiner le diff du commit précis, conserver
les mentions MIT, mettre à jour les copies exactes et leurs SHA-256 dans
`betting/references/provenance.json`, puis rejouer la validation. Ne pas
installer une version flottante via `npx`/`pip` à l'exécution du skill.

Pour un audit chiffré, utiliser une base de développement déjà configurée ou
un export anonymisé : aucune donnée de production ni secret n'est requis
pour l'installation de ces skills. Documenter les données manquantes et ne
pas annoncer de résultat de backtest sans l'avoir exécuté.
