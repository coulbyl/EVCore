# Maintenance du contenu Formation — d'où viennent les chiffres, comment les rafraîchir

> Ce document répond à une seule question, à chaque fois qu'un chiffre de backtest est cité
> dans une leçon ou un script Formation (`apps/web/content/formation/`) ou dans
> [business-model.md](./business-model.md) : **d'où vient ce chiffre, et comment le
> revérifier ?** Écrit après un audit complet le 2026-07-18 qui a confirmé la plupart des
> chiffres cités, mais trouvé des chiffres datés de ~10 jours pour DOMINANT/BTTS/GOALS et un
> vrai piège méthodologique (rejeux `ModelRun`) — détail en §3.

---

## 1. Règle générale

**Aucun chiffre de backtest ne doit être écrit à la main dans une leçon sans une source
traçable** — un fichier de rapport (`packages/db/reports/*.txt`), un commentaire de code daté
dans les constantes du module concerné, ou une requête SQL documentée (voir §3 pour le piège à
éviter). Si la source n'existe pas ou n'est pas rejouable, il faut le dire explicitement dans
la leçon plutôt que de citer un chiffre orphelin.

---

## 2. Carte des chiffres cités → leur source

| Chiffre cité                                                        | Leçon(s) / doc concernée                                    | Source                                                                                                                                     | Commande pour rafraîchir                                                    | Dernière vérification connue                                                  |
| ------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| VALUE top5 edge calibré : +14.98% (295 picks), +2.27% (2026)        | `value-channel.md`, business-model §2                       | `packages/db/reports/backtest-invest-ranking-YYYY-MM-DD.txt`                                                                               | `pnpm --filter @evcore/db db:backtest:invest-ranking`                       | 2026-07-07 — **exact**, revérifié 2026-07-18                                  |
| DRAW : +1.61% (1 119 picks), −19% (2023), +11 à +16% (2026)         | `draw-channel.md`, business-model §2                        | même rapport que ci-dessus (section DRAW, formule `-(lH+lA)`)                                                                              | `pnpm --filter @evcore/db db:backtest:invest-ranking`                       | 2026-07-07 — **exact**, revérifié 2026-07-18                                  |
| DOMINANT top5 par probabilité : +3.3% all-time                      | `dominant-channel.md`                                       | commentaire `investment.constants.ts:86`                                                                                                   | **aucun script rejouable identifié** — chiffre écrit à la main              | non daté dans le commentaire                                                  |
| DOMINANT / BTTS / GOALS canal complet : −23.27% / −37.22% / −26.05% | `dominant-channel.md`, `btts-channel.md`, business-model §2 | commentaire `investment.constants.ts:20` ("checked 2026-07-06")                                                                            | **aucun script rejouable identifié** — requête ad hoc à l'époque            | 2026-07-06 — **daté de ~10 jours**, voir §4                                   |
| Coupon Composer : Train +100.3%, Test +61.8%, hit 51.5%, PASS       | `docs/business-model.md` §2                                 | commentaire `coupon.constants.ts` renvoyant à `apps/backend/reports/backtest-selected-params.json`                                         | **fichier et script absents du repo**                                       | 2026-05-19 — non revérifiable en l'état, voir §5                              |
| SAFE : 28 jours éligibles top5, ROI −27% (train) à +2/+10% (2026)   | `safe-channel.md`, business-model §2                        | même rapport `backtest-invest-ranking` (SAFE n'y est pas encore détaillé dans le même format que VALUE/DRAW — à confirmer au prochain run) | `pnpm --filter @evcore/db db:backtest:invest-ranking`                       | 29 jours retrouvés par requête directe (dédupliquée) le 2026-07-18 — cohérent |
| CORRECT_SCORE : observation seule, canal lancé 2026-07-01           | `comment-lire-un-pick.md`                                   | requête SQL directe, dédupliquée par fixture (voir §3)                                                                                     | pas de script committé — à écrire si ce canal doit être suivi dans la durée | 2026-07-18                                                                    |

**Gate EV ≥ 0.08 (VALUE/SAFE uniquement)** : source `packages/db/scripts/backtest-ev-tiers.ts`,
commande `pnpm --filter @evcore/db db:backtest:ev-tiers`, sortie
`packages/db/reports/backtest-ev-tiers-YYYY-MM-DD.txt`.

---

## 3. Piège méthodologique à connaître : les rejeux `ModelRun`

Un même match peut être ré-analysé plusieurs fois par le moteur (nouveaux `ModelRun` — recalcul
après mise à jour des cotes, des stats, etc.). Chaque rejeu crée sa propre ligne
`channel_decision` / `channel_selection`, avec le **même résultat final** (le match ne se
rejoue pas). Une requête naïve sur `channel_selection` compte donc le même événement plusieurs
fois.

**Exemple réel constaté (2026-07-18)** : le canal CORRECT_SCORE affichait 625 sélections
réglées sur une requête brute — en réalité seulement **180 matchs distincts**, chaque match
ayant été rejoué ~3,5 fois en moyenne.

**Règle à appliquer systématiquement** avant tout calcul de ROI/hit-rate à la main :

```sql
-- Un seul point par (match, canal) — le ModelRun le plus récent
WITH latest_per_fixture AS (
  SELECT DISTINCT ON (f.id, cd.channel)
    f.id AS fixture_id, cd.channel, cs.odds, cs.result
  FROM channel_selection cs
  JOIN channel_decision cd ON cd.id = cs."channelDecisionId"
  JOIN model_run mr ON mr.id = cd."modelRunId"
  JOIN fixture f ON f.id = mr."fixtureId"
  WHERE cd.status = 'SELECTED' AND cs.result IN ('WON','LOST')
  ORDER BY f.id, cd.channel, mr."createdAt" DESC
)
SELECT channel, count(*) AS n, ... FROM latest_per_fixture GROUP BY channel;
```

Les scripts committés (`backtest-invest-ranking.ts`, `backtest-ev-tiers.ts`) gèrent déjà ce
problème correctement (ils raisonnent jour par jour sur des picks sélectionnés, pas sur un
`COUNT` brut) — c'est uniquement la vérification manuelle ad hoc (requêtes ponctuelles,
commentaires de code écrits à la main) qui y est exposée.

---

## 4. DOMINANT / BTTS / GOALS : chiffres datés du 2026-07-06, à rafraîchir avant tout lancement

Une revérification manuelle (dédupliquée, §3) le 2026-07-18 donne des chiffres sensiblement
différents de ceux cités (toujours négatifs, mais moins) :

| Canal    | Cité (2026-07-06) | Mesuré le 2026-07-18 |
| -------- | ----------------- | -------------------- |
| DOMINANT | −23.27%           | −17.34%              |
| BTTS     | −37.22%           | −24.60%              |
| GOALS    | −26.05%           | −13.32%              |

La conclusion produit ("pas vendable comme edge prouvé") tient dans les deux cas — mais
l'ampleur a bougé de façon notable en douze jours, probablement sous l'effet du volume Coupe du
Monde. **Ne pas republier ces chiffres avant qu'un vrai script (à écrire, sur le modèle de
`backtest-invest-ranking.ts`) les recalcule proprement — pas une requête ad hoc.**

Action : écrire un script `backtest-full-channel-roi.ts` (mêmes conventions que les deux
scripts existants — sortie datée dans `packages/db/reports/`) qui calcule le ROI canal complet
pour DOMINANT/BTTS/GOALS avec déduplication par fixture, pour remplacer les commentaires de
code actuels par une source rejouable.

---

## 5. Gap connu : le backtest du Coupon Composer n'est pas rejouable

`coupon.constants.ts` cite explicitly `apps/backend/reports/backtest-selected-params.json`
comme source — **ce fichier n'existe pas dans le repo actuel**, et aucun script ne le génère
(recherché en TypeScript et en Python côté `apps/ml-worker`, sans résultat). Les chiffres
Train +100.3% / Test +61.8% / hit 51.5% / PASS restent la meilleure information disponible,
mais ne sont pas revérifiables en l'état.

Action, avant de s'appuyer à nouveau sur ce chiffre dans un contexte commercial : retrouver ou
réécrire le script qui a produit `backtest-selected-params.json`, le committer avec la même
convention que les deux scripts `packages/db/scripts/`, puis republier le rapport daté.

---

## 6. Procédure quand un chiffre change

1. Relancer le script source concerné (§2), lire le nouveau rapport daté dans
   `packages/db/reports/` ou `apps/backend/reports/`.
2. Mettre à jour dans l'ordre : `docs/business-model.md` §2 (table des chiffres), la leçon
   article concernée (`apps/web/content/formation/articles/*.md`), puis son script vidéo
   compagnon (`apps/web/content/formation/scripts/*-script.md`) — les trois doivent toujours
   citer la même valeur.
3. Mettre à jour le champ `updatedAt` du frontmatter de la leçon modifiée.
4. Si le changement remet en cause une recommandation produit (ex. un canal franchit le seuil
   de rentabilité), le signaler explicitement plutôt que de changer silencieusement un chiffre
   — cohérent avec la règle déjà appliquée dans la formation ("republier des audits datés
   plutôt que de figer une formule pour toujours").
