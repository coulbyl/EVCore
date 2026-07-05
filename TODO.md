# EVCore — Reste à faire : Architecture des canaux de stratégie

> Référence : [docs/channel-strategy-architecture.md](docs/channel-strategy-architecture.md) · [ROADMAP.md](ROADMAP.md)
> Plan ML archivé : [docs/phase3-ml-todo.md](docs/phase3-ml-todo.md)
>
> **Principe directeur** : un canal = une **stratégie de sélection**, pas un marché.
> Aucun nouveau canal n'est activé sans backtest séparé par ligue/marché/saison.
>
> ⚠️ Ce fichier ne couvre que le chantier **canaux de stratégie / calibration
> modèle**. Le travail récent sur EVA (chat, persona pro, coupons pricés,
> filter bar) n'y est pas suivi.

## Statut

- `[ ]` À faire
- `[~]` En cours / observation
- `[-]` Abandonné / hors périmètre v1

---

## En cours (observation, pas encore staking-grade)

- **`[~]` BTTS NO** — activé en observation par ligue (`SA·BRA1·FRI @0.58`,
  `EL1·CH·EL2·LL @0.55`), jamais staké. Aucun edge cross-saison confirmé
  (P(NO) du modèle sans lift sur le taux de base). Re-run `/backtest/tuning`
  chaque saison ; promotion staking seulement si le signal se confirme sur
  données futures. Le vrai blocage = recalibration modèle par ligue.

- **`[~]` GOALS** (`OVER_UNDER`) — ligne **2.5** activée en observation
  (segments candidats, jamais staké). Verdict : pas d'edge cross-saison
  confirmé (ROI 2025-26 = artefact de saison, pas un vrai décalage de buts).
  - `[ ]` **[ETL]** Densifier les cotes `OVER_UNDER` 1.5/3.5/4.5 — prérequis
    dur avant d'activer ces lignes (aujourd'hui seule la 2.5 est cotée à ~100%).

- **`[~]` CORRECT_SCORE** — collecte forward démarrée (worker + canal + front
  livrés, observation-only). Reste : purge + rebuild une fois la collecte
  forward des cotes accumulée, pour voir des décisions peuplées en base.

- **`[~]` Lambda scale (λScale)** — correction appliquée sur 11 ligues
  (biais structurel de niveau de buts). Reste : re-mesurer
  `/backtest/calibration` après le prochain rebuild, étendre si d'autres
  biais stables apparaissent.

---

## À faire

- `[ ]` **`MARKET_MOVE`** — nouveau canal, à démarrer quand l'historique de
  cotes est assez dense.
- `[ ]` **`LIVE_VALUE`** — nouveau canal, pipeline live isolé des analyses J-/JT.
- `[ ]` **Ligues pauvres en données** (diagnostic 2026-07-01, doc
  [docs/data-poor-leagues-calibration.md](docs/data-poor-leagues-calibration.md)) :
  le modèle 1X2 est miscalibré uniquement sur les ligues pauvres en données
  (WCQ\*, UNL, ISL1, POL, LAT1, FRI, WC, NOR2, FIN1). Étape 1 : voir si on peut
  récupérer plus de données (xG international/petites ligues, historique plus
  long). Étape 2 : shrinkage proba→marché pondéré par la fiabilité des
  données (étendre `rebalanceThreeWayProbabilities` au-delà du 1X2).
- `[ ]` **ml-worker désynchronisé** (doc
  [docs/ml-worker-sync.md](docs/ml-worker-sync.md)) : la couche de correction
  ML Phase 3 (`apps/ml-worker` + `apps/backend/src/modules/ml`) est cassée
  depuis le refactor canaux — extract SQL en échec (`cs.channel` déplacé vers
  `channel_decision`), noms de canaux périmés (`EV`→VALUE, `CONF`→DOMINANT),
  codes ligue divergents (TS vs Python), modèle entraîné sur features
  pré-recalibration. Mode shadow → aucun impact money live, mais cron
  d'entraînement en échec depuis ~2 semaines. Chantier à traiter dans une
  nouvelle conversation, plan ordonné dans la doc.
- `[ ]` **[optionnel]** Exposer un backfill par fenêtre de dates, seulement si
  le rebuild par saisons via `ml-backfill` s'avère insuffisant.

---

## Checklist par nouveau canal (rappel méthode, doc §11)

hypothèse → `allowedMarkets` → critères `SELECTED` / codes de rejet → seuils
par ligue → implémentation → tests → **backtest séparé** → shadow/observation
→ activation par segment validé → settlement + métriques → API/front.
