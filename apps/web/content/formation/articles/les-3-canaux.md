---
title: "Les 5 canaux EVCore"
category: bases
difficulty: beginner
order: 1
readTime: 4
slug: les-3-canaux
summary: "Vue d'ensemble des 5 canaux du moteur : EV, Sécurité, Confiance, BB et NUL. Par où commencer et lequel suivre."
updatedAt: "2026-05-03"
related: ["canal-ev", "canal-sv", "canal-confiance", "canal-btts", "canal-draw"]
---

## Cinq angles, un seul moteur

EVCore analyse chaque match et produit cinq types de signaux indépendants. Chaque canal répond à une question différente.

**Canal EV** — Le moteur détecte quand une cote de bookmaker est supérieure à sa valeur réelle. Si la probabilité estimée dépasse la probabilité implicite de la cote, il y a une opportunité. C'est le canal principal du système, orienté rendement long terme.

**Canal Sécurité (SV)** — Même logique que l'EV, mais avec un filtre de probabilité plus strict. Seuls les signaux les plus robustes passent. Moins de picks, moins de variance, taux de réussite plus élevé.

**Canal Confiance (CONF)** — Le moteur prédit V1 ou V2 avec une probabilité estimée. Si tu fais confiance à cette probabilité, tu peux parier sur l'issue prédite. Une approche orientée résultat, distincte de la logique prix d'EV et SV.

**Canal BB (But-But)** — Le moteur prédit les matchs où les deux équipes vont marquer. Signal indépendant du résultat final — un match peut finir 1-0 ou 1-1, les deux valident le pick. Actif sur les ligues où le signal a été validé par backtest.

**Canal NUL** — Le moteur prédit les matchs nuls. Canal actuellement peu actif : le modèle Poisson ne discrimine pas bien les nuls, et le moteur préfère ne pas produire de signal plutôt qu'un signal peu fiable. Une amélioration du modèle est prévue.

## La différence clé entre les canaux

| Canal | Question                              | Besoin d'une cote ? |
| ----- | ------------------------------------- | ------------------- |
| EV    | Cette cote est-elle sous-évaluée ?    | Oui                 |
| SV    | Même chose, avec plus de certitude    | Oui                 |
| CONF  | Quelle issue est la plus probable ?   | Non                 |
| BB    | Les deux équipes vont-elles marquer ? | Non                 |
| NUL   | Ce match va-t-il finir nul ?          | Non                 |

Les canaux CONF, BB et NUL peuvent coexister sur le même match — un pick CONF V1 et un pick BB sur le même match sont deux signaux valides et indépendants.

## Ce que tu verras dans l'app

Tous les canaux apparaissent sur la page **Picks du jour**. Chaque pick affiche son badge de canal :

- `EV` / `SV` pour les canaux de valeur
- `Conf.` pour le Canal Confiance
- `BB` pour le Canal But-But
- `NUL` pour le Canal Nul

Dans la page **Matchs**, le filtre "Canal" te permet d'isoler chacun.

## Par où commencer

Avant de lire les articles détaillés, comprends d'abord comment fonctionne une cote et ce qu'est l'EV :

- Décoder une cote : `cotes-probabilites-implicites`
- Comprendre l'EV : `ev-probabilites-cotes`

Ensuite, chaque canal a son propre article : `canal-ev`, `canal-sv`, `canal-confiance`, `canal-btts`, `canal-draw`.
