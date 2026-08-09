# EVCore — Reste à faire : Architecture des canaux de stratégie

> Référence : [docs/channel-strategy-architecture.md](docs/channel-strategy-architecture.md) · [ROADMAP.md](ROADMAP.md)
> Plan ML archivé : [docs/phase3-ml-todo.md](docs/phase3-ml-todo.md)
>
> **Principe directeur** : un canal = une **stratégie de sélection**, pas un marché.
> Aucun nouveau canal n'est activé sans backtest séparé par ligue/marché/saison.
>
> ⚠️ Ce fichier couvre le chantier **canaux de stratégie / calibration
> modèle** ET, depuis le 2026-08-09, le **générateur de coupon** (section
> dédiée ci-dessous). Le travail EVA (chat, persona pro, filter bar) n'y est
> pas suivi.

## Statut

- `[ ]` À faire
- `[~]` En cours / observation
- `[-]` Abandonné / hors périmètre v1

---

## Générateur de coupon (chantier 2026-08-09, branche `feat/coupon-generator-intelligence`)

> Historique complet : Bloc 9 de [ROADMAP.md](ROADMAP.md). Rien ici n'est
> bloquant pour merger la branche — ce sont des suites, pas des prérequis.

- `[~]` **LONGSHOT_WEEKEND/MIDWEEK en observation** — généré en vrai chaque
  weekend/mardi-jeudi, badge "Expérimental" côté UI, jamais staké comme une
  recommandation validée.
  - `[ ]` Laisser accumuler quelques semaines de règlements réels avant
    d'envisager un backtest (`composeGreedy` n'avait jamais tourné en prod
    avant cette session — pas d'historique multi-jours à rejouer).
  - `[ ]` Écrire `db:backtest:coupon-longshot` une fois assez de coupons
    LONGSHOT réglés (WON/LOST/VOID/PARTIAL) — mesurer hit-rate réel du
    coupon complet vs cote, pas juste par jambe.
  - `[ ]` Ne retirer le badge "Expérimental" / n'activer au même niveau que
    le profil par défaut qu'après un backtest vert avec split train/valid.

- `[ ]` **Pondération des signaux leg-level dans `signalScore`** (A4, pas
  fait volontairement) — `priorAnalysisCount`, `offensiveBalance`,
  `shadowConflict` sont exposés dans `ScoredPick`/`featureSnapshot` mais
  n'influencent encore rien. `db:backtest:coupon-quality-signals` (2026-08-09)
  a montré `train n=0` sur ces champs — trop récemment enrichis dans
  `ModelRun.features` pour un vrai split. Relancer ce script dans 2-3
  semaines ; ne pondérer que si train ET valid confirment (même règle que
  partout ailleurs dans ce fichier).

- `[ ]` **FADE (pick inverse sur divergence extrême seule)** —
  `COUPON_ENFORCE_AVOID_FADE=false`, signal le mieux corroboré du backtest
  qualité (train +18%/valid +20%) mais n=15-17 à peine au-dessus du seuil
  minimal. Revalider avec plus de données avant d'activer.

- `[ ]` **DRAW — ligues supplémentaires non confirmées** — `FRI`, `KOR1`,
  `KOR2`, `CSL`, `BRA2`, `WC`, `CHN2` montrent un ROI agrégé positif (jusqu'à
  +41%) mais `train n=0` sur `db:backtest:channel-league-whitelist`
  (2026-08-09) — pas assez d'historique pour un split. Ne pas les ajouter à
  `DRAW_STAKED_LEAGUES` sur la base du seul agrégat ; relancer le script
  périodiquement.

- `[ ]` **Agrégats ROI/summary ignorent silencieusement `PARTIAL`/`VOID`** —
  `coupon-summary.service.ts`, `coupon-indices.service.ts` et deux requêtes
  de `coupon.repository.ts` filtrent uniquement `WON`/`LOST`. C'était sans
  conséquence tant que `PARTIAL` était du code mort (corrigé le 2026-08-09,
  cf. Bloc 9) — maintenant qu'il est atteignable (legs voidées sur fixture
  `POSTPONED`/`CANCELLED`), ces vues excluent silencieusement les coupons
  `PARTIAL`/`VOID` des stats au lieu de les compter explicitement (VOID :
  correct de l'exclure, mise remboursée ; PARTIAL : à trancher — probablement
  à inclure comme un gain partiel plutôt qu'à ignorer).

- `[ ]` **Calibration `k`/`decayHalfLifeDays`/`windowDays`** — mesurée
  (`db:backtest:signal-window-calibration`), gain réel mais marginal et pas
  appliqué (compromis réactivité vs stabilité, cf. Bloc 9). À reconsidérer
  seulement si ces valeurs semblent un jour concrètement mauvaises en usage,
  pas par optimisation pure du score de calibration.

---

## En cours (observation, pas encore staking-grade)

- **`[~]` Nouveaux marchés (DNB/TEAM_TOTAL/CLEAN_SHEET/WIN_TO_NIL/
  WIN_EITHER_HALF/RESULT_TOTAL_GOALS/RESULT_BTTS)** — wired dans VALUE/SAFE,
  3 canaux observation-only (`CLEAN_SHEET`, `TEAM_TOTAL`, `WIN_EITHER_HALF`)
  activés avec seuils dérivés structurellement. Backtest de calibration
  historique fait (`docs/new-markets-calibration-backtest.md`, script
  `packages/db/scripts/backtest-new-markets-calibration.ts`) — a révélé un
  biais HOME sous-estimé/AWAY sur-estimé, corrigé le 2026-07-19 (voir item
  homeAdvFactor ci-dessous). Reste : extension SAFE/VALUE bloquée tant que
  les cotes forward ne sont pas accumulées sur ces marchés
  (`docs/new-markets-safe-value-backtest.md`) — ne pas activer de pick
  `AWAY_*` sur ces marchés avant, le biais AWAY reste net-négatif même après
  recalibration (voir ci-dessous).

- **`[~]` homeAdvFactor/awayDisadvFactor recalibrés (2026-07-19)** —
  `ev.constants.ts` : 1.05/0.95 → 1.00/0.75, validé par grid-search Brier/ECE
  (46 679 fixtures) + split chronologique 70/30 anti-overfit + simulation ROI
  VALUE/ONE_X_TWO (+0.78pp). Reste à faire : les picks `AWAY` qui passent
  encore le seuil EV restent net-négatifs post-recalibration — relancer
  `backtest-home-advantage-roi-impact.ts` en y ajoutant le plancher d'edge
  VALUE existant (`getValueMinEdge`, edge≥0.10) pour voir si les deux gardes-
  fous sont redondants ou complémentaires, avant de considérer toucher au
  plancher d'edge.

- **`[ ]` H2HService v2** (doc [docs/h2h-service-v2-plan.md](docs/h2h-service-v2-plan.md)) —
  actuellement 100% shadow (jamais lu par la décision), limites identifiées
  (pas de seuil d'échantillon, pas de pondération récence). Valeur
  incrémentale confirmée empiriquement (`backtest-h2h-signal-value.ts` :
  r=0.05 brut → r=0.08 une fois corrigé, gradient monotone sur 5 buckets —
  vrai signal, pas du bruit). Prochaines étapes dans l'ordre :
  - `[ ]` v2.0 — réécrire `computeH2HScore` (seuil n≥3, decay=0.8, nul=0.5) +
    tests. Rester en shadow.
  - `[ ]` Backtest de gain de Brier sur le score composite complet avec H2H
    v2.0 intégré à un poids candidat, avant toute activation.
  - `[ ]` v2.1 (pondération domicile/extérieur ×3) — backtest de comparaison
    avant tout code définitif.
  - `[ ]` v2.2 (signaux H2H par marché : BTTS/Over 2.5/clean sheet/win-to-nil)
    — un backtest de valeur incrémentale par signal, activation marché par
    marché.
  - `[ ]` v2.3a (continuité entraîneur) — faisabilité API-Football vérifiée
    (`/coachs`, 1725 équipes ≈ 4 min à ingérer). Nouveau modèle Prisma
    `Coach`/`CoachTenure` + worker ETL + backtest avant activation.
  - `[-]` v2.3b (turnover effectif complet) — reporté, pas de point-in-time
    squad snapshot exploitable sans reconstruction lourde via `/transfers`.

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
