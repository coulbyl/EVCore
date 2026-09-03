# Refonte VANTAGE-centrique — UX, coupon, personnalisation

> Rédigé le 2026-09-01, mis à jour le 2026-09-02 à l'issue d'une session de design complète
> (maquettes + audit de toutes les pages lambda de l'app réelle via Playwright), puis à
> nouveau le 2026-09-02 après fidélité pixel-perfect de l'écran Decisions au composant réel
> et ajout des 10 variantes mobile. Fait suite à
> une session d'audit qui a mesuré la calibration réelle des canaux
> (`docs/audit-canaux-investir-2026-08-22.md`), diagnostiqué 3 bugs concrets sur VANTAGE
> (métrique ROI halluciné, signal externe dégénéré, correction ML mal ciblée — corrigés le
> jour même dans `apps/vantage-worker/src/context/shadow-signals.ts`) et confirmé que le
> Coupon Composer reconstruit le 22-23 août pioche encore dans des canaux non calibrés
> (TEAM_TOTAL 48,8% de hit-rate sur 75 jambes, BTTS/CLEAN_SHEET/VALUE/WIN_TO_NIL entre 0% et
> 40%).
>
> **Maquettes de référence (10 écrans desktop + 10 versions mobile en regard, à relire avant
> de coder)** :
> https://claude.ai/code/artifact/6468e339-5d32-45b0-b14e-89df315730bb — dashboard, decisions,
> arbitrage, coupons, drawer de bet slip (+ bouton VANTAGE), révision VANTAGE, abonnements,
> personnalisation (onglet Paramètres), notifications fusionnées, onboarding. L'écran
> Decisions reprend la structure réelle de `match-card.tsx`/`channel-row.tsx` (crests
> circulaires, connecteur de jambes, badge consensus, bouton "+" d'ajout, badge de résultat)
> mais **simplifie la ligne de pick** (mise à jour le 2026-09-02, §2 point 2) : badge de
> code canal retiré, calibration numérique (ratio×n) remplacée par un badge qualitatif à 3
> niveaux (Fiable/À confirmer/Peu fiable) avec le détail chiffré replié derrière un clic, et
> la carte plafonnée à 3-4 picks (triés par confiance) + lien "Voir N autres marchés".
> Chaque écran a sa variante mobile (390px) juste à côté, avec le même filtre de
> ligues/canaux que le desktop mais plafonné à 2-3 chips + un bouton "+N" pour éviter le
> scroll horizontal.
>
> Statut : cadrage + design figés pour la V1 décrite ici. Implémenté à ce stade :
> uniquement le correctif `shadow-signals.ts`. Tout le reste ci-dessous est à construire.

---

## 0. Plan de travail — à démarrer le 2026-09-02

Dans l'ordre, chaque étape se termine par une vérification sur données réelles avant de
passer à la suivante — jamais sur la conviction que "ça devrait marcher" (voir §8) :

1. **Corriger le bug P0 bet-slip** (`POST /bet-slips` rejette un item construit hors
   `betId` direct — TODO.md, section front web 2026-08-31). Prérequis technique à tout le
   reste : c'est le même endpoint qui portera le bouton "Envoyer à VANTAGE" du drawer.
2. **Restreindre le pool du Composer actuel** aux canaux calibrés (retirer `topN`,
   admettre par ratio réel/annoncé — déjà diagnostiqué dans l'audit du 22-08, indépendant
   de la refonte). Sert de filet de sécurité pendant que VANTAGE prend le relais.
3. **UI — retraits et fusions** (le plus rapide à livrer, aucune dépendance backend) :
   - Retirer Investir et l'ancien Coupon Composer de la nav.
   - Fusionner Notifications + Annonces en un seul écran/nav (maquette écran 7).
   - Corriger la ligne de filtre ligues sur Decisions/Arbitrage (chips à la suite, pas
     aux deux bouts de la ligne).
   - Fusionner "Par match"/"Par canal" en une seule rangée d'onglets sur Decisions.
   - Retirer les KPI "lectures/tensions" de l'en-tête Arbitrage.
4. **Abonnements** — retirer tout le cadre "portefeuille simulé" (mise/ROI), passer en
   calibration seule, popover pour "Découvrir des canaux" (maquette écran 7bis).
5. **Personnalisation** — nouveau 6ᵉ onglet dans la vraie page Paramètres
   (`/dashboard/params/account`, à côté de Profil/Préférences/Sécurité/Notifications/
   Bankroll qui existent déjà) — pas un nouvel item de sidebar.
6. **Onboarding en 3 étapes** (maquette écran 10) — inséré entre l'inscription et le tour
   passif existant (`onboarding-steps.ts`), avec "Passer" à chaque étape.
7. **Générateur de coupon VANTAGE** (3 coupons/jour, Safe/Moyen/Agressif) — le chantier le
   plus lourd, à ne démarrer qu'une fois 1-6 stabilisés et le pool de canaux filtré (2).
8. **Décommissionner VALUE/SAFE** seulement après avoir tranché §5.1 (ne pas perdre les
   8% de picks propres à VALUE).

**Backlog — pas d'implémentation immédiate (acté le 2026-09-02)** : le bouton "✨ Envoyer à
VANTAGE pour révision" dans le drawer de bet slip (maquette écran 5) et l'écran de révision
VANTAGE lui-même (maquette écran 6, extension de `apps/vantage-worker/src/vantage/prompt.ts`
pour accepter un coupon multi-jambes) restent maquettés mais retirés du plan de cette
semaine. La maquette des deux écrans reste dans l'artifact comme référence pour plus tard.

Non planifié cette semaine, mais noté pour la suite (§9) : le fix ROI→calibration
d'Historique vérifiable, et le gate du chat Business (Inbox) — l'utilisateur a confirmé
que **tout reste gratuit pour l'instant**, le gate viendra plus tard.

---

## 1. Résumé de la vision

| Axe | Avant | Après |
|---|---|---|
| Navigation | Dashboard, Investir, Coupon Composer, Decisions, Arbitrage, Abonnements, Notifications, Annonces séparées | Dashboard épuré, **Decisions**, **Arbitrage** (rôle inchangé), **Coupons** (nouveau, sœur d'Arbitrage), **Notifications** fusionnée — Investir, Coupon Composer, **Abonnements** et Annonces supprimés de la nav |
| Génération de coupon | Moteur déterministe (`coupon` module), `topN` sur canaux non filtrés par calibration | **VANTAGE génère les 3 coupons quotidiens** (Safe/Moyen/Agressif) sur un pool pré-filtré par calibration |
| Coupon personnel | Aucun mécanisme dédié | L'utilisateur compose via le **drawer de bet slip existant** (rien de neuf) ; le bouton "Envoyer à VANTAGE" + l'écran de révision sont maquettés mais **en backlog** (§0, §5.2) |
| VALUE / SAFE | Deux canaux de filtrage Phase 2 (edge / probabilité+EV) | **Retirés en tant que canaux** — stratégie de remplacement encore ouverte (§5.1) |
| Personnalisation + Abonnements | Deux endroits séparés : gamification (Paramètres → Profil) et Abonnements (portefeuille simulé mise/ROI) en item de nav propre | **Fusionnés** (2026-09-02, §2bis) : un **6ᵉ onglet "Personnalisation"** dans Paramètres regroupe ligues, canaux suivis + calibration (ex-Abonnements, "Découvrir des canaux" inclus), profil de risque — plus d'item de nav séparé — + un **onboarding actif en 3 étapes** à l'inscription |
| Paramètres — navigation | Onglets à plat (Profil/Préférences/Sécurité/Notifications/Bankroll/Personnalisation) | **Rail latéral groupé par thème** (2026-09-02, §2bis) : Compte (Profil, Sécurité) / Préférences (Préférences, Bankroll, Notifications) / Paris (Personnalisation) |
| Bet slip | Un coupon = une transaction | Un coupon généré par VANTAGE est un **template partagé** : N utilisateurs l'ajoutent chacun à leur bet slip, chacun sa mise — déjà supporté par le schéma (`bet_slip`/`bet_slip_item`), sans écran dédié (pas de fausse preuve sociale, voir §5.4) |

---

## 2. Les 10 écrans de la maquette — statut et travail associé

Lien : https://claude.ai/code/artifact/6468e339-5d32-45b0-b14e-89df315730bb — chaque écran a
désormais sa variante mobile (390px) juste à côté du desktop sur le canvas.

| # | Écran | Ce qui change vs l'app réelle | Backend à toucher |
|---|---|---|---|
| 1 | Dashboard (Accueil) | Épuré, plus de lien Investir/Combinés dans le hero | Aucun |
| 2 | Decisions | Structure de carte identique à `match-card.tsx`/`channel-row.tsx` réels (crests, connecteur, badge consensus, badge de résultat), mais ligne de pick **simplifiée** vs le composant réel actuel (2026-09-02) : badge de code canal retiré (nom de marché en clair seul), ratio×n/edge remplacés par un badge Fiable/À confirmer/Peu fiable (détail chiffré derrière un clic), carte plafonnée à 3-4 picks triés par confiance + "Voir N autres marchés" ; "Par match"/"Par canal" fusionnés en une rangée d'onglets avec les canaux à plat ; **filtre ligues/canaux remplacé par un tiroir de facettes** (§2bis, 2026-09-02) au lieu du "+ Plus" | Aucun (front only) |
| 3 | Arbitrage | KPI "lectures/tensions" retirés de l'en-tête, rôle sinon inchangé ; **même tiroir de facettes** que Decisions pour le filtre ligues (§2bis), y compris sur mobile où la ligne de filtre était absente jusqu'ici | Aucun |
| 4 | Coupons | Nouvelle page sœur d'Arbitrage — 3 coupons du jour générés par VANTAGE | §0 point 7 |
| 5 | Drawer de bet slip | Un bouton "Envoyer à VANTAGE" ajouté à l'existant (`bet-slip-drawer.tsx`) | **Backlog** (§0) — maquetté, pas d'implémentation immédiate |
| 6 | Révision VANTAGE | Refaite en liste unique (plus de doublon jambe×2), carte verdict en tête, comparaison avant/après | **Backlog** (§0) — maquetté, pas d'implémentation immédiate |
| 7 | Notifications | Fusion Notifications + Annonces, filtrable par type | Fusion des deux modèles de données ou vue unifiée |
| 7bis | ~~Abonnements~~ | **Supprimé en tant qu'écran/nav** (2026-09-02, §2bis) — fusionné dans l'onglet Personnalisation (8) comme section "Canaux suivis" (calibration par canal + "Découvrir des canaux") | — |
| 8 | Personnalisation | Nouvel onglet dans Paramètres réel, pas un nouveau menu ; absorbe désormais le contenu d'Abonnements (7bis, §2bis) ; **Paramètres passe d'onglets à plat à un rail latéral groupé** (Compte / Préférences / Paris, §2bis) | Nouveaux champs `User` (ligues, canaux, profil de risque) |
| 9 | Onboarding | 3 étapes actives (ligues/canaux/risque) avant le tour passif | Réutilise les endpoints de (8) |

**Écran retiré du périmètre** : un "Coupon partagé" en détail avec aperçu communautaire
avait été maquetté puis retiré — il dupliquait le CTA déjà présent sur la carte Coupons et
affichait une forme de preuve sociale fabriquée (contraire à business-model.md : *"un pitch
qui s'appuierait sur nos utilisateurs serait fabriqué"*). Le mécanisme "un coupon, N
utilisateurs, chacun sa mise" reste entièrement fonctionnel sans écran dédié.

---

## 2bis. Filtre ligues/canaux — du "+ Plus" au tiroir de facettes (2026-09-02)

**Problème** : la barre de filtre Decisions/Arbitrage (2 rangées — ligues puis canaux)
finissait sur un bouton "+ Plus" qui est un cul-de-sac : on ne voit ni ce qu'il contient ni
combien d'options restent, et sur mobile la maquette plafonnait arbitrairement l'affichage
à 2-3 chips. Ça ne scale pas : 19 canaux, et une liste de ligues appelée à grandir.

**Pattern retenu** — filtre à facettes en tiroir (Airbnb/Amazon/Notion) :

1. Quelques chips rapides restent en dur dans la barre (les valeurs les plus utilisées),
   pour l'accès en un clic aux cas fréquents.
2. Le "+ Plus" devient un bouton **"Filtres (N)"** (N = nb de filtres actifs hors chips
   rapides) qui ouvre un **tiroir** listant toutes les ligues et tous les canaux, groupés
   par section, avec comptage — case à cocher par ligne, pied "Annuler"/"Appliquer (N)".
3. Tiroir **latéral sur desktop, bottom sheet sur mobile** — repris du style du
   `bet-slip-drawer.tsx` déjà existant, pas un nouveau composant. Choix acté après une
   première proposition en dialog/popover centré, écartée pour rester cohérent avec le
   pattern drawer déjà utilisé dans le produit.
4. Les filtres actifs redescendent en chips retirables (✕) dans la barre, pour que l'état
   reste visible sans rouvrir le tiroir.
5. Le tiroir canaux exclut volontairement CONSENSUS/CONTRARIAN/AVOID (méta-canaux Phase-3
   qui n'émettent pas de pick propre — voir EVCORE.md/CLAUDE.md).

Appliqué à Decisions et Arbitrage, desktop + mobile, sur la maquette. **Statut : idée et
pattern actés dans ce doc ; la représentation visuelle produite sur la maquette elle-même
n'est pas jugée fidèle/exploitable en l'état** — à refaire une fois qu'on attaque
l'implémentation réelle plutôt qu'à retravailler dans le design canvas.

## 2ter. Abonnements → Personnalisation, et rail latéral pour Paramètres (2026-09-02)

**Problème** : Abonnements (écran 7bis) et l'onglet Personnalisation géraient tous les deux,
séparément, "quels canaux intéressent cet utilisateur" — deux endroits de nav pour la même
donnée sous-jacente. Par ailleurs, la page Paramètres arrivait à 6 sections (Profil,
Préférences, Sécurité, Notifications, Bankroll, Personnalisation) en onglets à plat, ce qui
ne groupe rien logiquement et vieillit mal sur mobile.

**Décisions retenues** :

1. **Abonnements supprimé comme écran/item de nav** — son contenu (canaux suivis + badge de
   calibration par canal, "Découvrir des canaux") devient une section à l'intérieur de
   l'onglet Personnalisation, à côté de ligues/canaux/profil de risque déjà prévus.
2. **Paramètres passe d'onglets à plat à un rail latéral groupé par thème** (pattern
   GitHub/Linear/Notion) : **Compte** (Profil, Sécurité), **Préférences** (Préférences,
   Bankroll, Notifications), **Paris** (Personnalisation). Rail vertical à gauche sur
   desktop ; sur **mobile, un bouton hamburger ancré en bas d'écran** ouvre un **drawer
   latéral** (mêmes 3 groupes) — pas un hamburger en haut, pas une liste pleine largeur
   toujours affichée sur la page, et pas un bottom sheet (réservé à une sélection
   contextuelle avec validation, comme le tiroir de filtres §2bis) : ici c'est une
   **navigation entre sections persistantes**, le pattern hamburger→tiroir latéral qui glisse
   depuis le bord reste plus juste, cohérent avec le `bet-slip-drawer` déjà existant.
   **Correction actée le 2026-09-02** : la maquette republiée représente encore la version
   mobile en liste pleine largeur (première implémentation avant cette précision) — à
   corriger en bouton hamburger bas d'écran + drawer latéral avant de considérer l'écran
   Paramètres mobile comme fidèle.
3. Style du rail distinct de la nav produit principale (tokens `--sidebar*`) — variante plus
   discrète (`--panel`/`--border`, actif en `--accent-soft`/`--accent`) puisque c'est une
   sous-navigation à l'intérieur d'une page.

Appliqué sur la maquette (`ParamsPersonalisation`, `Main`, `Decisions`, `Arbitrage`,
`Coupons`, `CouponReview`, `Notifications` pour le retrait du lien de nav Abonnements).

## 2quater. Libellés de canal — nom métier partout, jamais le code technique (2026-09-02)

**Règle** : partout où un canal apparaît dans l'UI lambda (tiroir de filtres §2bis, section
"Canaux suivis" de Personnalisation §2ter, **l'écran Arbitrage** — mêmes badges de canal que
Decisions —, et tout futur écran qui listerait les canaux), **afficher un nom métier en
langage clair, jamais l'identifiant technique tel que stocké en base** (`WIN_EITHER_HALF`,
`TEAM_TOTAL`, `HALF_TIME_FULL_TIME`...). Objectif : éviter la
répétition entre deux libellés proches et la surcharge cognitive d'une liste de 15+ canaux à
codes énumérés. Cette règle est **strictement une couche d'affichage front** — elle ne
change rien à la convention CLAUDE.md sur le nommage interne (le code du canal reste
l'anglais technique partout côté backend/API/logs).

**Mapping illustratif** (à valider contre la liste exhaustive des canaux avant
implémentation — certains codes ci-dessous restent à confirmer dans le code) :

| Code interne | Libellé UI proposé |
|---|---|
| `DOMINANT` | Résultat favori |
| `GOALS` | Total de buts |
| `BTTS` | Les deux équipes marquent |
| `DOUBLE_CHANCE` | Double chance |
| `TEAM_TOTAL` | Buts par équipe |
| `CLEAN_SHEET` | Garde sa cage |
| `FIRST_HALF` | Résultat 1ère mi-temps |
| `OVER_UNDER_HT` | Buts en 1ère mi-temps |
| `HALF_TIME_FULL_TIME` | Mi-temps / Fin de match |
| `WIN_EITHER_HALF` | Gagne au moins une mi-temps |
| `DRAW` | Match nul |
| `CORRECT_SCORE` | Score exact |

`VALUE`/`SAFE` (filtres Phase-2, en cours de retrait §5.1) et `CONSENSUS`/`CONTRARIAN`/
`AVOID` (méta-canaux Phase-3 sans pick propre, déjà exclus du tiroir de filtres §2bis point
5) ne sont de toute façon pas censés apparaître comme "canal à suivre" pour un utilisateur
lambda. **Statut** : idée et principe actés dans ce doc ; le mapping ci-dessus n'a pas
encore été répercuté dans la maquette ni vérifié exhaustivement contre le code — à faire
avant l'implémentation réelle.

## 2quinquies. Texte VANTAGE (Arbitrage) en anglais — backlog, pas maintenant (2026-09-02)

Le texte de raisonnement d'Arbitrage (`reasonDetails`) est généré par le LLM, pas par un
mapping statique comme §2quater — donc le nom de canal en clair doit être **injecté dans le
prompt comme glossaire autorisé**, pas laissé à la traduction libre du LLM au risque de
diverger du reste de l'UI.

Pour la question de la langue (FR/EN selon l'utilisateur qui lit) : un LLM peut générer les
deux langues sans problème technique. **Option retenue en principe, mais explicitement
différée** : générer les deux langues **au moment de la création du ModelRun, à l'échelle de
la fixture** (`reasonDetails_fr` + `reasonDetails_en`), jamais à l'échelle de l'utilisateur —
pour ne pas transformer le Cas A du chiffrage §6 (~$18/mois, indépendant du nombre
d'utilisateurs) en un coût proportionnel aux utilisateurs actifs comme le Cas D. Le glossaire
§2quater est injecté dans le prompt pour les deux langues, et seule la prose est traduite —
jamais les valeurs numériques (probabilité, ratio, edge), qui restent calculées une fois,
langue-agnostiques (garde-fou §4 point 2 : VANTAGE n'invente jamais une probabilité).

**Décidé le 2026-09-02 : pas d'implémentation maintenant.** EVCore n'a pas encore
d'utilisateurs anglophones réels — ce chantier n'a de sens qu'une fois qu'on en touche
vraiment. À reprendre à ce moment-là, pas avant.

## 2sexies. Personnalisation LLM des canaux suivis — après le gate de paiement (2026-09-02)

Question soulevée : le suivi de canaux lui-même (§2ter, "Canaux suivis" dans
Personnalisation) est **déterministe, pas du LLM** — juste une préférence utilisateur +
un badge de calibration déjà calculé ailleurs. Rien à différer là-dessus.

Ce qui doit attendre, c'est une **couche LLM personnalisée construite par-dessus** (une
expérience VANTAGE qui commenterait/adapterait son discours selon les canaux suivis de
chaque utilisateur — le "Cas D" du chiffrage §6, désormais distinct d'Eva (§5.3 résolu :
Eva reste un simple outil d'export, pas cette couche personnalisée). Ce cas est le seul du
chiffrage §6 dont le **coût scale avec le nombre d'utilisateurs actifs** (de $13/mois à
$129/mois selon l'adoption), sans qu'aucun gate de paiement n'existe aujourd'hui pour le
financer — §5.5 acte que "tout reste gratuit pour l'instant". Construire cette
personnalisation maintenant reviendrait à faire grossir un coût variable pur avec l'adoption,
sans revenu en face.

**Décidé le 2026-09-02** : cette personnalisation LLM des canaux suivis attend la mise en
place du gate de paiement (§5.5) avant d'être construite — pas de blocage technique, une
question de séquencement produit/coût.

### 5.8 Audit VANTAGE (Arbitrage) — garde-fou §4.3 non câblé (2026-09-03)

Audit de fond sur `channel_decision.channel='VANTAGE'` depuis le tout premier enregistrement
(2026-08-28 06:12:33) :

- **Pas d'hallucination confirmée** : les chiffres cités dans `reasonDetails.text`
  (probabilité/ROI-calibration/n) sont reproductibles exactement en SQL — mécanisme réel
  (`build-match-context.ts::loadChannelCalibration`), pas inventé par le LLM. Pas de pick
  fabriqué non plus (699 décisions `SELECTED` auditées, tous les `market`/`pick` cités hors
  correspondance directe avec un autre canal sont des cas prévus par le prompt : cote
  marché brute `ONE_X_TWO`, lectures de canaux rejetés).
- **Mais le garde-fou §4 point 3 (filtrer ONE_X_TWO/DRAW, CLEAN_SHEET, RESULT_BTTS si ratio
  < 0,85) n'est pas appliqué en prod.** `ONE_X_TWO` est aujourd'hui **35% du volume VANTAGE**
  (le marché le plus joué), DRAW à 62% de ces picks, ratio réel/annoncé **0,77**. Le
  garde-fou est décidé dans ce doc depuis le début mais jamais câblé dans le pipeline
  VANTAGE réel.
- **Calibration globale dégradée depuis fin août** : ratio 0,93 aujourd'hui (n=569,
  hitrate réel 49,2% vs annoncé 53,1%) contre le quasi-parfait 0,99 du premier check
  (08-29, n=158 — trop petit pour voir le vrai problème). `BTTS` reste bon (ratio 1,09,
  n=105) ; `OVER_UNDER` un peu sous (0,87, n=63).
- **Surconfiance concentrée en tranche 80-90% de probabilité annoncée** (écart réel/annoncé
  de 20 points, le pire de toutes les tranches) — même motif que "confiance inhabituellement
  haute" documenté dans `COUPON_ANALYSIS_TEMPLATE.md` Étape 6.
- **Détail méthodologique pour §9** : les stats de calibration sont agrégées par
  canal+compétition, jamais par pick précis (HOME/AWAY/DRAW confondus dans la même
  moyenne) — à corriger si ce mécanisme est réutilisé pour scorer le pool du générateur de
  coupon (§9) : agréger par (canal, marché, pick, ligue), pas juste (canal, compétition).

**Décidé le 2026-09-03** : câbler le garde-fou §4 point 3 dans VANTAGE est un **correctif
de prod immédiat**, indépendant du chantier générateur de coupon (§9) — un bug actif, pas
une question de conception à trancher.

**Fait le 2026-09-03** : garde-fou câblé dans `analyze-fixture.ts` (`findPoorCalibration`,
même schéma defense-in-depth que `MIN_ODDS`) — rejette en dur tout "play" sur `ONE_X_TWO`/
`DRAW`, `CLEAN_SHEET_HOME`/`CLEAN_SHEET_AWAY`, `RESULT_BTTS` si le canal correspondant a
`calibrationRatio < 0.85` avec `sampleSize >= 30` sur cette compétition — pas juste affiché
en contexte comme avant. Volontairement scopé à ces trois cas déjà mesurés (`GATED_PICKS`),
pas généralisé à tout `(market, pick)` sans audit préalable. 5 tests ajoutés, 96/96 passent,
typecheck et lint propres.

**Mécanisme trouvé — pourquoi VANTAGE surjoue le nul** (2026-09-03, sur intuition utilisateur
confirmée) : le lien n'est pas "BTTS absent → match fermé → nul" en raisonnement direct.
Quand le canal BTTS est `REJECTED` sur une fixture, DRAW représente **27,1% des verdicts
"play" de VANTAGE**, contre 17,2% quand BTTS est `SELECTED` — et ces picks DRAW-sans-BTTS
sont nettement moins bien calibrés (réel 26,9% vs annoncé 39,7%, ratio **0,68**, n=67) que
les DRAW joués quand BTTS est actif (ratio 1,03, n=48, bon). En lisant les textes réels :
**74% (111/150) de tous les picks DRAW de VANTAGE citent l'avis externe indépendant**
(`shadowPrediction`) montrant un pourcentage de nul nettement supérieur au consensus des
canaux internes — typiquement des matchs à favori domicile écrasant selon les canaux, où
l'avis externe donne un nul à 35-45%. VANTAGE traite cet écart comme une "tension
exploitable" et joue le nul. BTTS rejeté est probablement un **symptôme corrélé du même
profil de match** (favori domicile écrasant → BTTS ne se déclenche pas non plus), pas la
cause directe. **Conclusion** : VANTAGE surpondère systématiquement le désaccord "avis
externe vs consensus interne" comme signal de nul, précisément dans les cas où ce signal se
révèle peu fiable — renforce (ne remplace pas) la nécessité du garde-fou dur ci-dessus,
un ajustement de prompt seul serait plus faible qu'un vrai filtre sur un motif déjà mesuré
et répété.

### 5.9 Signal ML (`shadow_ml_by_channel`) retiré de VANTAGE (2026-09-03)

Audit demandé : le signal ML (`ModelRun.features.shadow_ml_by_channel`, produit par le
ml-worker, exposé à VANTAGE depuis le 08-30 mais restreint à DOMINANT/VALUE après un premier
audit du même jour) **améliore-t-il ou dégrade-t-il les verdicts VANTAGE** quand il est
effectivement suivi — question différente de l'audit du 30-08, qui mesurait la qualité du
signal en lui-même, pas son usage par VANTAGE.

**Résultat** : sur le canal DOMINANT (seul canal avec un n exploitable), quand VANTAGE
**suit** la correction ML (probabilité jouée qui s'écarte de >2pts de celle du canal) :
ratio réel/annoncé **0,43** (n=12, sévèrement surconfiant, 8/10 des cas identifiés perdants
à la lecture des textes). Quand il **l'ignore** : ratio **1,13** (n=15, bon). Mécanisme
confirmé par la lecture des `reasonDetails.text` (pas juste une corrélation) : 10/12 citent
explicitement la correction comme base du pari. Sur VALUE, n=1 suivi — trop petit pour
juger.

**Décidé le 2026-09-03** : retrait complet du signal ML de VANTAGE plutôt qu'un ajustement
ciblé (ex. retirer seulement DOMINANT de l'allowlist) — l'utilisateur ne maîtrise pas encore
le fonctionnement du ml-worker lui-même, donc pas de base pour juger *pourquoi* le signal
nuit ni pour le recalibrer en connaissance de cause. Supprimé : `extractShadowMl`,
`ShadowMlSignal`, `CALIBRATION_SAFE_ML_CHANNELS`, `renderShadowMlBlock`, le champ
`MatchContext.shadowMl` et toute mention dans `SYSTEM_PROMPT` (qui ne parle plus que d'un
seul avis externe indépendant, `shadow_predictions` — inchangé, pas dans le périmètre de ce
retrait). 92/92 tests passent (4 tests `extractShadowMl` retirés avec le code), typecheck et
lint propres. Ne pas réintroduire sans ré-auditer le ml-worker en profondeur d'abord.

---

## 3. Ce que l'architecture actuelle permet facilement

| Composant | Existe déjà | Effort |
|---|---|---|
| Drawer de bet slip | `components/bet-slip-drawer.tsx` — groupement par match, mode Simples/Combiné, mise, gains possibles, bouton "Parier" | **Très faible** — un bouton de plus, pas un nouvel écran |
| Suivi par canal personnalisé | `apps/backend/src/modules/subscriptions/` — sources `CHANNEL_DRAW`, `CHANNEL_BTTS`, etc. déjà définies | **Faible** — retirer le cadre mise/ROI, brancher sur la calibration déjà calculée ailleurs ; exposé côté front comme section de l'onglet Personnalisation, plus d'écran Abonnements séparé (§2ter) |
| Paramètres avec onglets | `/dashboard/params/account` — Profil (badges), Préférences (thème/langue), Sécurité, Notifications (push/email), Bankroll (devise/mise) déjà tous construits | **Faible** — ajouter un 6ᵉ onglet suit le patron existant ; nav interne à repasser d'onglets à plat à un rail latéral groupé (§2ter) |
| Onboarding | Tour passif driver.js déjà là (`domains/onboarding/onboarding-steps.ts`, 24 étapes) mais **aucune ne collecte d'input** | **Moyen** — nouveau mécanisme (modal/étapes actives), distinct du tour, à insérer avant lui |
| Coupon jouable par plusieurs utilisateurs | `bet_slip` par utilisateur, `bet_slip_item` référence un `betId` partagé — le modèle n'empêche pas N bet slips indépendants sur les mêmes jambes | **Faible**, hérite du bug P0 déjà ouvert (TODO.md) |
| Raisonnement contextuel VANTAGE | `apps/vantage-worker/src/vantage/prompt.ts` + `context/build-match-context.ts` — détection de tension entre canaux déjà en place | **Moyen** — étendre d'un raisonnement mono-pick à un coupon multi-jambes soumis par un utilisateur |
| Génération de coupon par LLM (3/jour) | N'existe pas — VANTAGE ne produit qu'un verdict par fixture | **Élevé** — nouveau prompt, nouvelle boucle, filtre de validation déterministe après coup (§4.1) |
| Suppression de VALUE/SAFE | Code isolé (`ev.constants.ts`, `POOL_EXCLUDED_CHANNELS`) | **Faible** techniquement — le vrai travail est produit (§5.1) |

---

## 4. Garde-fous non négociables (issus des bugs trouvés cette session)

1. **Aucune jambe publiée sans validation déterministe post-génération** — vérifier que
   le fixture/marché/pick/cote existent réellement en base avant publication.
2. **VANTAGE ne doit jamais inventer une probabilité** — seulement arbitrer entre des
   probabilités déjà calculées par les canaux déterministes.
3. **Filtrer les marchés où VANTAGE reste mesuré mauvais** (ONE_X_TWO/DRAW, CLEAN_SHEET,
   RESULT_BTTS — ratio réel/annoncé < 0,85) — ne pas les proposer dans les coupons.
4. **Toute source externe nouvellement branchée passe par le même filtre de
   plausibilité** que celui ajouté à `shadow-signals.ts` (rejet des splits dégénérés).
5. **Reproductibilité inchangée** : `temperature: 0`, chaque appel loggé (déjà en place).
6. **Jamais de preuve sociale fabriquée** (§2, écran retiré) — pas de compteur "N joueurs
   ont fait X" sans donnée réelle vérifiable et sans lien avec le positionnement du
   produit.

---

## 5. Points ouverts à trancher avant/pendant l'implémentation

### 5.1 Stratégie de remplacement de VALUE

Les picks **propres** à VALUE (8% de son volume, n=173) font **+14,1% ROI** contre -0,8%
pour ses doublons — seul endroit du système où une sélection ajoute de la valeur. Avant
de le retirer : soit VANTAGE reçoit la même vue "edge calibré" pour repérer ces picks
propres, soit ce signal est perdu. Décision produit, pas blocage technique.

### 5.2 Composition de coupon multi-jambes — résolu

Tranché cette session : **pas de nouvel écran de composition**. L'utilisateur compose via
le drawer de bet slip existant (§2 écran 5) ; VANTAGE ne génère de A à Z que les 3 coupons
quotidiens (Safe/Moyen/Agressif), sur un pool pré-filtré par calibration (option "B" du
chiffrage §6, pas l'option "tout le pool"). Reste à construire : le filtre de validation
déterministe après génération (§4.1). **Mise à jour 2026-09-02** : le bouton "Envoyer à
VANTAGE" et l'écran de révision (§2 écrans 5-6) passent en backlog (§0) — non implémentés
cette semaine ; la décision de principe ci-dessus reste valable, seul le calendrier change.

### 5.3 Périmètre d'Eva — résolu

Assistant Groq single-shot existant (quota 50/j), implémenté aujourd'hui côté backend comme
le module `analysis-sheet` (`apps/backend/src/modules/analysis-sheet/`) — pas de chat ni de
présence en prod sur `main` à ce jour (aucune UI Eva déployée, seule une mention
incidentelle dans `onboarding-tour-context.tsx`).

**Décidé** (déjà tranché avant cette entrée, confirmé le 2026-09-03) : Eva **ne devient pas**
une expérience personnalisée ou un chat élargi — elle reste strictement un **outil
d'export de la fiche EVCore** (l'"export 'fiche EVCore'" que `COUPON_ANALYSIS_TEMPLATE.md`
identifie déjà comme prérequis outillage à l'Étape 0 : avoir `evaluatedPicks` complet par
fixture sans dépendre d'un accès DB live à chaque analyse). Ça règle du même coup le
recoupement fonctionnel avec la personnalisation VANTAGE qui restait ouvert : il n'y a plus
de recoupement puisqu'Eva n'est plus une expérience conversationnelle/personnalisée — elle
nourrit en amont le pool déterministe du générateur de coupon (§9 point 1), pas une couche
LLM séparée. Retiré du chantier "chantier séparé" du chiffrage §6 : ce n'est plus un
chantier de personnalisation, juste un outil d'extraction, effort largement inférieur à ce
qui était chiffré pour "Grande expérience VANTAGE personnalisée" (Cas D, §6.1).

### 5.4 Historique vérifiable — ROI vs calibration (nouveau, trouvé lors de l'audit du 01-09)

La page `/dashboard/track-record` classe chaque canal "Négatif/Marge fine/Positif" **par
ROI**, pas par calibration — DRAW y est affiché "Négatif" (-8,05%) alors qu'il est un des
2 seuls canaux positifs après shrinkage dans l'audit du 22-08. C'est la page de preuve
publique du produit ; elle contredit aujourd'hui tout ce qu'on vient d'établir sur le ROI.

**Fait le 2026-09-03** : `dashboard.service.ts` (`calibrationStatus`/`calibrationRatioOf`,
mêmes seuils que le garde-fou VANTAGE §4 point 3 : ≥0,85 Fiable, ≥0,70 À surveiller, sinon
Peu fiable — `sampleSize<30` reste Échantillon insuffisant) remplace `evRoiStatus`. Le
badge de statut (`ChannelStatusBadge`) est relabellé Fiable/À surveiller/Peu fiable — plus
"Positif/Marge fine/Négatif", des libellés qui n'avaient plus de sens une fois la base de
classement changée. Le chiffre ROI reste affiché (informatif) mais n'est plus teinté par le
statut (il ne le décrit plus) — une nouvelle colonne "Calibration" (teintée) porte le
ratio réel/annoncé qui pilote réellement le badge. 3 tests de régression ajoutés
(dont le cas DRAW exact : ROI négatif + calibration ≥0,85 → Fiable), typecheck et lint
propres des deux apps.

### 5.5 Gate du chat Business (Inbox)

Confirmé accessible à tout compte lambda sans entitlement (business-model.md §7.4/§8
l'avait déjà noté). **Décision actée le 2026-09-02 : pas de gate pour l'instant, tout
reste gratuit** — à reprendre quand la V1 de cette refonte sera stable.

### 5.6 Badge CONSENSUS — recalibrer avant de trancher garder/retirer

Soulevé pendant cette session (§2 point 2 initial) : le badge "CONSENSUS" affiché en tête de
carte Decisions n'a jamais été confirmé fiable — dernière mesure connue (mémoire de session)
: CONSENSUS à -55% ROI/14j, DOMINANT à -17% lifetime. **Décidé le 2026-09-02** : avant de
décider si le badge reste affiché tel quel, est retiré, ou porte son propre indicateur de
confiance comme les autres picks (badge Fiable/À confirmer/Peu fiable, §2 point 2) — on
**recalibre** (ratio réel/annoncé + n, sur données fraîches, jamais le ROI seul — cf.
`feedback_admission_par_calibration`) pour voir si CONSENSUS mérite d'être gardé du tout
comme signal affiché à l'utilisateur. Pas de changement UI avant ce recalibrage.

**Recalibré et fait le 2026-09-03** : ratio réel/annoncé **0,74** lifetime (n=412, déjà sous
le seuil 0,85) ; **0,18** sur son dernier vrai lot avant que sa sélection ne devienne quasi
nulle (n=30, réel 13,3% vs annoncé 72,6%) — cohérent avec une cause déjà connue et
documentée dans le code (`decision-helpers.ts`) : sa probabilité annoncée, le maximum des
canaux d'accord, était biaisée vers le haut par construction, raison pour laquelle CONSENSUS
n'émet quasiment plus de sélection depuis le 2026-08-22 (29 `SELECTED` contre 3783
`REJECTED` depuis). Aucun cas où le signal se défend. **Badge retiré**, pas neutralisé :
`ConsensusBadge`, `hasConsensus`, `consensusChannels` supprimés de
`apps/web/app/dashboard/decisions/components/` (match-card.tsx, decision-helpers.ts) —
plus de trace du méta-canal CONSENSUS dans l'UI Decisions. Typecheck et lint propres.

### 5.7 Profil de risque et canaux suivis — usage personnalisé en backlog post-paiement

Le profil de risque collecté à l'onboarding (§0 point 6, écran 9) et le suivi de canaux
(§2ter) sont capturés dès maintenant, mais **tout usage personnalisé de ces données** (ex.
mettre en avant tel coupon quotidien Safe/Moyen/Agressif selon le profil de risque de
l'utilisateur, ou adapter l'expérience VANTAGE selon les canaux suivis) est **différé
jusqu'après la mise en place du gate de paiement** — même logique de séquencement que
§2sexies (build sans revenu en face = mauvais ordre). La donnée est collectée dès
l'onboarding pour être disponible le jour venu ; elle n'est pas exploitée avant.

---

## 6. Estimation du coût LLM

**Hypothèses de base** (ordres de grandeur pour cadrer une décision, pas un budget
contractuel) :

- Modèle : `gpt-oss-120b`, déjà en place (`apps/vantage-worker/src/config.ts`).
- Tarifs vérifiés au 2026-09-01 :
  - **Cerebras** (fournisseur principal recommandé) : $0,35/M tokens entrée, $0,75/M
    sortie. [Source](https://www.morphllm.com/cerebras-pricing)
  - **Groq** (fallback, capacité limitée) : $0,15/M entrée, $0,60/M sortie.
    [Source](https://www.cloudzero.com/blog/groq-pricing/)
  - Chiffres ci-dessous sur tarif **Cerebras** (plus prudent) — diviser par ~2 sur Groq.
- Volume de fixtures analysées : ~120 à 440/jour (moyenne ~280) — on retient **300/jour**.

### 6.1 Par cas d'usage

| Cas d'usage | Volume/jour | Tokens entrée | Tokens sortie | Coût/jour | Coût/mois |
|---|---|---|---|---|---|
| **A. Verdict par fixture** (Arbitrage, inchangé) | 300 | ~5 000 | ~300 | $0,59 | **~$18** |
| **B. Génération de 3 coupons/jour** (pool pré-filtré, §5.2 tranché) | 3 | ~15 000 | ~750 | $0,017 | **~$0,5** |
| **C. Révision de coupon utilisateur** (déclenchée depuis le drawer, écran 5-6) | 50 / 300 / 1 500 (scénarios) | ~6 000 | ~500 | $0,0025/appel | **~$3,75 / $22,5 / $112,5** |
| **D. "Grande expérience" VANTAGE personnalisée** (distincte d'Eva — §5.3 résolu, Eva reste un outil d'export ; D différé post-paiement, §2sexies) | 300 / 3 000 (100 ou 1 000 users actifs × 3/j) | ~3 000 | ~500 | $0,0014/appel | **~$13 / $129** |

### 6.2 Total indicatif mensuel

| Scénario | A | B | C | D | **Total** |
|---|---|---|---|---|---|
| **Lancement** (adoption faible) | $18 | $0,5 | $3,75 | $0 (différé, §2sexies) | **~$22/mois** |
| **Traction modérée** | $18 | $0,5 | $22,5 | $0 (différé, §2sexies) | **~$41/mois** |
| **Adoption large** | $18 | $0,5 | $112,5 | $129 (une fois le gate de paiement en place) | **~$260/mois** |

**Lecture** : le coût fixe (verdicts + génération de coupon) reste marginal (<$20/mois)
quel que soit le volume de matchs couverts. Le vrai poste variable dépend entièrement de
l'adoption utilisateur (révision de coupon, expérience personnalisée), pas de l'ambition
du produit. Instrumenter le comptage de tokens réel dès la mise en prod plutôt que de
figer un budget sur ces estimations.

**Non inclus** : coût de recherche web (Tavily, déjà câblé en prod) — à chiffrer une fois
le volume de fixtures avec recherche activée connu.

---

## 7. Vérifications faites cette session sur les pages lambda réelles

Un compte "Membre" a été créé et toutes les pages accessibles à un utilisateur lambda ont
été visitées via Playwright (screenshots dans `pw-audit/`, non versionnés) pour ancrer le
design sur le vrai produit plutôt que sur une supposition :

- **Confirmé admin-only, pas un gap côté lambda** : Performance, Audit, Users, ML,
  Reports, Engine, Announcements (redirection vers `/dashboard`).
- **Formation** : contenu pédagogique déjà écrit et solide ("Cote, probabilité implicite,
  probabilité calibrée", "L'edge et l'EV"...) — ce que business-model.md donnait comme
  manquant a été fait depuis. Rien à corriger.
- **Bankroll** (`/dashboard/bankroll`) : solde/dépôts/historique, fonctionne bien. Un seul
  point de nommage : l'onglet "Bankroll" dans Paramètres (devise, mise par unité) porte le
  même nom que cette page — à renommer un jour ("Mise & devise") pour éviter la confusion,
  pas urgent.
- **Matchs** (`/dashboard/fixtures`) : conservé dans la nav à la demande explicite de
  l'utilisateur ("pour ceux qui veulent aller en profondeur") — pas de changement.
- **Historique vérifiable** : voir §5.4, correction ROI→calibration à planifier après
  cette V1.
- **Inbox** : voir §5.5, gate différé.

---

## 8. Discipline de vérification

Chaque étape du plan §0 doit repasser par le même protocole que cette session : mesurer
avant/après sur données réelles (calibration ratio + n, jamais ROI ponctuel), et pour tout
écran, comparer au produit réel via Playwright avant de considérer une maquette "prête" —
c'est comme ça qu'on a trouvé le décalage Par-match/Par-canal, la ligne de filtre cassée,
et le doublon du bouton "Ajouter à mon bet slip" sur l'écran retiré (§2).

---

## 9. Générateur de coupon VANTAGE — comment garantir la qualité (2026-09-03)

Point de départ : `COUPON_ANALYSIS_TEMPLATE.md` (v1, 2026-08-12) documente une méthode
manuelle d'analyse de coupon, écrite après plusieurs post-mortems de coupons cassés. Un
essai antérieur de la faire suivre telle quelle par un LLM en une seule passe n'a pas donné
de bon résultat. Presque tous les bugs que le template documente sont des défauts que
n'importe quel LLM reproduit par construction sur ce type de tâche : trier/filtrer des
centaines de lignes chiffrées de façon fiable, appliquer une même règle arithmétique
partout (`lambdaHome+lambdaAway < 2.3` sur *toutes* les lignes `UNDER_X_5`, pas juste 2,5),
ne pas se laisser aimanter par une cote cible, ne pas sur-pondérer une probabilité "trop
belle" (confirmé en prod sur VANTAGE lui-même, §5.8).

**Principe directeur, cohérent avec le 70% déterministe / 30% LLM de CLAUDE.md** : ne
jamais laisser le LLM faire l'Étape 0 du template (tri quantitatif) lui-même — c'est du
code, pas un prompt.

1. **Pool réduit calculé en amont, déterministe, pas par le LLM** — un job qui parcourt
   `evaluatedPicks` en entier (pas seulement `selectedPicks`/`candidatePicks` top-5),
   applique tous les garde-fous que le template a dû découvrir à la main (lambda total sur
   toutes les lignes Under, pas juste 2,5 ; exclusion totale `avoidFlag` ; plafond EV
   corrigé ~0,35 ; tiers A/B/C/D à jour depuis TODO.md ; **et le garde-fou §4.3 réellement
   câblé**, cf. §5.8), et sort un pool de ~30-50 candidats déjà scorés selon les deux modes
   du template (Fiabilité et Valeur).
2. **VANTAGE ne reçoit que ce pool réduit**, pour la seule Étape 2 (synthèse qualitative) :
   cohérence narrative sur les matchs à enjeu, pas de lecture contradictoire entre deux
   jambes du même scénario, diversification des clusters de risque corrélé, merge
   Fiabilité+Valeur (ancres 70-90% + jambes EV 60-75%) — un jugement borné sur un petit
   ensemble, ce que le LLM fait réellement bien.
3. **Jamais de cote cible en entrée** — Safe/Moyen/Agressif définis par la composition de
   risque (mix de tiers, bande de probabilité jointe), jamais par une fourchette de cote
   combinée visée (biais identifié Étape 3 du template).
4. **Validation déterministe post-génération, pas auto-vérification du LLM** — recalculer
   la probabilité jointe, revérifier chaque jambe contre les mêmes garde-fous du point 1,
   rejeter/régénérer si violation. Déjà noté comme garde-fou §4 point 1 ; à coder
   littéralement comme la checklist finale du template, pas laissé à la mémoire du LLM.
5. **Le biais "ligue à réputation offensive" doit être une donnée, pas une connaissance
   implicite du LLM** — calculer un tag `leagueGoalsReputation` depuis l'historique
   buts/match déjà en base plutôt que compter sur la culture football du LLM (risque
   d'hallucination sinon) — cf. template, Championship/2.Bundesliga/Eredivisie.
6. **Le post-mortem doit boucler vers le code, pas rester en conversation** — un motif
   réutilisable trouvé sur un coupon cassé (comme le bug `under_high_lambda` qui ne
   couvrait qu'une ligne) devient un garde-fou permanent au point 1, jamais juste une note
   pour la prochaine session manuelle.
7. **Agréger les stats de calibration par (canal, marché, pick, ligue), jamais juste
   (canal, compétition)** — cf. le détail méthodologique trouvé en §5.8 : le mécanisme
   `loadChannelCalibration` actuel confond HOME/AWAY/DRAW dans la même moyenne, ce qui
   biaiserait le score du pool si réutilisé tel quel pour le générateur de coupon.

**Statut** : idée et architecture actées dans ce doc, à date la plus solide dont on dispose
avant de démarrer le chantier (§0 point 7, "le plus lourd, à ne démarrer qu'une fois 1-6
stabilisés et le pool de canaux filtré"). Aucune implémentation commencée.
