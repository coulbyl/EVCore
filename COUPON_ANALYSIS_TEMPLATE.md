# Template d'analyse intelligente — construction de coupons avec Claude

> v1 — 2026-08-12, issu du post-mortem du coupon du 11/08 (2 jambes sur 3
> cassées) et de l'audit DB qui a suivi. Objectif : ne pas refaire les mêmes
> erreurs de méthode à chaque nouvelle session d'analyse.
>
> Référence : [PROD_DB_ACCESS.md](PROD_DB_ACCESS.md) (accès données réelles) ·
> [TODO.md](TODO.md) (statut à jour par canal/ligue) ·
> [ROADMAP.md](ROADMAP.md) Bloc 10 (détail de l'audit source).

---

## Étape 1 — Lire la fiche EVCore sans la prendre pour argent comptant

- Utiliser le champ `label` de chaque pick (ajouté le 2026-08-12) plutôt que
  de deviner ce que veut dire un `pick` brut comme `"OVER"` (= 2.5 buts par
  convention historique, pas évident sans le savoir).
- Regarder `model.finalScore` vs `model.scoreThreshold` — un pick peut être
  `SELECTED` alors que le score global de la fixture est sous le seuil
  (les seuils sont par canal, pas un gate unique).
- Un `avoidFlag` ou un `calibrationAlert` sur la fixture n'est pas à ignorer
  ni à traiter comme automatiquement disqualifiant tout le match : lire le
  détail (`reasonCode`, `divergence`, `modelFavorite` vs `marketFavorite`)
  avant de juger si ça invalide un pick précis ou toute la fixture.
- `dataCoverage` bas (souvent 0.33 sur les qualifs européennes/petites
  ligues) = le modèle tourne avec peu de signal — traiter sa confiance
  affichée avec plus de scepticisme que sur une fixture à coverage 0.67+.

## Étape 2 — Contexte externe pour les matchs à enjeu (aller-retour, élimination)

- Avant de parier un résultat sec sur une compétition à élimination
  (qualifs C1/C3/C4, coupes), **vérifier le score de l'aller et l'agrégat**
  — la fiche EVCore ne le sait pas toujours bien (`dataCoverage` faible sur
  ces fixtures), c'est à vérifier soi-même (recherche web si besoin).
- Une équipe qui doit remonter un déficit joue différemment d'une équipe
  qui défend une avance — mais **appliquer cette lecture de façon cohérente
  sur tous les matchs du coupon**. L'erreur du 11/08 : avoir prédit un but
  rapide pour l'équipe qui devait remonter un déficit (Sabah) tout en
  parlant contre les buts de l'équipe qui devait, elle aussi, attaquer pour
  remonter le sien (Brann) — deux lectures opposées du même scénario dans
  le même coupon.
- Quand le contexte d'agrégat est incertain, préférer un marché neutre au
  sens du résultat (total buts, BTTS) à un marché directionnel (qui gagne),
  sauf signal DOMINANT/VALUE net et non contredit par le contexte.

## Étape 3 — Construction agnostique à la cote : les jambes d'abord, la cote ensuite

**Ne jamais partir d'une cote cible (« entre 2 et 3 », « autour de 4 ») pour
choisir les jambes.** C'est un biais réel identifié le 2026-08-12 : traiter
la cote demandée comme un objectif à atteindre force à exclure une jambe qui
a un vrai signal (parce qu'elle ferait dépasser la fourchette) ou à en
inclure une faible juste pour combler jusqu'à la cote voulue — dans les deux
cas, on optimise sur le mauvais critère.

La bonne séquence :

1. Sélectionner les meilleures jambes disponibles sur leur seul mérite
   (tier du canal, calibration par ligue, contexte aller-retour cohérent —
   étapes 1/2/4 de ce document), **sans regarder leur cote pendant cette
   sélection**.
2. Calculer la cote combinée et la probabilité jointe _après coup_, une
   fois les jambes choisies — c'est une propriété qui en résulte, pas un
   paramètre d'entrée.
3. Si l'utilisateur a exprimé une préférence de cote, la traiter comme un
   filtre a posteriori sur les combinaisons déjà qualitativement bonnes
   (comme `minCombinedOdds`/`maxCombinedOdds` filtrent le composeur du
   système _après_ le classement par `signalScore` — jamais l'inverse), et
   si aucune combinaison de bonnes jambes ne tombe dans la fourchette
   demandée, le dire clairement plutôt que de forcer.

Toujours calculer et afficher la probabilité jointe réelle (produit des
probabilités des jambes), pas seulement la cote combinée — une cote
"raisonnable" (2-3) peut cacher une probabilité jointe proche de 50%, ce
n'est pas "sécurisé" juste parce que la cote est modeste. Le système a déjà
cette discipline (`coupon_proposal.jointProbability`) : s'en inspirer.

Éviter d'empiler plusieurs jambes qui partagent la même source
d'incertitude non backtestée (plusieurs qualifs européennes du même tour,
plusieurs canaux Tier C/D, plusieurs picks construits sur la même lecture
narrative). Diversifier les sources de risque, pas seulement viser une cote.

⚠️ Point ouvert : `jointProbability` du système lui-même se dégrade avec la
confiance affichée (cf. TODO.md) — ne pas non plus faire une confiance
aveugle au chiffre du système une fois qu'il devient élevé (>40%).

## Étape 4 — Respecter la hiérarchie réelle des canaux

| Tier                           | Canaux                                                                  | À faire avant d'en tirer un pick                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| A — stakés en direct           | VALUE, SAFE                                                             | Rien de spécial, ce sont les plus éprouvés                                                                                          |
| B — promus par ligue seulement | DRAW (`I2/POR/BL1`), BTTS (`PL/BL1`), TEAM_TOTAL (toutes ligues)        | Vérifier que la ligue du match fait partie de la whitelist active                                                                   |
| C — observation documentée     | DOMINANT (ROI backtesté −2.1%), CORRECT_SCORE (aucune promotion encore) | Traiter comme un signal informatif, jamais comme un pick à jouer, sauf ligue déjà validée (cf. TODO.md pour CORRECT_SCORE)          |
| D — jamais évalués             | CONSENSUS, CLEAN_SHEET, WIN_EITHER_HALF, GOALS (hors ligne 2.5)         | Signal parfois bon par ligue (voir TODO.md) mais aucun backtest formel — mentionner explicitement le statut expérimental si utilisé |

Ce tableau bouge (des canaux passent de D à B au fil des backtests) — se
référer à [TODO.md](TODO.md) pour le statut à jour plutôt que de le
recopier de mémoire.

## Étape 5 — Vérifier chaque jambe : cohérence inter-canaux et EV réel, pas juste le tier

Deux trous de méthode confirmés le 2026-08-13 sur un coupon réel (7 jambes,
audité seulement après coup, sur demande) :

- **Le tier d'un canal n'est pas une preuve d'edge sur la jambe précise.**
  Une jambe `SELECTED` par un canal Tier A/B peut avoir une **`ev` négative**
  (le gate de sélection du canal n'est pas toujours un plancher d'EV strict —
  `TEAM_TOTAL` par exemple peut sélectionner sur seuil de probabilité/rang
  sans garantir `ev > 0`). Toujours lire le champ `ev` de la jambe elle-même
  avant de la retenir, jamais déduire "ce canal est fiable donc cette cote
  est bonne". Cas réel : une jambe `TEAM_TOTAL` à 79.1% de probabilité
  affichée avait `ev = -0.019` — la cote (1.24, soit 80.6% de probabilité
  implicite) pricait le marché _mieux_ que le modèle, aucun edge malgré une
  probabilité qui semblait attractive.
- **Toujours relire tous les canaux d'un match avant de finaliser une jambe**,
  pas seulement celui qu'on a choisi — le comparer aux autres candidats du
  même match révèle soit une confirmation croisée (bon signe), soit une
  divergence à creuser, soit — comme ci-dessus — une jambe sans edge qui
  serait passée inaperçue en ne regardant que son propre tier/sa probabilité.
  Ne pas attendre que l'utilisateur pose la question pour le faire.

## Étape 6 — Se méfier de la confiance inhabituellement haute

Motif confirmé sur au moins trois mécanismes indépendants cette session
(`jointProbability` des coupons, `CORRECT_SCORE`, seuil `DOMINANT` par
côté) : **plus une probabilité affichée par le système est haute et sort de
l'ordinaire, plus l'écart entre elle et la réalité tend à se creuser.** Un
pick à 45% de proba annoncée qui semble "presque une certitude" pour son
marché doit être traité avec plus de scepticisme, pas moins.

## Étape 7 — Vérifier avec les vraies données quand un doute existe

Ne pas trancher un désaccord ("ce canal est-il bon ?", "ce marché a-t-il un
edge ?") par le seul raisonnement narratif si la donnée existe pour vérifier.
Voir [PROD_DB_ACCESS.md](PROD_DB_ACCESS.md) pour se connecter en lecture
seule à la prod et requêter directement `channel_selection`/`coupon_proposal`/
`fixture` plutôt que de deviner.

## Étape 8 — Post-mortem systématique après règlement

Pour tout coupon qui casse, ne pas s'arrêter à "cette jambe a perdu" :

1. Vérifier le score/résultat réel de chaque match concerné.
2. Regarder les **autres marchés disponibles** sur ces mêmes matchs
   (`selectedPicks` complet de la fiche, pas juste le pick choisi) — est-ce
   qu'un autre marché sur le même match aurait gagné ? Si oui, était-ce
   prévisible avant coup, ou juste le hasard qui est tombé ailleurs ?
3. Distinguer une **erreur de sélection de marché** (un meilleur choix
   existait, identifiable à l'avance — granularité, cohérence narrative) d'un
   **vrai miss du modèle** (la lecture directionnelle était fausse, aucun
   marché du match n'aurait vraiment aidé).
4. Si le miss révèle un motif réutilisable (biais de canal, ligue, type de
   marché), le documenter dans [TODO.md](TODO.md) plutôt que de le laisser
   dans l'historique de conversation.

---

## Checklist rapide avant de proposer un coupon

- [ ] J'ai lu `label`, pas juste `pick` brut
- [ ] J'ai vérifié `dataCoverage` et les flags (`avoidFlag`/`calibrationAlert`)
- [ ] Pour les matchs à élimination : agrégat aller vérifié, lecture cohérente sur tout le coupon
- [ ] J'ai choisi les jambes sur leur mérite, sans regarder leur cote — la cote cible (si demandée) n'a servi qu'à filtrer après coup
- [ ] Probabilité jointe calculée et affichée à l'utilisateur, pas seulement la cote
- [ ] Chaque jambe : je connais son tier (A/B/C/D) et je le dis si c'est C ou D
- [ ] Chaque jambe : `ev` vérifié individuellement (positif), pas juste déduit du tier du canal
- [ ] Chaque jambe : les autres canaux du même match relus, pas seulement celui choisi
- [ ] Aucune jambe choisie uniquement parce que la confiance affichée est spectaculairement haute
- [ ] Si doute persistant : vérifié en DB plutôt que tranché à l'intuition
