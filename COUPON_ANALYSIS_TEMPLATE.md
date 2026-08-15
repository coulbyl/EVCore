# Template d'analyse intelligente — construction de coupons avec Claude

> v1 — 2026-08-12, issu du post-mortem du coupon du 11/08 (2 jambes sur 3
> cassées) et de l'audit DB qui a suivi. Objectif : ne pas refaire les mêmes
> erreurs de méthode à chaque nouvelle session d'analyse.
>
> Référence : [PROD_DB_ACCESS.md](PROD_DB_ACCESS.md) (accès données réelles) ·
> [TODO.md](TODO.md) (statut à jour par canal/ligue) ·
> [ROADMAP.md](ROADMAP.md) Bloc 10 (détail de l'audit source).

---

## Étape 0 — Balayage actif, pas seulement réactif aux `selectedPicks`

Constat du 2026-08-13 (revue du 13/08, 39 fixtures) : se contenter de lire
`selectedPicks` revient à ne voir qu'**un pick par canal**, déjà filtré par
les seuils propres à ce canal (EV/odds/probabilité). Ces seuils servent à
décider si le système auto-stake une jambe **seule** — ils sont **hors-sujet**
pour juger si une jambe est fiable dans un combiné construit à la main (cf.
discussion PAOK `TEAM_TOTAL_AWAY OVER_0_5`, rejeté `ev_below_threshold` mais
avec une probabilité modèle correcte de 57%). S'arrêter à `selectedPicks`
fait disparaître de vue des matchs entiers (Vaduz–Turku BTTS/Over 0.5,
Nordsjaelland Over 2.5...) alors que la donnée existe.

**Le bon réflexe : deux étages, pas un filtre unique.**

1. **Tri quantitatif (déterministe, tous les marchés de tous les matchs)**
   — pour chaque fixture du jour, ne pas se limiter à `selectedPicks` :
   parcourir `evaluatedPicks` en entier (viable **et** rejected — un rejet
   EV/odds n'est pas un rejet de fiabilité, voir étape 5) et, quand un
   marché en est absent (bug bookmaker-par-marché, cf. TODO.md), aller
   chercher la cote dans `odds_snapshot` et calculer la probabilité à
   partir de `lambda`. Retenir un candidat comme fiable si :
   - `probability` (calibrée) ≥ ~55-60% ;
   - **accord raw/calibré** : si `|calibré − rawPoissonProbability| > ~0.15-0.20`,
     marquer "à vérifier" plutôt qu'exclure d'office (ni l'un ni l'autre
     n'a automatiquement raison, cf. l'étape 7 du bug Nordsjaelland) ;
   - pour tout pick `UNDER_*` du marché `OVER_UNDER` (**toutes lignes**,
     pas juste 2,5) : `lambdaHome + lambdaAway < 2.3` — le garde-fou système
     `under_high_lambda` ne couvre que la ligne 2,5 (cf. TODO.md) ;
   - `dataCoverage` pondère la confiance globale sans disqualifier seul.
     Ce tri ramène ~300+ candidats bruts (39 fixtures × ~8 marchés) à un pool
     réduit (~30-50) — et documente explicitement les fixtures qui n'ont
     produit aucun candidat fiable, pour ne rien faire disparaître en silence.

   **Piège confirmé le 2026-08-14 : ne pas classer ce pool par un seul
   critère.** Deux modes de tri existent, et aucun des deux seul ne suffit :
   - **Mode Fiabilité** — classer par probabilité (corrigée) décroissante,
     un seul candidat par fixture. Fait mécaniquement remonter des cotes
     très courtes (probabilité haute = cote courte, par construction) :
     un coupon construit uniquement comme ça a une bonne chance de tenir,
     mais une cote combinée plate et aucune vraie valeur captée (cas réel :
     9 jambes à cote 1.16-1.37, cote combinée 5.85).
   - **Mode Valeur (EV)** — classer par EV corrigé décroissant sur **tout**
     le pool (pas un seul candidat par fixture — sinon on ne voit jamais
     les cotes plus intéressantes disponibles sur le même match). Deux
     garde-fous obligatoires ici : **exclure entièrement toute fixture
     `avoidFlag`** (un EV corrigé énorme dessus n'est pas une pépite, c'est
     le signal classique d'un problème de données/modèle — même logique
     que `EV_HARD_CAP` dans le code) et **plafonner l'EV corrigé** (~0.35)
     pour la même raison. Seul, ce mode empile des probabilités trop
     proches de la limite basse et écrase la probabilité jointe (cas réel :
     9 jambes ~60-72%, cote combinée 436, proba jointe 1.9% — un profil
     longshot, pas un coupon principal).
   - **Mode recommandé pour un coupon principal : le merge des deux** —
     quelques jambes du mode Fiabilité comme ancres (70-90%+, portent la
     probabilité jointe) + quelques jambes du mode Valeur (60-75%, cote
     plus intéressante, portent la cote combinée). Diversifier par
     championnat dans les deux modes avant de merger. Cas réel (14/08) :
     3 ancres + 4 jambes EV → cote combinée 27.6, proba jointe 13.0% —
     un vrai compromis, ni plat ni longshot.

2. **Synthèse qualitative (jugement, sur le pool réduit seulement)** — sur
   ce pool, appliquer les étapes 1 à 9 de ce document (contexte
   aller-retour, cohérence narrative, clusters de risque corrélé, tier des
   canaux comme signal additionnel) pour construire le ou les coupons.

**Prérequis outillage** (suivi dans [TODO.md](TODO.md), section Générateur
de coupon) : ce balayage suppose d'avoir `evaluatedPicks` complet par
fixture sans dépendre d'un accès DB live à chaque fois (tunnel SSH
instable en pratique) — l'export "fiche EVCore" doit être enrichi en
conséquence avant que ce process soit praticable au quotidien.

**Trou confirmé le 2026-08-14 : les vérifications quantitatives (λ,
`calibration_alert`, delta brut/calibré) ne remplacent pas la connaissance
métier d'une ligue.** Sur Wolves–Blackburn (Championship anglais), tous
les signaux internes étaient propres (λ=2.17 sous le seuil, `offensiveBalance:
BALANCED`, proba calibrée = Poisson brut exactement) — rien dans les
données ne disqualifiait le pick. Mais un analyste pro sait que :

- **Certaines ligues ont une réputation connue de volume de buts élevé**
  (Championship anglais, 2. Bundesliga, Eredivisie sont classiquement
  citées — rythme haut, calendrier chargé, jeu direct) — à traiter avec
  méfiance renforcée sur les marchés O/U même quand les chiffres internes
  sont propres, le modèle n'a pas ce savoir stylistique dans son λ.
- **Over/Under 2.5 est le marché le plus parié et le plus efficacement
  pricé au monde**, encore plus sur une ligue à forte couverture bookmaker.
  Un edge apparent dessus mérite structurellement plus de méfiance qu'un
  edge similaire sur un marché fin/peu couvert (TEAM_TOTAL sur une petite
  ligue) — pas parce que les chiffres clochent, mais parce que c'est le
  marché le plus dur à battre par construction.

**Corollaire découvert le même jour — ne jamais substituer une ligne sûre
gagnante par une ligne plus risquée sur le même match pour chasser un
meilleur EV, sans justification forte.** Le 14/08, le coupon "mode
Fiabilité" pur jouait Wolves–Blackburn en Under 4,5 (a gagné, 4 buts au
final). Le merge avec le mode Valeur a remplacé cette jambe par Under 2,5
sur le même match pour un meilleur EV affiché — et c'est précisément cette
substitution qui a cassé le coupon combiné (le reste du coupon sûr, 9/9,
est passé sans encombre). Un saut de ligne important (4,5 → 2,5) sur une
ligue à réputation de gros volume de buts est un changement de risque bien
plus grand qu'un saut équivalent sur une ligue plus fermée — à peser
explicitement avant de faire le swap, pas seulement comparer l'EV affiché.

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

## Étape 9 — Post-mortem pick par pick, y compris les matchs/marchés écartés

Ne pas se contenter de vérifier si la jambe choisie a gagné. Pour chaque
match du lot initial (retenu **ou écarté** du coupon final), une fois le
match terminé :

1. Relire `evaluatedPicks` complet (pas juste `candidatePicks`, qui ne garde
   que le top 5 par EV) — regarder tous les marchés `status: "rejected"` et
   leur `rejectionReason`. Un marché rejeté par le système n'est pas
   forcément un mauvais marché pour un usage différent (voir point 3).
2. Comparer le classement `candidatePicks` (meilleur EV brut) au résultat
   réel. **Confirmé le 2026-08-13** sur Omonia–Lincoln (1-0) : les 5
   meilleurs `candidatePicks` par EV étaient tous des marchés directionnels
   secondaires (BTTS Yes, Clean Sheet Home No, Win To Nil Home No, Team
   Total Away Over 0.5, Team Total Home Under 2.5) — **4 sur 5 auraient
   perdu** sur ce score. Le seul gagnant était `TEAM_TOTAL_HOME UNDER_2_5`.
   La jambe qu'on a réellement jouée (`OVER_UNDER UNDER_4_5`, cote 1.24)
   n'apparaissait même pas dans ce top 5 et a gagné proprement. **Le
   classement EV du système favorise des marchés à probabilité modérée
   (50-70%) à variance de match élevée — ne pas le lire comme "les
   meilleurs picks", juste comme "les picks à plus haute EV brute théorique",
   deux choses différentes pour un usage combo/sécurisant.**
3. Si la jambe jouée était `status: "rejected"` côté système (ex. Omonia
   `UNDER_4_5` : `ev=0.072`, rejetée `ev_below_threshold` — sous le plancher
   `EV_THRESHOLD=0.08`), **le dire explicitement dans l'analyse**. On a le
   droit d'inclure une jambe à très haute probabilité que le système
   rejette pour un seul pari (le plancher d'EV est calibré pour un pari
   isolé, pas pour réduire la variance d'un combiné) — mais ce n'est pas la
   même chose que "le système valide cette jambe", et le lecteur du coupon
   doit le savoir.
4. Vérifier `lambdaHome + lambdaAway` (lambda total) sur toute jambe
   `UNDER_X_5` (X ≠ 2.5, càd `UNDER_1_5`/`UNDER_3_5`/`UNDER_4_5`) contre
   `UNDER_HIGH_LAMBDA_THRESHOLD=2.3` **à la main** — le garde-fou système
   `under_high_lambda` (`pick-validation.ts:48-54`) ne se déclenche que sur
   le pick littéral `"UNDER"` (ligne 2,5), jamais sur les lignes 1,5/3,5/4,5.
   **Confirmé le 2026-08-13** : la jambe cassée Nordsjaelland–Valur
   (`UNDER_3_5`, busté 5-0) avait `lambdaTotal≈3.74`, largement au-dessus du
   seuil 2.3 qui aurait bloqué un simple "Under 2,5" sur ce match — mais
   comme c'était la ligne 3,5, aucune garde-fou ne s'est déclenchée. Même
   famille de bug que `calibration_alert` (étape 7/ROADMAP Bloc 10) : un
   garde-fou construit pour un marché précis ne protège pas les marchés
   adjacents, et personne ne l'a remarqué avant que ça casse en vrai.
5. Documenter tout motif réutilisable trouvé ici dans [TODO.md](TODO.md)
   (garde-fous/code), pas seulement dans ce template (méthode).

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
- [ ] Toute jambe `UNDER_1_5`/`UNDER_3_5`/`UNDER_4_5` : `lambdaHome+lambdaAway` vérifié à la main contre 2.3 (le garde-fou système ne couvre que la ligne 2,5)
- [ ] Si une jambe jouée était `rejected` côté système (EV/odds/probabilité) : je le dis explicitement, je ne laisse pas croire que le système l'a validée
