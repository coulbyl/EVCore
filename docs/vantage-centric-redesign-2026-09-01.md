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

| Axe                            | Avant                                                                                                                          | Après                                                                                                                                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Navigation                     | Dashboard, Investir, Coupon Composer, Decisions, Arbitrage, Abonnements, Notifications, Annonces séparées                      | Dashboard épuré, groupe "Aujourd'hui" réordonné **Coupons → Arbitrage → Decisions → Matchs** (2026-09-04, Coupons en tête + bouton central surélevé mobile), **Notifications** fusionnée — Investir, Coupon Composer, **Abonnements** et Annonces supprimés de la nav                     |
| Génération de coupon           | Moteur déterministe (`coupon` module), `topN` sur canaux non filtrés par calibration                                           | **VANTAGE génère les 3 coupons quotidiens** (Safe/Moyen/Agressif) sur un pool pré-filtré par calibration                                                                                                                                                                                   |
| Coupon personnel               | Aucun mécanisme dédié                                                                                                          | L'utilisateur compose via le **drawer de bet slip existant** (rien de neuf) ; le bouton "Envoyer à VANTAGE" + l'écran de révision sont maquettés mais **en backlog** (§0, §5.2)                                                                                                            |
| VALUE / SAFE                   | Deux canaux de filtrage Phase 2 (edge / probabilité+EV)                                                                        | **Déconnectés de la pipeline live** (§5.1 résolu, 2026-09-03) — continuent de tourner pour observation, plus d'effet côté utilisateur (bet interne, Decisions, abonnements)                                                                                                                |
| Personnalisation + Abonnements | Deux endroits séparés : gamification (Paramètres → Profil) et Abonnements (portefeuille simulé mise/ROI) en item de nav propre | **Fusionnés** (2026-09-02, §2bis) : un **6ᵉ onglet "Personnalisation"** dans Paramètres regroupe ligues, canaux suivis + calibration (ex-Abonnements, "Découvrir des canaux" inclus), profil de risque — plus d'item de nav séparé — + un **onboarding actif en 3 étapes** à l'inscription |
| Paramètres — navigation        | Onglets à plat (Profil/Préférences/Sécurité/Notifications/Bankroll/Personnalisation)                                           | **Rail latéral groupé par thème** (2026-09-02, §2bis) : Compte (Profil, Sécurité) / Préférences (Préférences, Bankroll, Notifications) / Paris (Personnalisation)                                                                                                                          |
| Bet slip                       | Un coupon = une transaction                                                                                                    | Un coupon généré par VANTAGE est un **template partagé** : N utilisateurs l'ajoutent chacun à leur bet slip, chacun sa mise — déjà supporté par le schéma (`bet_slip`/`bet_slip_item`), sans écran dédié (pas de fausse preuve sociale, voir §5.4)                                         |

---

## 2. Les 10 écrans de la maquette — statut et travail associé

Lien : https://claude.ai/code/artifact/6468e339-5d32-45b0-b14e-89df315730bb — chaque écran a
désormais sa variante mobile (390px) juste à côté du desktop sur le canvas.

| #    | Écran               | Ce qui change vs l'app réelle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Backend à toucher                                           |
| ---- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1    | Dashboard (Accueil) | Épuré, plus de lien Investir/Combinés dans le hero                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Aucun                                                       |
| 2    | Decisions           | **Fait (2026-09-04)** : ligne de pick simplifiée — badge de code canal retiré (nom de marché en clair seul), edge/EV brut remplacé par un badge de fiabilité réel (Fiable/À surveiller/Peu fiable, calibration par canal×compétition, HoverCard tap-friendly, masqué si échantillon insuffisant plutôt que d'afficher un badge sans signal), carte plafonnée à 4 picks triés par probabilité + "Voir N autres marchés" (repliable). "Par match"/"Par canal" fusionnés en un sélecteur canal à sélection unique. **Filtre ligues/canaux** : pas un tiroir de facettes au final (idée abandonnée en cours de route, §2bis obsolète sur ce point) — deux boutons popover à sélection unique (Ligue/Canal), même pattern que le rail mobile Personnalisation, filtrage réellement poussé au backend (`GET /channel-decisions/facets`) | Aucun (front only)                                          |
| 3    | Arbitrage           | **Fait (2026-09-04)** : KPI "lectures/tensions" retirés de l'en-tête ; mêmes boutons popover à sélection unique que Decisions pour Ligue et pour le verdict (Toutes/Recommandé/Sans avis, ex-"À éviter" — renommé, un no-play ne veut pas dire "évitez ce match") ; badge de fiabilité VANTAGE ajouté par compétition ; cotes VANTAGE désormais réelles (persistées à la génération, `persist-decision.ts`) au lieu d'un emprunt à un canal voisin qui échouait sur les picks où VANTAGE diverge (son cas d'usage principal)                                                                                                                                                                                                                                                                                                      | Aucun (front only, + vantage-worker)                        |
| 4    | Coupons             | Page sœur d'Arbitrage, coupons du jour générés par VANTAGE (§9, pipeline LLM en prod depuis le 09-03) ; nav renommée "Combinés"→"Coupons" (2026-09-04) ; même retrait du badge de canal redondant sur chaque jambe (2026-09-04, `components/coupon-card.tsx`) ; bouton "Jouer ce coupon" câblé au bet slip (2026-09-04, voir section dédiée plus bas) ; bandeau "Envoyer à VANTAGE"/compteur "N joueurs ont ajouté" de la maquette délibérément pas construits — aucun mécanisme réel derrière (le premier reste backlog §0/ligne 5, le second n'a jamais existé)                                                                                                                                                                                                                                                                                                                                                         | §0 point 7 (fait, §9), `modelRunId` sur `CouponLegDto` (fait) |
| 5    | Drawer de bet slip  | Un bouton "Envoyer à VANTAGE" ajouté à l'existant (`bet-slip-drawer.tsx`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | **Backlog** (§0) — maquetté, pas d'implémentation immédiate |
| 6    | Révision VANTAGE    | Refaite en liste unique (plus de doublon jambe×2), carte verdict en tête, comparaison avant/après                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | **Backlog** (§0) — maquetté, pas d'implémentation immédiate |
| 7    | Notifications       | Fusion Notifications + Annonces, filtrable par type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Fusion des deux modèles de données ou vue unifiée           |
| 7bis | ~~Abonnements~~     | **Supprimé en tant qu'écran/nav** (2026-09-02, §2bis) — fusionné dans l'onglet Personnalisation (8) comme section "Canaux suivis" (calibration par canal + "Découvrir des canaux")                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | —                                                           |
| 8    | Personnalisation    | Nouvel onglet dans Paramètres réel, pas un nouveau menu ; absorbe désormais le contenu d'Abonnements (7bis, §2bis) ; **Paramètres passe d'onglets à plat à un rail latéral groupé** (Compte / Préférences / Paris, §2bis)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Nouveaux champs `User` (ligues, canaux, profil de risque)   |
| 9    | Onboarding          | 3 étapes actives (ligues/canaux/risque) avant le tour passif                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Réutilise les endpoints de (8)                              |

**Écran retiré du périmètre** : un "Coupon partagé" en détail avec aperçu communautaire
avait été maquetté puis retiré — il dupliquait le CTA déjà présent sur la carte Coupons et
affichait une forme de preuve sociale fabriquée (contraire à business-model.md : _"un pitch
qui s'appuierait sur nos utilisateurs serait fabriqué"_). Le mécanisme "un coupon, N
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

**Implémenté le 2026-09-03** : migration `RiskProfile` (`CONSERVATIVE`/`BALANCED`/
`AGGRESSIVE`, valeurs DB en anglais — convention CLAUDE.md) sur `User`, tables
`UserFollowedChannel`/`UserFollowedLeague` (remplacent Subscription/SubscriptionEvent,
supprimées le même jour avec accord explicite de perte des 3 lignes/153 events réels).
Backend : module `personalization`
(`GET /personalization`, `GET /personalization/leagues/catalog`,
`POST`/`DELETE /personalization/leagues/:code`, `GET /personalization/channels/discover`,
`POST`/`DELETE /personalization/channels/:channel`), `riskProfile` sur
`PATCH /auth/me` (même pattern que `unitMode`/`theme`). Canaux éligibles au suivi =
`POOL_ELIGIBLE_CHANNELS` (analysis-core) — exclut VALUE/SAFE et
CONSENSUS/CONTRARIAN/AVOID/VANTAGE, conforme §2quater. Frontend : 3 cartes dans le
nouvel onglet Personnalisation (groupe "Paris" du rail), libellés de canal réutilisant
`decisions.channels.<code>.label` (déjà en place, satisfait §2quater sans nouveau
mapping).

**Point ouvert (2026-09-03, à trancher plus tard)** : le profil de risque doit-il être
**inclusif** (un profil Offensif verrait aussi les coupons Prudent/Équilibré, comme un
plafond plutôt qu'une catégorie exclusive) plutôt qu'une simple étiquette à 3 valeurs
disjointes ? Noté ici pour discussion — **pas encore tranché, aucun comportement basé
là-dessus n'existe encore** (le profil n'est pour l'instant qu'une préférence stockée,
rien ne le consomme côté composition de coupon).

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

| Code interne          | Libellé UI proposé          |
| --------------------- | --------------------------- |
| `DOMINANT`            | Résultat favori             |
| `GOALS`               | Total de buts               |
| `BTTS`                | Les deux équipes marquent   |
| `DOUBLE_CHANCE`       | Double chance               |
| `TEAM_TOTAL`          | Buts par équipe             |
| `CLEAN_SHEET`         | Garde sa cage               |
| `FIRST_HALF`          | Résultat 1ère mi-temps      |
| `OVER_UNDER_HT`       | Buts en 1ère mi-temps       |
| `HALF_TIME_FULL_TIME` | Mi-temps / Fin de match     |
| `WIN_EITHER_HALF`     | Gagne au moins une mi-temps |
| `DRAW`                | Match nul                   |
| `CORRECT_SCORE`       | Score exact                 |

`VALUE`/`SAFE` (filtres Phase-2, en cours de retrait §5.1) et `CONSENSUS`/`CONTRARIAN`/
`AVOID` (méta-canaux Phase-3 sans pick propre, déjà exclus du tiroir de filtres §2bis point 5) ne sont de toute façon pas censés apparaître comme "canal à suivre" pour un utilisateur
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
le fonctionnement du ml-worker lui-même, donc pas de base pour juger _pourquoi_ le signal
nuit ni pour le recalibrer en connaissance de cause. Supprimé : `extractShadowMl`,
`ShadowMlSignal`, `CALIBRATION_SAFE_ML_CHANNELS`, `renderShadowMlBlock`, le champ
`MatchContext.shadowMl` et toute mention dans `SYSTEM_PROMPT` (qui ne parle plus que d'un
seul avis externe indépendant, `shadow_predictions` — inchangé, pas dans le périmètre de ce
retrait). 92/92 tests passent (4 tests `extractShadowMl` retirés avec le code), typecheck et
lint propres. Ne pas réintroduire sans ré-auditer le ml-worker en profondeur d'abord.

---

## 3. Ce que l'architecture actuelle permet facilement

| Composant                                 | Existe déjà                                                                                                                                                  | Effort                                                                                                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drawer de bet slip                        | `components/bet-slip-drawer.tsx` — groupement par match, mode Simples/Combiné, mise, gains possibles, bouton "Parier"                                        | **Très faible** — un bouton de plus, pas un nouvel écran                                                                                                                                           |
| Suivi par canal personnalisé              | `apps/backend/src/modules/subscriptions/` — sources `CHANNEL_DRAW`, `CHANNEL_BTTS`, etc. déjà définies                                                       | **Faible** — retirer le cadre mise/ROI, brancher sur la calibration déjà calculée ailleurs ; exposé côté front comme section de l'onglet Personnalisation, plus d'écran Abonnements séparé (§2ter) |
| Paramètres avec onglets                   | `/dashboard/params/account` — Profil (badges), Préférences (thème/langue), Sécurité, Notifications (push/email), Bankroll (devise/mise) déjà tous construits | **Faible** — ajouter un 6ᵉ onglet suit le patron existant ; nav interne à repasser d'onglets à plat à un rail latéral groupé (§2ter)                                                               |
| Onboarding                                | Tour passif driver.js déjà là (`domains/onboarding/onboarding-steps.ts`, 24 étapes) mais **aucune ne collecte d'input**                                      | **Moyen** — nouveau mécanisme (modal/étapes actives), distinct du tour, à insérer avant lui                                                                                                        |
| Coupon jouable par plusieurs utilisateurs | `bet_slip` par utilisateur, `bet_slip_item` référence un `betId` partagé — le modèle n'empêche pas N bet slips indépendants sur les mêmes jambes             | **Faible**, hérite du bug P0 déjà ouvert (TODO.md)                                                                                                                                                 |
| Raisonnement contextuel VANTAGE           | `apps/vantage-worker/src/vantage/prompt.ts` + `context/build-match-context.ts` — détection de tension entre canaux déjà en place                             | **Moyen** — étendre d'un raisonnement mono-pick à un coupon multi-jambes soumis par un utilisateur                                                                                                 |
| Génération de coupon par LLM (3/jour)     | N'existe pas — VANTAGE ne produit qu'un verdict par fixture                                                                                                  | **Élevé** — nouveau prompt, nouvelle boucle, filtre de validation déterministe après coup (§4.1)                                                                                                   |
| Suppression de VALUE/SAFE                 | Code isolé (`ev.constants.ts`, `POOL_EXCLUDED_CHANNELS`)                                                                                                     | **Faible** techniquement — le vrai travail est produit (§5.1)                                                                                                                                      |

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

### 5.1 Stratégie de remplacement de VALUE — résolu

Les picks **propres** à VALUE (8% de son volume, n=173) faisaient **+14,1% ROI** contre
-0,8% pour ses doublons dans l'audit du 22-08 (`docs/audit-canaux-investir-2026-08-22.md`
§2.3, ratio de calibration 0,845 vs 0,721) — seul endroit du système où une sélection
semblait ajouter de la valeur. L'audit notait lui-même : "n=173 ne suffit pas, il faut un
backtest dédié — à valider avant de shipper".

**Recalibré le 2026-09-03** : sur un échantillon direct ~10x plus grand (n≈1822 réglés,
même définition doublon/propre — marché+pick+probabilité à 4 décimales, vs canaux Phase 1),
l'écart ne tient plus : ratio 0,69 pour les picks propres, quasi identique aux doublons
(0,68). Pas une reproduction stricte de la méthode originale (l'audit venait de 5 passes de
backtest replay, pas d'une lecture directe de `channel_selection`), mais un signal cohérent
avec le motif déjà observé partout cette session : un effet à petit n qui ne survit pas à
plus de données.

**Décidé le 2026-09-03** : ni l'option A (donner à VANTAGE une vue "edge calibré" pour
préserver ce signal) ni une suppression pure — **VALUE et SAFE sont déconnectés de la
pipeline live**, pas supprimés : ils continuent de produire des `channel_decision`/
`channel_selection` (observation), mais n'ont plus aucun effet côté utilisateur/produit.
Concrètement :

- `persistChannelBet` (bookkeeping interne `bet`, déjà redondant avec `channel_selection`
  pour le calibrage — voir commentaire `dashboard.service.ts`) retiré pour VALUE et SAFE
  dans `betting-engine.service.ts`, aux deux points d'appel. Aucun impact réel : ces `bet`
  avaient `userId: null`, jamais de bankroll touché (confirmé avant modification).
- VALUE/SAFE retirés de l'affichage Decisions (`isExcludedFromDecisions`, même mécanisme
  déjà utilisé pour VANTAGE/Arbitrage).
- `CHANNEL_VALUE` retiré des abonnements proposables (`retired: true`, même traitement que
  `CHANNEL_SAFE` depuis le 22-08) — l'abonné existant garde son abonnement actif.
- Restent visibles, volontairement : le pool de coupon les excluait déjà
  (`POOL_EXCLUDED_CHANNELS`, depuis le 22-08) ; Track Record et le bandeau admin du
  dashboard (`ChannelStatusStrip`, admin-only) continuent de les afficher — c'est
  précisément l'outil d'observation demandé.

**Trouvé au passage, noté pour plus tard (pas corrigé maintenant)** : le garde-fou de
suspension automatique de marché que CLAUDE.md documente ("ROI < -15% sur 50+ paris")
existe en code (`apps/backend/src/modules/risk/risk.service.ts`) mais n'est **jamais
invoqué automatiquement** — aucun cron/worker ne l'appelle, seul un endpoint manuel existe.
Même motif que le garde-fou de calibration VANTAGE trouvé décidé-mais-pas-câblé (§5.8). En
plus, il est indexé par marché seul, pas par canal — même câblé, il ne pourrait pas isoler
un canal précis. À reprendre séparément.

### 5.2 Composition de coupon multi-jambes — résolu

Tranché cette session : **pas de nouvel écran de composition**. L'utilisateur compose via
le drawer de bet slip existant (§2 écran 5) ; VANTAGE ne génère de A à Z que les 3 coupons
quotidiens (Safe/Moyen/Agressif), sur un pool pré-filtré par calibration (option "B" du
chiffrage §6, pas l'option "tout le pool"). Reste à construire : le filtre de validation
déterministe après génération (§4.1). **Mise à jour 2026-09-02** : le bouton "Envoyer à
VANTAGE" et l'écran de révision (§2 écrans 5-6) passent en backlog (§0) — non implémentés
cette semaine ; la décision de principe ci-dessus reste valable, seul le calendrier change.

### 5.3 Périmètre d'Eva — résolu

Ex-assistant Groq single-shot (quota 50/j) — **déjà retiré** avant cette entrée (commit
`da3d2370`, "remove the Eva LLM analyze surface, keep export") : client Groq, prompt,
parseur de coupons LLM et rate-limiter de quota tous supprimés. Le module
`analysis-sheet` (`apps/backend/src/modules/analysis-sheet/`) ne fait aujourd'hui **que**
de l'export de données (`exportJson`/`exportTxt`, aucun appel LLM) — vérifié le 2026-09-03
par un grep complet sur `apps/backend/src` : zéro trace de Groq/Anthropic/OpenAI dans tout
le backend. Cohérent avec la règle actée le même jour : **le backend est LLM-agnostic,
tout le LLM vit dans `apps/vantage-worker`** — cette règle est déjà satisfaite aujourd'hui,
rien à corriger.

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

| Cas d'usage                                                                                                                                       | Volume/jour                                   | Tokens entrée | Tokens sortie | Coût/jour     | Coût/mois                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------- | ------------- | ------------- | --------------------------- |
| **A. Verdict par fixture** (Arbitrage, inchangé)                                                                                                  | 300                                           | ~5 000        | ~300          | $0,59         | **~$18**                    |
| **B. Génération de 3 coupons/jour** (pool pré-filtré, §5.2 tranché)                                                                               | 3                                             | ~15 000       | ~750          | $0,017        | **~$0,5**                   |
| **C. Révision de coupon utilisateur** (déclenchée depuis le drawer, écran 5-6)                                                                    | 50 / 300 / 1 500 (scénarios)                  | ~6 000        | ~500          | $0,0025/appel | **~$3,75 / $22,5 / $112,5** |
| **D. "Grande expérience" VANTAGE personnalisée** (distincte d'Eva — §5.3 résolu, Eva reste un outil d'export ; D différé post-paiement, §2sexies) | 300 / 3 000 (100 ou 1 000 users actifs × 3/j) | ~3 000        | ~500          | $0,0014/appel | **~$13 / $129**             |

### 6.2 Total indicatif mensuel

| Scénario                        | A   | B    | C      | D                                            | **Total**      |
| ------------------------------- | --- | ---- | ------ | -------------------------------------------- | -------------- |
| **Lancement** (adoption faible) | $18 | $0,5 | $3,75  | $0 (différé, §2sexies)                       | **~$22/mois**  |
| **Traction modérée**            | $18 | $0,5 | $22,5  | $0 (différé, §2sexies)                       | **~$41/mois**  |
| **Adoption large**              | $18 | $0,5 | $112,5 | $129 (une fois le gate de paiement en place) | **~$260/mois** |

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
partout (`lambdaHome+lambdaAway < 2.3` sur _toutes_ les lignes `UNDER_X_5`, pas juste 2,5),
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

**Statut** : idée et architecture actées dans ce doc. Implémentation démarrée le 2026-09-03
(voir §9bis) — pas encore committé, l'utilisateur committe lui-même sur ce chantier.

## 9bis. Premiers pas d'implémentation (2026-09-03, pas committé)

**Découverte en explorant le code avant d'écrire quoi que ce soit** : l'essentiel du point 1
(pool déterministe) existait déjà dans `apps/backend/src/modules/coupon/` — pas besoin d'un
service parallèle. `getPoolForRange` (élargi via `resolveEvaluatedMarketLeg`,
`opts.includeEvaluatedMarkets`) lit déjà `evaluatedPicks` bruts par fixture, mappe
marché→canal, applique AVOID et une correction de fiabilité par canal (courbes de Platt,
`calibrateLegProbability`) — plus rigoureuse que le système de tiers A/B/C/D du template
(jamais codifié, prose seule). Le check `under_high_lambda` que le template signalait comme
trou (ne couvrait que la ligne 2,5) est déjà corrigé dans `pick-validation.ts`.

**Le vrai trou** : `resolveEvaluatedMarketLeg` n'admettait que les picks `'viable'` — jamais
ceux rejetés pour raison EV/cote seule (`ev_below_threshold` etc.), alors que le template dit
explicitement qu'un tel rejet n'est pas un rejet de fiabilité pour un combiné. **Fait** :
paramètre `includeEvRejected` ajouté (off par défaut, zéro impact sur le pipeline réel), admet
un pick EV/cote-rejeté tout en excluant toujours les rejets de fiabilité
(`RELIABILITY_REJECTION_REASONS` : `probability_too_low`, `quality_score_below_threshold`,
`under_high_lambda`, `market_suspended`). Chaque candidat porte `wasViable` pour tracer si le
système l'a validé. 24 tests, typecheck/lint propres.

**Renommage + nettoyage** (demandé par l'utilisateur en voyant `SignalWindowService`) : le nom
était un fossile — la classe calculait à l'origine un vrai "signal sur fenêtre glissante de
38 jours" (`signalScore`), mesuré anti-prédictif et entièrement retiré le 2026-08-22 ; il ne
restait que l'assemblage de pool + une courbe de calibration, aucun "signal"/"fenêtre" ne
survivait. Risque identifié : un nom trompeur peut faire raisonner un LLM (ou un humain) sur
un mécanisme qui n'existe plus. **Renommé** `SignalWindowService` → `CouponPoolService`
(`signal-window.service.ts` → `coupon-pool.service.ts`, 10 fichiers touchés). **Nettoyé** en
même temps (audit préalable pour confirmer mort avant suppression) : `getTodayPool` (wrapper
inutilisé), `getTodayVirtualPool` et toute la machinerie du pool virtuel
(`VIRTUAL_COUPON_RULES`/`VIRTUAL_COUPON_TOP_LIMITS`/`VirtualCouponChannel`, zéro appelant nulle
part), et des constantes mortes dans `coupon.constants.ts` (`BTTS_STAKED_LEAGUES`,
`CANAL_BASE_WEIGHT`/`DEFAULT_CANAL_BASE_WEIGHT`, `LEGACY_MIN_LEG_PROBABILITY`,
`MAX_POOL_PER_COMPETITION` — ce dernier avec un test qui vérifiait un comportement déjà retiré
du composeur, corrigé). 727/727 tests backend, typecheck et lint propres.

**Question soulevée, pas encore construite** : donner à l'étape LLM (point 2-3) accès au
verdict VANTAGE déjà calculé par fixture (`ChannelDecision.channel='VANTAGE'`), pour éviter de
lui faire ré-analyser chaque match à zéro — VANTAGE fait déjà la synthèse qualitative
(tension entre canaux) que le LLM du coupon devrait faire. Pas un second avis vraiment
indépendant (mêmes canaux déterministes en amont) : à traiter comme contexte informatif,
jamais comme filtre d'inclusion/exclusion. Se branche au point 2, pas encore fait.

**Principe d'architecture décidé le 2026-09-03 : le backend est LLM-agnostic, tout le LLM
vit dans `apps/vantage-worker`.** Déjà satisfait aujourd'hui (voir §5.3 — le seul ex-appel
LLM du backend, `analysis-sheet`/Eva, était déjà retiré). S'applique au générateur de
coupon : l'appel LLM lui-même doit vivre dans `apps/vantage-worker` (réutilise son client
Groq et ses patterns de prompt/garde-fous déjà rodés), jamais dans `apps/backend`. Ce que
`apps/backend` expose reste déterministe : le pool candidat, les prédicats de garde-fou et
l'application d'une courbe de calibration déjà calculée — la partie pure de tout ça devrait
migrer vers `packages/analysis-core` (déjà importé par les deux apps aujourd'hui) pour être
appelable depuis `vantage-worker` sans dupliquer la logique ni faire dépendre
`vantage-worker` du NestJS de `apps/backend`.

**Extraction démarrée le 2026-09-03** (`packages/analysis-core/src/coupon/`, nouveau
répertoire) :

- `channel-reliability.ts` — courbes de Platt (`fitReliability`, `applyReliability`,
  `shrinkTowardPooled`) déplacées telles quelles depuis
  `apps/backend/src/modules/adjustment/`, 5 appelants backend redirigés vers
  `@evcore/analysis-core`. Collision de nom trouvée et résolue : `logit`/`sigmoid`
  existaient déjà (version `Decimal`, autre calcul) — renommés `plattLogit`/`plattSigmoid`
  ici.
- `evaluated-market-leg.ts` — `resolveEvaluatedMarketLeg`, `EVALUATED_MARKET_CANAL`,
  `RELIABILITY_REJECTION_REASONS`, `isExtremeDivergence`, `classifyAvoidSignal` déplacés
  depuis `coupon-pool.service.ts`/`coupon.constants.ts`. Type d'entrée local
  `EvaluatedMarketPick` (au lieu d'importer le type backend `EvaluatedPickSnapshot` —
  compatibilité structurelle, pas de dépendance package→app).
- Ce qui reste dans `apps/backend`, volontairement : `computeMarketFair`/
  `siblingOutcomeOdds`/tout ce qui dépend de `FullOddsSnapshot`/`OddsSnapshotLoader` (trop
  couplé à l'infra de cotes du backend pour ce premier passage) ; les prédicats de
  `coupon-composer.service.ts` (`clearsMaxLegEdge`, `violatesAntiCorrelation`, etc. — pas
  encore extraits, prochaine étape).
- Vérifié : `apps/vantage-worker` importe déjà `@evcore/analysis-core` et peut appeler ces
  fonctions dès maintenant. 420/420 tests analysis-core (garde-fou d'architecture inclus),
  682/682 backend, 92/92 vantage-worker, build `analysis-core` propre, typecheck/lint
  propres partout. Pas encore committé.

**Troisième et dernière pièce, `guardrails.ts`** — les prédicats de garde-fou de
`coupon-composer.service.ts` déplacés à leur tour, couvrant maintenant aussi le point 4 du
§9 (validation post-génération déterministe) :

- `calibratedLegProbability`/`calibrateLegProbability`/`legProbability`/`depthRank` — le
  calibrage de proba par jambe et le tie-break de profondeur.
- `clearsValueEdgeFloor`/`clearsMinLegOdds`/`clearsTeamTotalMaxOdds`/`clearsMaxLegEdge` — les
  quatre gates d'admission d'une jambe (plancher VALUE, plancher/plafond de cote,
  plafond de divergence modèle↔marché).
- `createAntiCorrelationState`/`recordAntiCorrelation`/`violatesAntiCorrelation` — l'anti-
  corrélation intra-coupon (1/fixture, 1/canal+marché, 2/compétition). Simplifié au passage :
  le paramètre `bounds` que `violatesAntiCorrelation` acceptait n'était en réalité jamais lu
  (seul `state` l'était) — retiré du type de contexte plutôt que copié tel quel.
- `compareCouponsByEV` — trouvé mort (exporté mais jamais appelé nulle part, y compris avant
  cette extraction) ; déplacé quand même pour que `packages/analysis-core` reste la seule
  source si un futur classement en a besoin.
- Constantes qui gouvernent ces prédicats (`MIN_LEG_ODDS`, `TEAM_TOTAL_MAX_ODDS`,
  `MAX_LEG_EDGE`, les bornes de `COUPON_PARAMS.capMin/capMax`, `getValueMinEdge`/
  `LEAGUE_VALUE_MIN_EDGE_MAP`) dupliquées en copies locales privées dans `guardrails.ts` —
  les originaux restent dans `apps/backend` (`coupon.constants.ts`, `ev.constants.ts`) parce
  qu'ils ont d'autres lecteurs backend (`odds-snapshot.loader.ts`, `coupon.service.ts`,
  `investment.constants.ts`) ; pas de suppression, juste plus une source unique des deux
  côtés du package boundary.
- `coupon-composer.service.ts` réduit à la colle backend : `buildCandidatePool` (utilise
  `legProbability` importé), la classe `CouponComposerService` (`scorePicks`/`compose`/
  `buildOne`/`computeCombinedOdds`/`buildCoupon`) — c'est elle, pas les prédicats, qui reste
  backend puisque c'est exactement l'étape que le LLM (vantage-worker) doit à terme
  remplacer, comme discuté plus haut.
- `coupon-composer.service.spec.ts` : les 6 blocs `describe` déplacés vers
  `guardrails.spec.ts` (27 tests portés à l'identique) retirés d'ici, gardés seulement les
  tests d'intégration de `CouponComposerService.compose` et de `COUPON_CLASSES`.
- Vérifié : 72 tests `src/coupon` côté analysis-core (12 channel-reliability + 24+9
  evaluated-market-leg/avoid + 27 guardrails), 655/655 backend, 92/92 vantage-worker,
  build `analysis-core` propre, typecheck/lint propres partout (backend, analysis-core,
  vantage-worker). Pas encore committé.

**Statut de l'extraction** : les trois pièces prévues sont faites. `apps/vantage-worker`
peut maintenant construire son propre pool de candidats déterministe (courbes de
fiabilité, résolution des marchés évalués, tous les prédicats de garde-fou) sans importer
la couche NestJS de `apps/backend`. Reste non commencé : l'appel LLM lui-même côté
vantage-worker (§9 points 2-3) et la question de donner au LLM le verdict VANTAGE déjà
calculé (soulevée plus haut, pas encore construite).

**Décision actée le 2026-09-03 (répond à « le LLM va remplacer compose() »)** :
`CouponComposerService.compose()` n'est pas gardé en shadow ni en fallback permanent — le
LLM devient l'unique voie de composition dès qu'il est prêt, et l'ancien composeur glouton
est supprimé à ce moment-là (pas de double chemin à maintenir). Persistance
`CouponProposal`/`CouponProposalLeg` : `apps/vantage-worker` écrit directement en DB via
`@evcore/db`, même patron que `persistVantageDecision` (`persist-decision.ts`, un seul
appel Prisma avec nested writes) — cohérent avec le principe déjà acté (backend
LLM-agnostic) et avec comment VANTAGE tourne déjà aujourd'hui : sa propre queue BullMQ, son
propre scheduler (`runSweep`, `apps/vantage-worker/src/queue/scheduler.ts`), zéro
dépendance à la queue `AI_ENGINE` d'`apps/backend`. Le générateur de coupon suit le même
patron — pas de couplage runtime entre les deux apps.

**Phase A — pool de candidats côté vantage-worker (démarrée 2026-09-03)** : avant d'écrire
la requête complète, deux fonctions pures que `CouponPoolService.getPoolForRange`
(`coupon-pool.service.ts`) utilisait encore localement ont été déplacées à leur tour vers
`packages/analysis-core/src/pricing/market-fair.ts` — `computeMarketFair`,
`siblingOutcomeOdds`, `overUnderOpposite`, `oppositePick` (retrait de l'overround, fair
probability). Elles ne dépendaient déjà que de types/fonctions partagés
(`FullOddsSnapshot`, `getPickOddsFromSnapshot`, `removeOverround`, `bookmakerMargin` —
tous déjà dans analysis-core), donc pas de refonte, juste un déplacement + 17 tests neufs
(`market-fair.spec.ts`, cette logique n'avait jamais eu de test dédié côté backend).
`coupon-pool.service.ts` importe maintenant les quatre depuis `@evcore/analysis-core`.
Vérifié : 655/655 backend, build+lint analysis-core propres.

**Lecteurs de `ModelRun.features` déplacés** (2026-09-03) — `extractEvaContextFromFeatures`,
`hasCalibrationAlert`, `readShadowConflict`, `computeDataCoverage`,
`extractModelRunFeatureDiagnostics` déplacés de `apps/backend/src/utils/model-run.utils.ts`
vers `packages/analysis-core/src/model-run/model-run-features.ts` (nouveau répertoire —
pas `coupon/`, puisque 8 modules backend différents les lisent : dashboard, analysis-sheet,
audit, coupon-pool, bet-slip, investment-coherence, fixture-scoring). Le type
`PredictionSource` (trivial, une union de strings) est venu avec — `betting-engine.types.ts`
le ré-exporte maintenant depuis `@evcore/analysis-core` au lieu de le définir localement.
`formatSigned` (un formateur d'un signe explicite sur un decimal, utilisé une fois pour
l'EV d'un pick) a été dupliqué en helper privé plutôt qu'importé de
`dashboard.utils.ts` — pour ne pas faire dépendre `analysis-core` d'un module backend pour
un one-liner qui ne peut pas dériver silencieusement. `apps/backend/src/utils/
model-run.utils.ts` devient un simple ré-export, même patron que `betting-engine.utils.ts`
— zéro des 8 appelants backend n'a eu besoin d'un changement d'import. 20 tests neufs
(`model-run-features.spec.ts`, cette logique n'avait jamais eu de test dédié non plus).
Vérifié : 655/655 backend, 481/481 analysis-core, 92/92 vantage-worker, build+lint
propres partout.

**Requêtes I/O portées côté `vantage-worker`** (2026-09-03) —
`apps/vantage-worker/src/coupon/odds-batch.ts` (`findLatestOddsSnapshotsBatch`/
`findBestPricesBatch`, miroir de `OddsSnapshotLoader`) et `channel-reliability-query.ts`
(`computeChannelReliability`, miroir de `CalibrationService.computeChannelReliability`) —
même requête Prisma que côté backend, mais via `prisma` de `@evcore/db` directement (pas
de `PrismaService`/couche NestJS), même patron que `context/market-odds.ts` et
`persist-decision.ts` déjà en place dans cette app. Pas de spec dédiée — cohérent avec les
autres fichiers I/O de `vantage-worker` (`find-eligible-fixtures.ts`, `market-odds.ts`,
`persist-decision.ts`, ...), aucun n'a de test unitaire aujourd'hui (pas d'infra de DB de
test dans cette app, contrairement à `apps/backend`). Vérifié : typecheck/lint propres,
92/92 tests vantage-worker toujours au vert (aucun nouveau test, aucune régression).

**`POOL_ELIGIBLE_CHANNELS`/`POOL_EXCLUDED_CHANNELS`/`DRAW_STAKED_LEAGUES` déplacés**
(2026-09-03) — vers `packages/analysis-core/src/coupon/pool-eligibility.ts`. Trouvaille en
les regardant de près : `POOL_EXCLUDED_CHANNELS` (META ∪ FILTERS) était déjà exactement
`META_STRATEGY_CHANNELS ∪ FILTER_STRATEGY_CHANNELS`, deux sets qui existaient déjà dans
`analysis-core/types/strategy-channel.ts` sans être composés ainsi — pas une duplication,
une vraie réutilisation. Comportement inchangé (garanti par le test de conformance qui lie
`StrategyChannel` de `@evcore/db` à celui d'analysis-core) : `POOL_ELIGIBLE_CHANNELS`
inclut toujours VANTAGE (canal à pick propre, ni filtre ni méta). `coupon.constants.ts`
redevient un simple ré-export. 5 tests neufs. Vérifié : 655/655 backend, 486/486
analysis-core, build+lint propres.

**`pool-query.ts` écrit côté `vantage-worker`** (2026-09-03,
`apps/vantage-worker/src/coupon/pool-query.ts`) — **la Phase A est complète.** Miroir de
`getPoolForRange`, assemblant tout ce qui a été extrait : `computeMarketFair`/
`oppositePick`/`getPickOddsFromSnapshot` (odds), `extractEvaContextFromFeatures`/
`hasCalibrationAlert`/`readShadowConflict`/`computeDataCoverage`/
`extractModelRunFeatureDiagnostics` (features), `classifyAvoidSignal`/
`isExtremeDivergence`/`resolveEvaluatedMarketLeg` (AVOID + evaluatedPicks),
`POOL_ELIGIBLE_CHANNELS`/`DRAW_STAKED_LEAGUES` (éligibilité), plus les deux requêtes de
`odds-batch.ts`/`channel-reliability-query.ts` — tout via `@evcore/analysis-core` et
`prisma` de `@evcore/db` directement, zéro import d'`apps/backend`. Deux écarts assumés par
rapport à l'original, documentés dans le type `PoolCandidate` :

- `modelThreshold`/`recentForm`/`modelProbabilities` volontairement absents — vérifié
  qu'aucun consommateur du module coupon backend ne les LIT jamais (seulement posés pour
  affichage/reasoning) ; à réintroduire si le prompt LLM (Phase B) en a besoin.
- `legEV` calculé immédiatement sur la probabilité BRUTE (pas calibrée) — l'original le
  laissait `null` jusqu'à `CouponComposerService.scorePicks()`, qui n'existe plus dans ce
  pipeline ; la calibration (Platt, `channel-reliability-query.ts`) devient une étape
  explicite de la Phase B (construction du prompt), pas de ce fichier.

Pas de test dédié — même raison que `odds-batch.ts`/`channel-reliability-query.ts` (aucun
fichier I/O de cette app n'en a). Vérifié : typecheck/lint propres, 92/92 vantage-worker
toujours au vert.

**Statut** : `apps/vantage-worker` peut maintenant interroger sa propre pool de candidats
de bout en bout, sans aucune dépendance à `apps/backend`. Prochaine étape : Phase B —
construire le prompt LLM à partir de ce pool (§9 points 1-3), pas commencée.

## Phase B — le prompt LLM (démarrée 2026-09-03)

**Recherche préalable** (à la demande de l'utilisateur, avant d'écrire le prompt) — trois
conclusions actionnables qui cadrent tout ce qui suit :

1. **Le LLM ne doit jamais générer/recalculer une cote, une probabilité ou un EV** — il
   sélectionne des jambes par identifiant parmi celles qu'on lui donne, jamais par valeur
   régénérée. La littérature sur le tool-calling est unanime : un LLM qui doit reproduire
   une valeur plutôt que choisir dans une liste fournie hallucine sur la queue de
   distribution (paramètres inventés/arrondis). Toute l'arithmétique (`combinedOdds`,
   `jointProbability`, `couponEV`) reste 100% déterministe côté code, exactement comme
   `buildCoupon()` le faisait — le LLM ne fait que le jugement qualitatif.
2. **Structured output natif + revalidation Zod systématique**, jamais confiance aveugle
   au schéma du provider — patron déjà en place dans `analyze-fixture.ts`
   (`requestVantageCompletion`), à réutiliser tel quel.
3. **Un appel LLM par classe (SAFE/BALANCED/BOLD), pas un appel unique pour les trois** —
   la fiabilité de l'instruction-following se dégrade avec le nombre de contraintes
   simultanées dans un prompt ; trois bandes de cote de jambe + trois profils de risque
   dans un seul prompt est plus fragile que trois prompts à une contrainte de bande
   chacun.

**Étape 1 du plan §9 codée** — `apps/vantage-worker/src/coupon/score-candidates.ts` :
transforme le pool brut (`pool-query.ts`) en la vue déjà scorée que le LLM verra.

- `scoreCandidates` — applique la courbe de Platt du canal (`calibrateLegProbability`,
  déjà dans analysis-core) à chaque candidat, recalcule `legEV`/`edge` sur la probabilité
  CALIBRÉE (pas la brute, contrairement à `pool-query.ts` qui n'avait que la brute — voir
  l'écart documenté dans l'entrée Phase A).
- `admissibleCandidates` — repasse chaque candidat par les mêmes garde-fous que l'ancien
  `compose()` (`clearsValueEdgeFloor`/`clearsTeamTotalMaxOdds`/`clearsMaxLegEdge`/
  `clearsMinLegOdds`, tous déjà dans `guardrails.ts`) — un candidat qui ne les
  franchit pas n'a rien à faire dans ce que voit le LLM. La Phase C revalidera quand
  même après coup (ne jamais se fier à une seule passe de garde-fou).
- `reduceToLlmPool` — fusionne les deux modes du template (Fiabilité : top N par
  probabilité calibrée ; Valeur : top N par edge), dédupliqué par (fixture, marché,
  pick), `depthRank` en tie-break. `reliabilityTopN=30`/`valueTopN=20` sont un point de
  départ qualitatif (description du template), **pas backtestés pour ce pipeline** — même
  réserve que `ANCHOR_MIN_PROBABILITY` dans l'ancien composeur.

11 tests neufs. Vérifié : typecheck/lint propres, 103/103 vantage-worker (92 + 11, aucune
régression).

**`COUPON_BOUNDS`/`COUPON_CLASSES` déplacés** (2026-09-03) — vers
`packages/analysis-core/src/coupon/coupon-classes.ts`, même patron que
`pool-eligibility.ts` : la sélection LLM (un appel par classe) a besoin des mêmes
définitions de classe que l'ancien composeur, `apps/backend` ré-exporte. 5 tests neufs.

**Schéma Zod + prompt + appel LLM écrits** (2026-09-03, `apps/vantage-worker/src/coupon/`) —
`selection-schema.ts` (`buildCouponSelectionSchema(bounds)`, union discriminée
`compose`/`no_coupon` — même patron que `vantageResponseSchema`), `selection-prompt.ts`
(prompt système + utilisateur en français, même voix que `vantage/prompt.ts`),
`generate-coupon-selection.ts` (orchestration : filtre le pool à la bande de cote de la
classe, réduit via `reduceToLlmPool`, appelle `requestVantageCompletion`, parse/valide,
résout les index sélectionnés vers les vrais candidats).

Décisions issues de la recherche de ce matin, appliquées concrètement :

- **Sélection par index numérique, jamais par valeur** — le schéma n'a AUCUN champ
  probabilité/cote/EV ; le prompt affiche ces chiffres pour le jugement du LLM mais son
  JSON ne contient qu'un `index` (1-based, position dans la liste numérotée du prompt) et
  un `reasoning` qualitatif. `resolveSelectedLegs` fait le mapping index→candidat réel,
  rejette (`invalid_response`) un index hors plage ou dupliqué.
- **Cardinalité imposée dans le schéma Zod** (`.min(bounds.minLegs).max(couponClass.maxLegs)`),
  pas laissée à la Phase C — un coût nul qui élimine toute une classe de réponses
  invalides avant même la validation métier.
- **Un appel par classe** — `generateCouponSelection` prend une seule `CouponClass`,
  filtre le pool à sa bande de cote AVANT de le montrer au LLM (le LLM n'a donc pas à
  vérifier lui-même qu'une jambe respecte la bande).
- **Pool vide → pas d'appel LLM** (`empty_pool`, même principe que le "no readings" de
  `analyzeFixture`) — inviter le modèle à juger un vivier trop petit pour même atteindre
  `minLegs` n'a aucun sens.

**Question du contexte VANTAGE (§9bis) tranchée le 2026-09-03 : NON.** `selection-prompt.ts`
ne montrera jamais le verdict VANTAGE déjà calculé sur une fixture du pool. Trois raisons :
(1) ce serait un LLM lisant la sortie d'un autre LLM comme preuve — un biais ou une
hallucination de VANTAGE se propagerait en se faisant passer pour une corroboration
indépendante, alors que ce n'est que le même raisonnement sur les mêmes canaux en amont ;
(2) précédent direct dans ce repo, deux fois : `shadow_ml_by_channel` retiré du contexte
VANTAGE car il dégradait DOMINANT quand suivi (ratio 0.43 vs 1.13), et `shadow_predictions`
identifié comme cause mécanique du surjeu de DRAW (74% des picks DRAW le citent) — les deux
fois, un signal donné "en contexte informatif" a fini sur-pondéré, jamais traité
proportionnellement à sa fiabilité réelle ; (3) VANTAGE est précisément mal calibré sur
`ONE_X_TWO/DRAW` (ratio 0.77, 35% de son volume de "play") — l'endroit où le citer serait le
plus tentant est celui où ça pousserait vers une zone dégradée. Si l'idée revient, la
traiter comme `shadow_predictions`/`shadow_ml` : ajout isolé, mesuré en isolation avant
d'être suivi en prod, jamais ajouté par défaut.

18 tests neufs (11 `score-candidates` + 7 `generate-coupon-selection`, mock de
`requestVantageCompletion` même patron que `analyze-fixture.spec.ts`). Vérifié :
typecheck/lint propres, 110/110 vantage-worker, 491/491 analysis-core, 655/655 backend.

## Phase C — validation déterministe post-génération (démarrée 2026-09-03)

**`validate-coupon-selection.ts` écrit** (`apps/vantage-worker/src/coupon/`) — reprend
telles quelles les mêmes vérifications que l'ancien `CouponComposerService` appliquait
avant de publier un coupon, jamais une confiance aveugle dans le choix du LLM :

- Cardinalité (déjà imposée par le schéma Zod, revérifiée quand même — "ne jamais se fier
  à un seul garde-fou").
- Au moins `MIN_DISTINCT_FIXTURES=2` matchs distincts.
- Chaque jambe repasse par `clearsValueEdgeFloor`/`clearsTeamTotalMaxOdds`/
  `clearsMaxLegEdge`/`clearsMinLegOdds` (bande de cote de la classe) — déjà garanti par
  `admissibleCandidates` avant que le LLM ne voie le pool, donc une défense en profondeur,
  pas la seule ligne de défense.
- Anti-corrélation sur l'ENSEMBLE choisi (`createAntiCorrelationState`/
  `violatesAntiCorrelation`, guardrails.ts) — c'est ici, pas dans le prompt, que ces règles
  sont réellement appliquées : le prompt les explique pour réduire les tentatives ratées,
  mais un prompt n'est jamais une contrainte dure.
- `combinedOdds` recalculé sur les vraies cotes, doit rester dans `[bounds.minCombinedOdds,
bounds.maxCombinedOdds]` ET atteindre `couponClass.targetCombinedOdds` — même discipline
  que l'ancien `buildOne()` : une cible est une porte de publication, jamais un objectif
  souple ("mieux vaut pas de coupon qu'un coupon qui rate discrètement sa cible").
- `jointProbability`/`couponEV` calculés sur les probabilités calibrées réelles — jamais
  une valeur régénérée par le LLM.

**Boucle relance-avec-retour écrite** (`compose-coupon-class.ts`) — un point important
découvert en l'écrivant : `requestVantageCompletion` appelle à `temperature: 0`
(EVCORE.md §14.3, garde-fou de reproductibilité), donc relancer avec un prompt IDENTIQUE
après un rejet aurait juste reproduit la même sortie rejetée. `buildCouponSelectionUserPrompt`
prend maintenant un `feedback` optionnel (la raison du rejet précédent), injecté dans le
prompt de la tentative suivante — "corrige ce problème précis", jamais une relance
aveugle. `composeCouponClass` boucle jusqu'à `maxAttempts` (3 par défaut), donne renoncement
explicite (`gave_up`) au-delà — **aucun repli sur un composeur déterministe**, conforme à
la décision déjà actée (§9bis : "le LLM est master, pas de shadow mode").

14 tests neufs (9 `validate-coupon-selection` + 5 `compose-coupon-class`, dont un test qui
vérifie EXPLICITEMENT que le feedback de rejet apparaît dans le prompt de la tentative
suivante). Vérifié : typecheck/lint propres, 124/124 vantage-worker.

**`persist-coupon-proposal.ts` écrit** (2026-09-03) — même patron que `persist-decision.ts` :
`prisma` de `@evcore/db` directement, même clé unique et même garde-fou "ne jamais écraser
une décision humaine (ACCEPTED/REJECTED) ni un `EXPIRED`" que `CouponRepository.upsertProposal`
côté backend. Une seule proposition par classe par jour (`rank=1` par défaut, paramétrable)
— le LLM produit un coupon par appel, pas un classement de plusieurs comme l'ancien
composeur. `signalScore` (niveau coupon ET par jambe) reprend le même sens déjà acté :
la probabilité calibrée, plus la métrique glissante d'origine. `reasoning`/`featureSnapshot`
incluent maintenant le texte `reasoning`/`reasonDetails` du LLM (son jugement qualitatif
par jambe et pour l'ensemble) — nouveau par rapport à l'ancien composeur, qui n'avait
aucun texte à y mettre. `LEGACY_SIGNAL_WINDOW_DAYS=38` dupliqué localement (constante
figée, aucune raison de vivre dans analysis-core). Pas de spec dédiée — même raison que
les autres fichiers I/O de cette app. Vérifié : typecheck/lint propres, 124/124
vantage-worker (inchangé, aucun test nouveau attendu ici).

## Câblage + suppression de l'ancien composeur (2026-09-03) — LE PIPELINE LLM TOURNE

Après confirmation explicite de l'utilisateur, `CouponComposerService` a été supprimé
**dans le même passage** que le câblage — pas de shadow mode, pas de fallback, pas de
délai d'observation, conformément à la décision déjà actée. Deux points tranchés avant
de coder :

- **Timing** : `VANTAGE_COUPON_CRON`, défaut `30 20 * * *` (20:30 UTC) — 30 minutes après
  le défaut d'`apps/backend`'s `ETL_BETTING_ENGINE_ANALYSIS_CRON` (20:00 UTC), marge pour
  que l'analyse du jour finisse d'écrire les `ModelRun`/`ChannelDecision` avant que le
  pool ne les lise. Pas de couplage runtime entre les deux crons (principe déjà acté) —
  si `ETL_BETTING_ENGINE_ANALYSIS_CRON` change côté backend, `VANTAGE_COUPON_CRON` doit
  être mis à jour manuellement côté vantage-worker, documenté dans `config.ts`.
- **Suppression immédiate**, pas d'observation préalable.

**Câblage écrit** (`apps/vantage-worker/`) :

- `config.ts` — `couponCron` (env `VANTAGE_COUPON_CRON`).
- `coupon/run-coupon-generation.ts` — l'orchestration complète : `computeChannelReliability`
  - `getPoolForRange` (en parallèle) → `scoreCandidates` → une passe
    `composeCouponClass`/`persistCouponProposal` par classe (`COUPON_CLASSES`). Inclut
    `resolveGenerationWindow` (fenêtre Ven→Dim / Mar→Jeu élargie, sinon jour unique) — porté
    depuis `coupon.worker.ts` (backend, supprimé) puisqu'aucune dépendance `date-fns`
    n'existait déjà côté vantage-worker pour un simple +2 jours UTC. Flags
    (`includeDraw`/`enforceAvoid`/`enableAvoidFade`/`includeEvaluatedMarkets`) tous à `true`
    en dur, même choix que `CouponService` retiré (pas de flag dormant).
- `queue/queue.ts`/`worker.ts`/`main.ts` — nouveau type `CouponJobData`, job
  `generate-coupons` traité par le worker existant, cron BullMQ repeatable enregistré au
  démarrage (`{ pattern: config.couponCron }`), même patron que le sweep VANTAGE. Toujours
  zéro dépendance à la queue `AI_ENGINE` d'`apps/backend`.
- 3 tests neufs pour `resolveGenerationWindow` (seule logique pure du fichier
  d'orchestration — vérifié sur un vrai vendredi/mardi/mercredi/dimanche de 2026).

**Suppression côté `apps/backend`** — cascade plus large que prévu, découverte en
traçant les appelants avant de supprimer : une fois `CouponComposerService` retiré,
`CouponService.generateCoupons` n'a plus rien à appeler, et une fois CE code retiré,
`CouponPoolService` (~750 lignes) devient elle-même entièrement inutilisée dans
`apps/backend` — son seul appelant était `generateCoupons` (`investment.service.ts`
n'importe que la constante `DRAW_STAKED_LEAGUES`, jamais le service). Fichiers supprimés :

- `coupon-composer.service.ts` + `.spec.ts`
- `coupon-pool.service.ts` (aucun spec n'existait)
- `etl/workers/coupon.worker.ts` + `.spec.ts` (le job `generate-coupons` sur la queue
  `AI_ENGINE` — son appel à `settleReadyProposals()` était redondant, déjà couvert
  indépendamment par `pending-bets-settlement.worker.ts`)
- `scripts/regenerate-coupons.ts` (script de backtest dev dont toute la raison d'être
  était "régénérer en masse avec le code du composeur actuel" — plus de composeur à
  régénérer avec)

Édits (retrait de méthodes/deps devenues mortes, pas de fichier entier) :

- `coupon.service.ts` — retire `generateCoupons`/`generateForClass`, garde `getCoupons`
  (lecture seule désormais).
- `coupon.repository.ts` — retire `upsertProposal`/`deletePendingForDate`/
  `deleteExpiredInRange` (chacune un seul appelant, tous supprimés).
- `coupon.module.ts` — retire `CouponPoolService`/`CouponComposerService`/
  `CalibrationService`/`OddsSnapshotLoader` (les deux derniers étaient déjà enregistrés
  dans leurs vrais modules — `adjustment.module.ts`/`betting-engine.module.ts` — cet
  enregistrement dupliqué n'existait que pour `CouponPoolService`).
- `coupon.controller.ts` — retire `POST /coupons/generate`.
- `betting-engine-analysis.worker.ts` — n'enfile plus `generate-coupons` sur `AI_ENGINE`
  (l'analyse elle-même est intacte).
- `betting-engine-rebuild.worker.ts` — retire `queueCouponGeneration` (aurait enfilé dans
  une queue sans plus aucun consommateur).
- Queue `AI_ENGINE` retirée entièrement (`etl.constants.ts`/`etl.module.ts`/
  `etl.service.ts`, y compris de la carte de statut des queues) — plus aucun
  producteur ni consommateur une fois tout ce qui précède fait.

**Badge "Expérimental" retiré** (demande utilisateur en cours de route, plus besoin) —
`experimental`/`LEGACY_LONGSHOT_MIN_ODDS` retirés de `coupon.service.ts`/
`coupon.constants.ts`/`dto/coupon-proposal.dto.ts` côté backend, et de
`domains/coupon/types/coupon.ts`/`components/coupon-card.tsx` (le composant partagé, prop
`isExperimental`)/`app/dashboard/coupons/components/coupon-card.tsx` côté frontend.

Vérifié : typecheck/lint propres sur les quatre workspaces touchés, 630/630 backend
(-25 tests, les deux specs supprimées), 127/127 vantage-worker (+3), 491/491
analysis-core (inchangé), typecheck+lint propres côté `apps/web` (mêmes 2 warnings
pré-existants sur `page-shell.tsx`, aucun nouveau).

**Statut** : le générateur de coupon LLM est le seul chemin de composition en production.
Reste non commencé : le recheck J-J (reparqué le 09-03, deux gaps distincts documentés
dans `project_no_same_day_reanalysis.md`) et toute observation/mesure du nouveau pipeline
une fois qu'il aura tourné en conditions réelles.

## Revue de la branche + 3 correctifs (2026-09-03)

Revue systématique de tout le chantier (24 commits) demandée par l'utilisateur avant de
démarrer le recheck J-J. Aucun bug bloquant. Trois points réels corrigés avant de
continuer, sur du code qui n'a jamais encore tourné en prod :

1. **`persist-coupon-proposal.ts`** — le chemin de mise à jour (`deleteMany` des jambes
   puis `update` du coupon) était deux appels Prisma séparés, pas dans une transaction :
   un crash entre les deux aurait laissé un `CouponProposal` sans aucune jambe,
   silencieusement. Enveloppé dans `prisma.$transaction([...])`. Gap préexistant dans
   l'ancien `CouponRepository.upsertProposal` (vérifié : jamais de `$transaction` dans son
   historique non plus) — corrigé ici plutôt que reporté dans du code neuf.
2. **`compose-coupon-class.spec.ts`** — les deux tests de relance n'exerçaient la boucle
   que via un rejet de _schéma_ (index dupliqué), jamais via un rejet de la Phase C
   (anti-corrélation, cote hors bande) — exactement le chemin que les commentaires du code
   décrivent comme la raison d'être de la relance-avec-retour. Un test neuf construit un
   vivier avec deux candidats du même match (canal/marché différents pour ne pas être
   dédupliqués par `reduceToLlmPool`) pour forcer un rejet Phase C réel, puis vérifie que
   le prompt de la deuxième tentative porte bien CETTE raison (pas "réponse invalide").
3. **Robustesse du timing du cron** — le nouveau cron (20h30 UTC, `VANTAGE_COUPON_CRON`)
   suppose que l'analyse de la veille finit en 30 minutes, alors que rien dans le repo ne
   documente sa durée réelle (boucle strictement série par fixture, appels bloquants
   API-Football + ml-worker, aucun timeout configuré) — contrairement à l'ancien système,
   qui enchaînait la génération directement à la fin de l'analyse (garantie d'ordre par
   construction, perdue avec le découplage des deux apps). Plutôt que de tenter de
   détecter la fin de l'analyse (recoupage entre apps, contraire au principe déjà acté),
   **deuxième passage auto-cicatrisant** : `VANTAGE_COUPON_RETRY_CRON` (défaut 21h15 UTC,
   45 min après le premier) rejoue le même job — sûr par construction puisque
   `persistCouponProposal` ne touche jamais un coupon déjà ACCEPTED/REJECTED (seulement
   PENDING), donc un second passage avec un pool plus complet ne peut qu'améliorer une
   proposition qu'un utilisateur n'a pas encore tranchée, jamais corrompre une décision
   prise.

Aussi noté par la revue, pas corrigé (opportunité, pas urgent) : `recentForm` est déjà
calculé dans `pool-query.ts` mais jamais montré au LLM du coupon — pourrait aider à
repérer une corrélation cachée entre jambes (ex. deux picks "domicile gagne" dont les deux
équipes sont en méforme). Contrairement à H2H/coach tenure (bruit dans un prompt de 30-50
candidats) ou `shadow_predictions` (répéterait l'erreur déjà évitée pour VANTAGE — un LLM
qui lit la sortie d'un autre LLM comme preuve).

Vérifié : typecheck/lint propres, 128/128 vantage-worker (+1 test).

## Recheck J-J (2026-09-03) — les deux gaps historiques fermés, plus un batch intraday

Trois choix de conception tranchés avec l'utilisateur avant de coder : portée ciblée
(fenêtre proche du coup d'envoi, pas la journée entière), VANTAGE relit seulement dans
cette même fenêtre, et le batch de coupon du soir reste figé — mais un second batch
intraday est généré en plus, jamais à la place.

**Recherche préalable (`BettingEngineService`)** avant de coder quoi que ce soit : `
analyzeFixture` crée TOUJOURS un nouveau `ModelRun` (aucune contrainte d'unicité par
fixture, `ChannelDecision.@@unique([modelRunId, channel])` scope au nouveau run — jamais
de conflit), pas de cache entre appels (tout relu frais en DB à chaque fois), aucun verrou
ni rate-limit qui rendrait un rappel rapproché dangereux. `analyzeByDate` filtre déjà
`status: SCHEDULED`, donc un fixture qui a démarré est automatiquement exclu sans garde
supplémentaire à écrire.

**1. `apps/backend` — `BettingEngineService.analyzeUpcoming(windowHours)`** (nouvelle
méthode, miroir d'`analyzeByDate` mais fenêtré sur `scheduledAt` plutôt que sur la
journée entière). Nouveau cron `SAME_DAY_ANALYSIS` (`*/30 * * * *`, fenêtre par défaut 3h
via `SAME_DAY_ANALYSIS_WINDOW_HOURS`/`SAME_DAY_ANALYSIS_DEFAULT_WINDOW_HOURS`), nouveau
worker `same-day-analysis.worker.ts`, queue/scheduler-key/cron-schedule ajoutés à
`etl.constants.ts`/`etl.service.ts`/`etl.module.ts`. Le commentaire historique de
`BETTING_ENGINE_ANALYSIS` (qui documentait le gap comme "deliberately deferred") est mis
à jour pour pointer vers ce nouveau cron.

**2. `apps/vantage-worker` — fausse piste corrigée, aucun code nécessaire.** La première
lecture de `find-eligible-fixtures.ts` (09-03 matin) affirmait que VANTAGE excluait un
fixture pour toujours dès qu'il portait une `ChannelDecision` VANTAGE. Relecture attentive
en préparant ce chantier : la requête ne regarde QUE le `ModelRun` le plus récent
(`take: 1` dans le `select`, pas juste dans le filtre final) — un nouveau `ModelRun` créé
par `SAME_DAY_ANALYSIS` devient automatiquement "le plus récent" et n'a par construction
aucune décision VANTAGE dessus, donc le fixture redevient éligible tout seul.
`build-match-context.ts` lit lui aussi systématiquement le run le plus récent. Mémoire
`project_no_same_day_reanalysis.md` corrigée pour ne pas répéter cette fausse piste.
Aucune ligne de code touchée dans `apps/vantage-worker` pour ce point.

**3. Batch de coupon intraday** (`run-coupon-generation.ts`'s nouvelle
`runIntradayCouponGeneration`) — reconstruit le pool sur la même fenêtre proche du coup
d'envoi (`pool-query.ts`'s nouveau `opts.scheduledAtWindow`, remplace les bornes de
journée par une plage `scheduledAt` précise), compose/persiste une passe par classe comme
le batch du soir. **Ne collisionne jamais avec le batch du soir** :
`persist-coupon-proposal.ts` porte maintenant `INTRADAY_SIGNAL_WINDOW_DAYS=39` distinct de
`LEGACY_SIGNAL_WINDOW_DAYS=38` — la seule chose qui différenciait déjà les deux dans la clé
unique `(forDate, signalWindowDays, targetOddsMin, targetOddsMax, rank)`. Nouveau job
`generate-intraday-coupons`, cron `VANTAGE_COUPON_INTRADAY_CRON` (défaut horaire),
fenêtre `VANTAGE_COUPON_INTRADAY_WINDOW_HOURS` (défaut 3h, aligné sur le cron backend —
pas de couplage runtime, à resynchroniser manuellement si l'un des deux change). Point
produit noté pour plus tard, pas encore traité : le frontend devra distinguer visuellement
un coupon "généré la veille" d'un "généré en intraday" pour qu'un utilisateur ne soit pas
surpris d'en voir deux le même jour.

Refactor associé : la boucle compose+persist-par-classe (dupliquée entre le batch du soir
et l'intraday) extraite dans `runComposePersistPass`, partagée par les deux entrées.
`persistCouponProposal` passe de `rank` positionnel à un objet `opts: {rank?,
signalWindowDays?}` (déjà 5 paramètres positionnels avant ce changement).

Pas de test dédié pour `analyzeUpcoming`/`runIntradayCouponGeneration` — même convention
déjà établie (`analyzeByDate`/`analyzeSeason` ne sont pas non plus unit-testés à ce
niveau ; `runCouponGeneration` non plus). Vérifié : typecheck/lint propres sur les deux
apps, 630/630 backend (inchangé, pas de nouveau test), 128/128 vantage-worker
(inchangé — les fonctions neuves sont de l'orchestration I/O, même raison que le reste
du pipeline coupon).

**Statut** : les deux gaps historiques du recheck J-J sont fermés. Reste non fait : la
distinction visuelle frontend "soir vs intraday", et toute observation du comportement
réel une fois que `SAME_DAY_ANALYSIS`/le batch intraday auront tourné en conditions
réelles (aucun des deux n'a encore d'historique de production).

## §0 point 3 — retraits/fusions UI (démarré 2026-09-03)

**Écart trouvé** : plusieurs items du tableau §1/§2 étaient marqués comme livrés
(datés "2026-09-02") alors que le code montrait le contraire — Investir toujours dans la
nav, Notifications/Annonces toujours deux pages séparées, Abonnements toujours une page
autonome avec cadre ROI/mise. Les dates dans les titres de section marquaient la décision
de conception, pas le ship. Statut réel vérifié avant de reprendre :

- Fait : bug P0 bet-slip, fusion "Par match"/"Par canal" (Decisions), retrait KPI
  "lectures/tensions" (Arbitrage), tiroir de facettes (§2bis), décommissionnement
  VALUE/SAFE (§5.1).
- Pas fait : retrait Investir/fusion Notifications+Annonces de la nav (§0 point 3),
  fusion Abonnements→Personnalisation (§0 point 4, §2ter), onboarding 3 étapes actif
  (§0 point 6, distinct du tour passif existant `onboarding-steps.ts`).

**Investir retiré de la nav** (`app-shell.tsx`) — nav seule, route `/dashboard/investment`
intacte, même principe que les autres retraits "nav-only" du plan.

## Fusion Notifications + Annonces (2026-09-03) — maquette vérifiée contre la réalité

Maquette extraite du canvas (`Notifications.dc.html`, fichier `.dc.html` dédié dans
l'artifact) : un seul item de nav "Notifications", 4 onglets (Toutes/Non lues/📣
Annonces/🔔 Alertes) mutuellement exclusifs, liste unique groupée par date, badge de type
par carte.

**Trouvaille en comparant à la réalité avant de construire** : `ANNOUNCEMENT_PUBLISHED`
(un des 13 vrais `NotificationType`) miroire déjà chaque annonce publiée dans la table
`Notification` (`notification.service.ts:230-242`) — la fusion est donc surtout un
travail frontend, pas une nouvelle mécanique backend. Effet de bord trouvé au passage :
le badge de nav "Notifications" (`unreadCount`, inclut déjà `ANNOUNCEMENT_PUBLISHED` via
`OPERATOR_TYPES`) et le badge séparé "Annonces" (`useAnnouncementsUnreadCount`, sa propre
requête) comptent probablement en double aujourd'hui — se résout tout seul en retirant
l'item de nav Annonces.

**Contenu de la maquette à ne PAS recopier tel quel** — les types "Résultat"/"Résultat
coupon" n'existent pas ; le vrai `SUBSCRIPTION_SETTLED` affiche un tally gagné/perdu/
remboursé, délibérément SANS % ROI (`subscription-settlement.service.ts:29-35`).
L'exemple de la maquette ("+11,2% ROI cette semaine") aurait réintroduit exactement le
framing déjà retiré ailleurs (Historique vérifiable, calibration au lieu du ROI).
**Décision utilisateur** : Annonces = `ANNOUNCEMENT_PUBLISHED`, Alertes = les 12 autres
types sans sous-groupe. Pas encore implémenté (schéma de filtre confirmé, code pas
encore écrit).

**Implémenté (2026-09-03, suite)** : `NotificationQueryDto.category` (`'announcement' |
'alert'`, déjà présent mais inutilisé) branché dans `notification.service.ts::list()` —
`AND`-é sur le `OR` broadcast/personnel existant, jamais un remplacement (les notifs
personnelles ne sont jamais `ANNOUNCEMENT_PUBLISHED`, donc le filtre les exclut tout seul
en mode "announcement"). `NotificationsPageClient` passe de 2 pills (Toutes/Non lues) à 4
(Toutes/Non lues/📣 Annonces/🔔 Alertes), single-select, exactement la maquette. Le badge
"Non lues" utilise désormais `useUnreadCount()` (compteur global) plutôt qu'un compte sur
la page courante — cohérent avec le badge de nav.

Double comptage résolu comme prévu, en retirant l'item de nav Annonces (`app-shell.tsx`)
et son raccourci dans le menu compte (`account-button.tsx`) : plus qu'un seul point d'entrée
("Notifications", badge unique `useUnreadCount`), la route `/dashboard/updates` reste vivante
comme cible de lien profond (les cartes `ANNOUNCEMENT_PUBLISHED` gardent leur "Voir →" vers
elle) mais n'est plus dans la nav. Bug de fond aussi corrigé : cliquer "Voir →" sur une
notification ne la marquait jamais lue côté `Notification` (seule l'ouverture sur
`/dashboard/updates` marquait l'`AnnouncementRead` séparé) — le clic appelle maintenant
`markRead` avant de naviguer. `GET /dashboard/announcements/unread-count`
(`unreadCountForUser`) et son hook frontend (`useAnnouncementsUnreadCount`) supprimés :
plus aucun appelant après le retrait du badge séparé. Étape onboarding "updates" (route
`/dashboard/updates` en tour dédié) retirée, redondante avec le tour "notifications"
(pointe déjà la cloche) une fois qu'il n'y a plus de nav dédiée à visiter. Vérifié :
typecheck/lint propres backend+web, 597/597 tests backend. Pas de test manuel navigateur
(pas d'outil de rendu disponible dans cette session) — à valider visuellement avant merge.

## Nettoyage Abonnements → calibration (démarré 2026-09-03, Niveau 0 fait)

Suite à la question "vu qu'on a plus de mécanisme de subscription on peut nettoyer tout
ça, non ?" — vérifié d'abord : le mécanisme de matching/settlement (`SubscriptionMatchingWorker`,
cron horaire, `SubscriptionsModule`) tourne toujours pleinement, avec des abonnements
actifs réels en base. Ce que le doc (§3, §2ter) prévoit réellement : garder ce mécanisme
(c'est la source de données de "canaux suivis"), retirer le cadre ROI/mise partout où il
s'affiche, brancher sur la calibration déjà calculée ailleurs (Historique vérifiable),
fusionner l'écran Abonnements dans l'onglet Personnalisation.

**Décisions utilisateur** : le concept de mise disparaît entièrement (pas de mise
personnelle configurée nulle part) ; la notification "abonnement réglé" passe en
comptage seul (plus de montant PnL — même logique que le retrait du ROI ailleurs).

**Plan en 5 niveaux de dépendance** :

- **Niveau 0 (fait)** — remplacer la source de calibration : `subscriptions.service.ts::getCatalog()`
  lisait `InvestmentService.listChannelStats` (ROI shrinké, module Investir en cours de
  retrait) ; branché sur `DashboardService.getChannelHealth` (même `calibrationRatio` que
  Historique vérifiable et le garde-fou VANTAGE). `DashboardModule` exporte maintenant
  `DashboardService` (ne l'était pas). `tier` (BACKED/WATCH) dérivé du `status` déjà
  calculé (`GREEN`), pas d'un second seuil dupliqué. Frontend :
  `subscription-source-select.tsx`/`subscription-form.tsx` affichent la calibration
  (`formatCalibrationRatio`, dupliqué depuis `track-record-constants.ts` — composants
  propres à une page, pas d'import cross-page) au lieu du ROI. 5 tests réécrits dans
  `subscriptions.service.spec.ts` (mock `DashboardService.getChannelHealth` au lieu
  d'`InvestmentService`). Vérifié : typecheck/lint propres backend+web, 630/630 backend.
- **Niveau 1 (pas fait)** — retirer l'affichage ROI/mise du front (`subscriptions-page-client.tsx`,
  `subscription-card.tsx`, `subscription-detail-view.tsx`, `subscription-event-row.tsx`,
  `subscriptions-shortcut-card.tsx`, `subscriptions-constants.ts::subscriptionRoiPct`).
- **Niveau 2 (pas fait)** — section "Canaux suivis" dans Personnalisation, retrait de
  l'écran/nav Abonnements autonome (`app-shell.tsx`, `account-button.tsx`,
  `onboarding-steps.ts`).
- **Niveau 3 (pas fait)** — nettoyage backend : `serializeSubscription` (retirer `roiPct`),
  `getDetail` (retirer `pnl`), `SUBSCRIPTION_SETTLED` (comptage seul, retirer
  `computePnl`/`formatSignedAmount`/`tallyMessage`'s montant), formulaire de création
  (retirer le champ `stakePerEvent`).
- **Niveau 4 (pas fait, migration séparée à confirmer à part)** — colonnes DB
  `stakePerEvent`/`totalStaked`/`netPnl`/`stake`/`pnl` sur `Subscription`/
  `SubscriptionEvent`, une fois confirmé qu'elles ne servent plus à rien après le
  niveau 3.

**Ce qui NE bouge jamais** : le mécanisme de matching/settlement lui-même — c'est la
source de "canaux suivis", aucun rapport avec le cadre ROI.

**Révision 2026-09-03 — le plan 5-niveaux est abandonné, suppression totale décidée à la
place.** Pendant le Niveau 1 (retrait ROI sur `subscriptions-page-client.tsx`), question
utilisateur : "pourquoi tu ne supprime pas cette page ? vu qu'elle ne sert plus ?" — la
page allait de toute façon disparaître au Niveau 2 (fusion dans Personnalisation), retoucher
son affichage ROI entretemps était un effort perdu. Confirmé ensuite explicitement,
deux fois : "oui supprime tout, on a plus besoin d'une page de gestion d'abonnement,
c'est mentionné dans le redesign, supprime tout, même au backend" — donc, contrairement
à ce que ce document écrivait plus haut, le mécanisme de matching/settlement N'EST PAS
gardé. Toute la fonctionnalité est supprimée :

- **Backend** : module `subscriptions` entier (service, repository, controller,
  matching/settlement/notifier services, DTO), `SubscriptionMatchingWorker` + son cron
  horaire + sa queue BullMQ, retiré de `EtlModule`/`EtlController`/`app.module.ts`.
  `pending-bets-settlement.worker.ts` n'appelle plus `settleReadyEvents()`.
- **Frontend** : route `/dashboard/subscriptions` entière (liste/détail/création),
  `apps/web/domains/subscriptions/` (types + use-cases), le shortcut card dashboard,
  l'entrée nav (`app-shell.tsx`, `account-button.tsx`), l'entrée admin
  "Abonnements"/`subscription-matching` dans `global-actions-section.tsx`, les 2 steps
  onboarding tour associés (`dashboardSubscriptions`, `subscriptions`).
- **Conservé volontairement** : les valeurs d'enum `NotificationType.SUBSCRIPTION_EVENTS_ADDED`/
  `SUBSCRIPTION_SETTLED` (historique en base, le front doit encore pouvoir les afficher) et
  le schéma DB (`Subscription`/`SubscriptionEvent` + leurs colonnes) — la suppression de
  colonnes/tables reste une décision séparée, migration à confirmer explicitement à part,
  non abordée ici.

Vérifié après coup : typecheck + lint propres backend et web, 622/622 tests backend
(630 − 8 tests `subscriptions.service.spec.ts` supprimés avec le service). Commit
`a0f8d670`.

## Suppression totale du module Investment (2026-09-03)

Même traitement, demandé dans la foulée : "pareil pour investment, on supprime tout web
et backend, plus besoin de garder du code mort". Le nav "Investir" avait déjà été retiré
plus tôt dans le chantier (`app-shell.tsx`), laissant la page orpheline. Supprimé :

- **Backend** : module `investment` entier (service, 2 repositories, controller, DTO,
  constants), retiré de `app.module.ts`.
- **Frontend** : route `/dashboard/investment` complète, `apps/web/domains/investment/`,
  l'étape onboarding "investment", l'entrée `MOBILE_NAV_ORDER` correspondante
  (`app-shell.tsx`, redescendue à 4 slots plutôt que remplacée par un autre choix — pas de
  direction donnée sur quoi mettre à la place).
- **Traductions** : blocs `nav.investment`/`investment.*` retirés de `fr.json`/`en.json` ;
  au passage, les restes morts de la suppression Abonnements (`nav.subscriptions`,
  `onboarding.steps.dashboardSubscriptions`/`subscriptions`, bloc `subscriptions.*`)
  nettoyés dans la même passe — oubliés lors du commit `a0f8d670`.
- **Conservé** : quelques commentaires de code référençant "Investment" comme contexte
  historique (ex. `coupon.constants.ts` sur un backtest topN=3 invalidé) — c'est de
  l'historique de décision, pas une dépendance fonctionnelle.

Vérifié : typecheck + lint propres backend et web, 598/598 tests backend
(622 − 24 tests `investment.service.spec.ts` + `investment-channel-stats.repository.spec.ts`
supprimés avec le module). Pas encore committé — l'utilisateur committe lui-même.

## Decisions/Arbitrage/Coupons — passe de finition (2026-09-04)

Suite du chantier UI, sur Decisions puis Arbitrage puis Coupons. Contrairement aux
chantiers précédents (backend/vantage-worker lourds), tout ceci est front-only sauf
mention contraire.

**Filtre ligues/canaux — le tiroir de facettes (§2bis) est abandonné.** Une première
implémentation a suivi la maquette à la lettre (tiroir latéral/bottom-sheet, multi-
sélection, comptages). Rediscuté avec l'utilisateur une fois construit et vu en
capture : "on est pas encore bon... on doit traduire les picks aussi" a mené à
reconsidérer la nature du filtre — ligue et canal sont chacun une sélection UNIQUE
("quelle ligue je regarde", "quel canal je regarde"), jamais un vrai filtre
multi-valeurs. Le tiroir a été entièrement retiré, remplacé par deux boutons popover
à sélection unique (`league-filter-bar.tsx`/`channel-filter-bar.tsx` sur Decisions,
`verdict-filter-bar.tsx` neuf sur Arbitrage pour Toutes/Recommandé/Sans avis) — même
pattern que le rail mobile de Personnalisation (`account-tabs-client.tsx`), popover
ouvert au clic (marche sur mobile, contrairement à un survol). Backend inchangé : la
facette cheap (`GET /channel-decisions/facets`) alimente toujours les listes
d'options, juste plus consommée par un tiroir. Les deux boutons portent un préfixe
("Ligue ·", "Filtre ·", "Canal ·") — deux boutons à un mot voisins ("Tous"/"Toutes")
étaient ambigus sans lui.

**Redondance de wording sur la ligne de pick — trouvée en repartant d'un screenshot
("le canal, le marché, ça fait trop de redondance").** La plupart des canaux portent
le nom de leur propre marché (BTTS canal ≈ marché BTTS, CORRECT_SCORE ≈ Score exact) :
le badge de canal à côté du pick ne faisait que répéter le nom de marché juste en
dessous, dans une autre casse. Badge retiré de `channel-row.tsx` (partagé Decisions +
Arbitrage) et de `components/coupon-card.tsx` (Coupons + bet-slip). Le nom de marché
seul reste : il désambiguïse toujours deux picks identiques venant de marchés
différents sur la même fiche (deux "Domicile" pour Gagne-une-mi-temps vs Sans-le-nul,
par exemple), ce que le badge de canal n'apportait pas en plus.

Fuite de code brut trouvée au passage : le pick des marchés composés
(RESULT_BTTS/RESULT_TOTAL_GOALS) écrivait littéralement "BTTS" en dur
("Dom. + BTTS Oui") au lieu d'une traduction — corrigé dans
`market-labels-fr.ts` (`formatPickForDisplayFr`), partagé avec vantage-worker.

**Libellés de canal consolidés dans `@evcore/analysis-core`** (nouveau
`display/channel-labels-fr.ts`, miroir de `market-labels-fr.ts` pour les marchés) —
single source of truth remplaçant trois copies dérivées (JSON next-intl,
`channel-status-strip.tsx`, `followed-channels-card.tsx`, `eva-constants.ts`).
`DRAW_NO_BET` renommé "Sans le nul"→"Remboursé si nul" (canal)/"Remboursé si match
nul" (marché) — recherche web confirmant que "remboursé si match nul" est le terme
reconnu, pas le jargon interne.

**Badge de fiabilité réel remplace l'edge/EV brut** sur le pick de Decisions ET
d'Arbitrage (`CalibrationBadge`, exporté depuis `channel-row.tsx`) — l'edge est
exactement la métrique anti-prédictive documentée en tête de ce CLAUDE.md/l'audit du
22-08 ; l'afficher à côté du pick suggérait qu'un edge élevé était un bon signal.
Source : `GET /dashboard/channel-stats-by-competition` (même fenêtre 90 jours par
défaut que Historique vérifiable), calibration par (canal, compétition), mêmes seuils
0.85/0.70 que partout ailleurs. Tooltip en phrase qualitative, jamais de ratio/n= bruts
("Ce canal a été peu fiable sur cette compétition — ..." plutôt que "0.58×, n=223") —
même règle 2quater appliquée au-delà des seuls noms de canal. HoverCard (tap-friendly)
plutôt que Tooltip pur (ne s'ouvre jamais au tap sur mobile). Masqué entièrement si
échantillon insuffisant — VANTAGE est trop jeune/petit volume pour qu'un découpage par
compétition franchisse le seuil de 30 la plupart du temps ; un badge presque toujours
"insuffisant" ne porte aucun signal, mieux vaut ne rien afficher qu'un badge muet.

**Carte de Decisions plafonnée à 4 picks** (déjà triés par probabilité décroissante),
avec un bouton "Voir N autres marchés"/"Voir moins" repliable pour le reste — une
carte à 9 picks lisait comme un dump de données, pas une lecture.

**Cotes VANTAGE réelles au lieu d'un emprunt de canal voisin qui échouait sur son cas
d'usage principal.** VANTAGE ne stockait jamais sa propre cote (son schéma LLM n'en a
pas) — le frontend devinait en cherchant un canal voisin qui aurait choisi exactement
le même (marché, pick), ce qui échoue précisément quand VANTAGE diverge du consensus
(sa raison d'être). Trouvé en creusant en base (`odds_snapshot` avait bien la cote
Résultat pour deux fixtures sans cote affichée, aucun canal voisin n'avait le même
pick). Cause : `findKnownOdds` (déjà calculée pour le plancher MIN_ODDS à la
génération) était résolue puis jetée, jamais transmise à la persistance. Corrigé :
`analyze-fixture.ts` transmet la valeur déjà résolue à `persistVantageDecision`, qui
l'écrit sur `ChannelSelection.odds` — même colonne que tous les autres canaux, zéro
requête supplémentaire au moment de la lecture. Le frontend préfère maintenant la
cote propre de VANTAGE, avec l'ancien emprunt en repli pour les décisions déjà
persistées avant ce correctif ou les marchés hors Résultat (`findKnownOdds` ne couvre
que ONE_X_TWO aujourd'hui, même limite que côté prompt).

**Prompt VANTAGE (`prompt.ts`)** : ne doit plus restater "(marché, pick)" entre
parenthèses dans `reasonDetails` — trouvé en relisant une lecture réelle qui répétait
mot pour mot ce que le badge affichait déjà juste au-dessus ("... intéressant
(Résultat, victoire extérieur)"). Nouvelle règle : toute statistique brute citée
(forme récente, xG...) doit nommer l'équipe concernée — une lecture réelle disait
"une forme récente de +87%" sans dire de qui.

**Bandeau "À éviter" renommé "Sans avis"** (Arbitrage) — un no-play ne veut pas dire
"n'y touchez pas", juste "VANTAGE n'a rien trouvé de solide ici" ; l'ancien libellé se
lisait comme un avertissement actif sur le match. Description du hover card
simplifiée dans la foulée (retrait de "biais concret", jargon-adjacent).

**Nav "Combinés" renommée "Coupons"** — cohérence avec le contenu de la page
(`pageTitle: "Propositions"`, wording déjà "coupon" partout ailleurs).

**Article de formation "Comment lire une fiche" réécrit en profondeur** — l'article
avait glissé vers un journal des changements (dates, "refonte de septembre 2026", "ça
n'a pas toujours été le cas", justifications de pourquoi) au lieu de décrire l'état
actuel : corrigé pour rester au présent, sans généalogie. Trois erreurs de fond aussi
corrigées, pas seulement du style :

- Section Investir/Decisions entièrement obsolète (Investir n'existe plus) —
  remplacée par une explication de la seule probabilité affichée aujourd'hui, brute,
  jamais retouchée.
- "Deux canaux assumés, le reste en observation" était **l'inverse de la réalité
  actuelle** : `pool-eligibility.ts` confirme que la quasi-totalité des canaux sont
  admis et affichés (même mal calibrés), seuls VALUE/SAFE sont mis à l'écart.
- CORRECT_SCORE classé à tort parmi les "labels qui ne sont pas des picks" (avec
  Consensus/Attention) — il émet un vrai pick (score exact, probabilité, cote), il
  n'est juste jamais misé. Restructuré en section à part.
- Tous les codes bruts (CONSENSUS, AVOID, CORRECT_SCORE, BTTS...) remplacés par les
  vrais libellés français affichés à l'écran.

**Reste ouvert, pas traité aujourd'hui** :

- La distinction visuelle "coupon soir / coupon intraday" sur la page Coupons (notée
  plus haut dans ce doc, toujours pas construite).
- L'extension du correctif de cote VANTAGE au-delà du marché Résultat (BTTS,
  Plus/Moins... nécessite l'agrégation par pick que `market-odds.ts` documente déjà
  comme non faite).
- Le bandeau "Envoyer à VANTAGE" et le compteur "N joueurs ont ajouté ce coupon" de la
  maquette Coupons, délibérément pas construits (aucun mécanisme réel derrière l'un ou
  l'autre).

Vérifié à chaque étape : typecheck/lint propres sur les workspaces touchés (web,
vantage-worker, `@evcore/analysis-core`), 128/128 vantage-worker, 491/491
analysis-core, 608/608 backend (inchangé, aucun fichier backend touché aujourd'hui).
Commits `ec3a8b3a`/`a388601b`/`bd35e009`/`63dd7cbb`.

## Onboarding actif + renommage tour + dashboard allégé (2026-09-04, nuit)

Travail en autonomie ("je vais dormir, termine ces deux fonctionnalités"), **rien
committé** — à revoir avant de committer soi-même. Migration Prisma écrite mais
**jamais appliquée à la DB**, comme demandé.

**Renommage de cohérence (préalable)** : le tour passif existant portait le nom
"onboarding" partout dans le code (dossier, contexte, hook, namespace i18n) alors que
ce n'est qu'une visite guidée (driver.js) — jamais rien collecté. Renommé en "product
tour" pour libérer "onboarding" pour la vraie fonctionnalité :
`domains/onboarding/` → `domains/product-tour/` (fichiers, composant
`OnboardingTourProvider`→`ProductTourProvider`, hook `useOnboardingTour`→
`useProductTour`, constante `ONBOARDING_STEPS`→`PRODUCT_TOUR_STEPS`, namespace i18n
`onboarding`→`productTour`). Aucun texte utilisateur touché (déjà "Revoir le guide",
jamais "onboarding" à l'écran). Renommage scopé au frontend uniquement — la colonne
DB `User.hasSeenOnboarding` reste inchangée (décision explicite : pas de migration
sur ce champ ce soir).

**Onboarding actif (3 étapes)** — `apps/web/domains/onboarding/onboarding-wizard.tsx`,
une Dialog plein-écran montée dans `dashboard/layout.tsx`, gardée par un nouveau champ
`User.hasCompletedOnboarding` (distinct de `hasSeenOnboarding`, qui reste le flag du
tour passif). Réutilise tel quel les composants Personnalisation existants
(`FollowedLeaguesCard`/`FollowedChannelsCard`/`RiskProfileCard`) — mêmes hooks, mêmes
endpoints, zéro nouvelle logique de fetch/mutation. Chaque étape est "skippable"
(bouton Passer = même action que Suivant, aucune des trois n'est jamais obligatoire),
et fermer la modale (X/Escape/clic overlay) termine l'onboarding plutôt que de
réapparaître en boucle. Le tour passif ne démarre plus tant que
`hasCompletedOnboarding` n'est pas vrai (effet de `ProductTourProvider` mis à jour
pour dépendre de ce champ) — séquencement onboarding→tour garanti, jamais les deux en
même temps.

Pas de titre redondant par étape dans la modale : chaque carte Personnalisation porte
déjà son propre eyebrow/sous-titre (`SettingsSectionCard`) — un titre de wizard
au-dessus aurait répété la même chose, exactement la redondance déjà nettoyée ailleurs
cette session (badge de canal, badge Coupons).

**Migration DB** — `packages/db/prisma/migrations/20260904020000_add_has_completed_onboarding/migration.sql`,
écrite à la main (pas de connexion DB dans cette session), **jamais exécutée** :

```sql
ALTER TABLE "users" ADD COLUMN     "hasCompletedOnboarding" BOOLEAN NOT NULL DEFAULT true;
```

Défaut `true` en base : les comptes existants sont considérés déjà "passés" ce stade
(ils n'ont jamais eu ce choix, pas de raison de le leur imposer rétroactivement).
`AuthService.register()` force explicitement `false` pour toute nouvelle inscription
— le seul endroit où ce champ doit démarrer à `false`. `prisma generate` lancé (lecture
seule du schéma, aucune connexion DB) pour que le typecheck backend/frontend voie le
nouveau champ ; 608/608 backend, typecheck/lint propres partout.

**Dashboard (Accueil) — un vrai problème de perf trouvé et corrigé, pas de refonte
visuelle spéculative.** Sans maquette ni plainte précise pour cette page (contrairement
à Decisions/Arbitrage où une capture disait exactement quoi corriger), le choix a été
de ne pas réinventer l'agencement à l'aveugle pendant que personne ne peut confirmer —
risque déjà vécu cette session (le premier tiroir de facettes Decisions, construit sur
la mauvaise lecture, a dû être refait). À la place, audit concret de ce qui existe
déjà :

- `DashboardService.getLeaderboard()` chargeait **tous les coupons réglés depuis le
  début des temps**, sans borne ni LIMIT, agrégeait tout en JS — un coût qui grossit
  chaque jour, sur une page visitée à chaque connexion. Borné à une fenêtre glissante
  de 90 jours (`LEADERBOARD_WINDOW_DAYS`, même ordre de grandeur que les autres
  fenêtres par défaut de cette session) — `getLeaderboardData(since: Date)` filtre
  maintenant sur `createdAt`. `getCompetitionStats` était déjà borné à 30 jours,
  vérifié, rien à changer là.
- Reste noté, pas corrigé ce soir (décision de fond, pas une question de perf) : ce
  classement reste basé sur le **ROI**, la métrique que ce doc qualifie ailleurs
  d'anti-prédictive et que Track Record/Investir ont abandonnée au profit de la
  calibration. Le changer demanderait de redéfinir ce qu'un "bon joueur" veut dire sur
  ce classement — à trancher avec l'utilisateur, pas cette nuit.
- Rien de périmé trouvé (aucune trace Investir/Combinés dans l'arbre Dashboard,
  vérifié). Pas de section admin qui fuiterait vers un joueur normal — le split
  `role === 'ADMIN'` dans `page.tsx` est déjà une séparation complète d'arbre, pas des
  sections conditionnelles dans un seul composant.

**Non testé visuellement** (aucun outil de rendu dans cette session, comme toujours) —
en particulier la modale d'onboarding (Dialog plein-écran + trois cartes
Personnalisation imbriquées, popover de découverte de canaux compris) mérite un
passage réel au navigateur avant de committer.

Vérifié : typecheck/lint propres sur les quatre workspaces (web, backend,
vantage-worker, analysis-core), 608/608 backend, 128/128 vantage-worker, 491/491
analysis-core. Rien committé — migration écrite, jamais appliquée.

## Corrections post-nuit + assainissement "Canaux suivis" (2026-09-04)

Passage réel au navigateur le matin du 04-09, plusieurs corrections issues d'un
retour direct de l'utilisateur sur ce que la nuit avait livré :

- **Arbitrage manquait du tour produit** (`product-tour-steps.ts`) — étape ajoutée
  entre "fixtures" et "coupons", ciblant `[data-tour="arbitrage-help"]`.
- **Texte de l'étape Arbitrage inexact** — copié du libellé de Decisions ("Le « ? »
  ici explique comment le lire") sans vérifier que le "?" d'Arbitrage fait la même
  chose : c'est un `InfoTooltip` simple, pas un lien vers l'article de formation.
  Reformulé en "détaille sa logique", qui décrit ce que ce tooltip fait réellement.
- **Coupons manquait sa place dans la nav mobile** après le retrait complet
  d'Investir — d'abord ajouté comme 4e slot ordinaire, puis corrigé une deuxième
  fois sur capture d'écran : Investir avait un style dédié (bouton central surélevé,
  fond plein) via `NavItem.featured`, déjà présent dans `page-shell.tsx` mais pas
  réutilisé. Appliqué à Coupons, repositionné au centre des 5 slots.
- **Icône Coupons** — `Ticket` remplacé par `Wand2` (canaux ≠ billets déjà posés
  par l'utilisateur, qui gardent `Receipt`/"Mes coupons" ; `Wand2` marque la
  génération assistée par VANTAGE).

**Étape "Canaux suivis" de l'onboarding — trois problèmes composés, signalés en un
message avec capture d'écran.** `FollowedChannelsCard`
(`apps/web/app/dashboard/params/account/components/followed-channels-card.tsx`),
réutilisé tel quel dans `OnboardingWizard`, portait trois défauts :

1. **Sous-titre inexact.** Affichait "Les canaux suivis ici alimentent vos
   notifications, Arbitrage et vos coupons" — vérifié par `grep` qu'aucun
   consommateur de `UserFollowedChannel`/`listFollowedChannels` n'existe hors du
   module `personalization` lui-même : suivre un canal aujourd'hui n'a **aucun**
   effet fonctionnel en aval. Reformulé pour décrire ce que la fonctionnalité fait
   réellement (retrouver la fiabilité mesurée d'un canal qu'on suit), sans
   fabriquer d'intégration qui n'existe pas. Deuxième passe demandée par
   l'utilisateur : retiré la clause pédagogique sur le ROI/la puissance
   statistique ("jamais un ROI simulé, aucune puissance statistique à ce volume")
   — jargon interne, sans valeur pour un user lambda ; gardé uniquement la
   définition de la calibration (réel vs annoncé).
2. **Notation brute "0.97× · n=2000"** dans le popover "Découvrir des canaux" —
   remplacée par le même badge qualitatif (`ChannelStatusBadge`,
   GREEN/ORANGE/RED, HoverCard tap-friendly) déjà utilisé pour ce même concept sur
   Decisions/Arbitrage (`CalibrationBadge`, channel-row.tsx) et sur le
   track-record. Masqué entièrement quand `INSUFFICIENT_DATA`, même règle que
   partout ailleurs cette session.
3. **Dichotomie "Prouvés"/"En observation" plus fidèle à rien** — il n'existe plus
   de palier "en observation" dans le produit actuel (VALUE/SAFE sont des filtres
   Phase 2, pas un vivier en attente). Les deux onglets sont retirés ; liste
   unique triée par fiabilité (GREEN → ORANGE → RED → INSUFFICIENT_DATA →
   INACTIVE).

**Confirmé le 2026-09-04** : migration `hasCompletedOnboarding` appliquée en
base, et l'onboarding actif + le redémarrage du tour passif qui en dépend
vérifiés en vrai navigateur sur un compte neuf — plus rien "à confirmer" sur
ce chantier (TODO.md P0 correspondant coché).

Bug de données trouvé au passage : **4 canaux fantômes** (`UNDERDOG`, `FAVORITE`,
`LIVE_VALUE`, `MARKET_MOVE`) fuitaient dans la liste suivable avec `n=0`
permanent — aucun fichier sous `strategies/` n'en produit jamais (grep confirmé,
zéro référence). Ce sont des restes d'enum jamais implémentés, gardés uniquement
pour ne pas planter si une valeur inattendue apparaît. Corrigé à la source :
nouveau `UNIMPLEMENTED_STRATEGY_CHANNELS`
(`packages/analysis-core/src/types/strategy-channel.ts`), ajouté à
`POOL_EXCLUDED_CHANNELS` (`pool-eligibility.ts`) — sans changement de
comportement pour le vrai pool de coupon (ces canaux n'y contribuaient déjà
jamais), et ça corrige gratuitement toute autre liste construite sur
`POOL_ELIGIBLE_CHANNELS`. VANTAGE, lui, reste éligible au pool réel mais exclu
localement de la liste "à suivre" (`personalization.service.ts`,
`FOLLOWABLE_CHANNELS`) — il a déjà sa propre page dédiée (Arbitrage), le suivre
via ce mécanisme générique ne sert à rien.

Vérifié : `pool-eligibility.spec.ts` (491/491 analysis-core) inchangé de
comportement — aucun test n'attendait la présence des 4 canaux fantômes ; le test
VANTAGE-inclus dans le pool reste vert. `personalization.service.spec.ts` mis à
jour pour le nouveau shape (`status` remplace `calibrationRatio`/`proven`) plus
deux assertions ajoutées (VANTAGE et UNDERDOG absents de la liste "à suivre").
608/608 backend, typecheck/lint propres sur web/backend/analysis-core. Rien
committé jusqu'à cette entrée — voir historique git pour le commit correspondant.

## Distinction soir/intraday + extension du correctif de cote VANTAGE (2026-09-04)

Les deux derniers items "reste ouvert" listés plus haut dans ce doc.

**Distinction visuelle coupon soir/intraday** — `coupon_proposal.signalWindowDays`
portait déjà le discriminant (38 = soir, `LEGACY_SIGNAL_WINDOW_DAYS`, ;
39 = intraday, `INTRADAY_SIGNAL_WINDOW_DAYS`, tous deux dans
`apps/vantage-worker/src/coupon/persist-coupon-proposal.ts`), simplement
jamais traduit en un champ lisible côté API/UI. `CouponProposalDto` porte
maintenant `batch: 'evening' | 'intraday'` (`coupon.service.ts`, dérivé de
`signalWindowDays` — `INTRADAY_SIGNAL_WINDOW_DAYS=39` copié dans
`coupon.constants.ts` côté backend, même duplication assumée que
`LEGACY_SIGNAL_WINDOW_DAYS` l'était déjà dans l'autre sens, ce discriminant
n'ayant aucune raison de vivre dans analysis-core). Frontend : un badge
"Intraday" (icône `Sun`, `components/coupon-card.tsx`) apparaît sur la carte
quand `batch === "intraday"` — rien pour "evening" (le batch par défaut, sans
rien de particulier à signaler), même convention que `ResultBadge` (rien tant
qu'il n'y a rien à dire).

**Extension du correctif de cote VANTAGE au-delà de Résultat** —
`market-odds.ts` ne lisait que `odds_snapshot.homeOdds/drawOdds/awayOdds`
(un seul home/draw/away par ligne), documentant lui-même que BTTS/OVER_UNDER
"nécessiteraient une étape d'agrégation" non construite. Cette agrégation
existe déjà ailleurs dans le repo : `assembleFullOddsSnapshot` +
`resolveSelectionOdds` (`@evcore/analysis-core`), la résolution de cote
générique par (marché, pick) que toutes les strategies de canal utilisent
déjà pour se pricer elles-mêmes, et que `apps/vantage-worker/src/coupon/
odds-batch.ts` réutilise déjà pour le pool de coupon — pas réinventée, juste
pas encore branchée ici.

- `loadFullOddsSnapshot(fixtureId)` (nouveau, `market-odds.ts`) remplace la
  requête ONE_X_TWO-only par une requête de toutes les lignes de cote de la
  fixture, assemblées en `FullOddsSnapshot` (cutoff = maintenant — VANTAGE
  analyse toujours en direct, contrairement au pool de coupon qui a besoin
  d'un cutoff figé pour le backtest).
- `MatchContext.fullOddsSnapshot` (nouveau champ) porte ce snapshot complet.
  `findKnownOdds` (`analyze-fixture.ts`, la fonction qui alimente à la fois
  le plancher `MIN_ODDS` et la cote persistée sur `ChannelSelection` de
  VANTAGE) résout maintenant via `resolveSelectionOdds(context.
  fullOddsSnapshot, market, pick)` — générique à **tout** marché, pas
  seulement les deux nommés dans le plan (BTTS, Plus/Moins) : le coût de
  généraliser au lieu de ne traiter que ces deux cas est nul, et ça ferme le
  vrai trou documenté plutôt que d'en fermer la moitié.
- Le bloc de contexte "prix brut du marché" (affiché au LLM pour les marchés
  qu'aucun canal n'a sélectionnés) reste volontairement plus restreint —
  `CONTEXT_MARKET_PICKS` (ONE_X_TWO, BTTS, et la ligne principale 2,5 buts
  d'OVER_UNDER seulement, pas ses 8 autres lignes) — pour ne pas ajouter de
  bruit à un prompt qui pèse déjà plusieurs blocs de contexte, sans bénéfice
  mesuré. `MarketOddsSnapshot` (`context/types.ts`) passe d'un triplet
  home/draw/away fixe à une forme générique `{ pick, odds }[]` pour
  accueillir BTTS (YES/NO) sans neuf champs ad hoc ; `prompt.ts`'s
  `renderMarketOddsBlock` en tire les libellés via `formatPickForDisplayFr`
  au lieu d'un tableau `ONE_X_TWO_PICKS` écrit à la main.

2 tests `prompt.spec.ts` mis à jour pour la nouvelle forme (aucun test dédié
pour `market-odds.ts` — même convention que les autres fichiers I/O de cette
app). Vérifié : typecheck/lint propres sur les quatre workspaces, 128/128
vantage-worker (inchangé), 491/491 analysis-core, 608/608 backend, typecheck
web propre. Pas testé en conditions réelles (aucun fixture BTTS/OVER_UNDER
non couvert observé cette session) — à confirmer sur les prochains verdicts
VANTAGE en prod. Pas encore committé.

## "Jouer ce coupon" sur les cartes Coupons (2026-09-04)

Mécanisme déjà décrit au §1 ("Bet slip") : un coupon généré par VANTAGE est un
**template partagé** — chaque utilisateur ajoute ses jambes à son propre bet
slip via le drawer existant, chacun sa mise, aucun écran dédié. Le composant
qui fait ça (`CouponSlipButton`, `components/coupon-card.tsx`, libellé "Jouer
ce coupon"/"Dans le coupon") existait déjà (bâti avec le reste du composant
partagé) mais n'était câblé nulle part — jamais branché à un vrai coupon.

**Le vrai trou trouvé en creusant** : `BetSlipService.create` (backend)
résout un pick "USER" via `modelRunId + market + pick` (recherche dans
`ModelRun.features.evaluatedPicks`, même mécanisme que `AddToSlipButton` sur
Matchs) — jamais via `fixtureId` seul. `CouponProposalLeg`
(`packages/db/prisma/schema.prisma`) ne stocke pas de `modelRunId`, et
`CouponLegDto` ne l'exposait donc pas non plus : rien ne permettait de
construire un item de bet slip valide à partir d'une jambe de coupon.

- `coupon.repository.ts` (`WITH_LEGS`) inclut maintenant le `ModelRun` le
  plus récent de chaque fixture (`orderBy: analyzedAt desc, take: 1`) — même
  convention "le run le plus récent fait foi" que `build-match-context.ts`/
  `find-eligible-fixtures.ts`. `CouponLegDto.modelRunId` (nouveau,
  `coupon.service.ts`) l'expose ; `null` sur le cas rare d'une fixture sans
  aucun ModelRun.
- Frontend (`apps/web/app/dashboard/coupons/components/coupon-card.tsx`,
  passé en composant client) construit un `BetSlipDraftItem` par jambe
  résolue (filtre les jambes sans `modelRunId`), et branche
  `CouponSlipButton` sur `useBetSlip()` — `onPlay` ajoute toutes les jambes
  (ou les retire si déjà toutes présentes, même bascule que
  `AddToCouponButton`), ouvre le tiroir si c'était le premier ajout. Bouton
  affiché seulement si `coupon.status === "PENDING"` (une fois
  ACCEPTED/REJECTED/EXPIRED, les fixtures ont déjà démarré/fini — même
  signal que celui qui arrête le worker de règlement).
- Pas de nouveau plafond côté carte coupon : le tiroir de bet slip affiche
  déjà l'avertissement `SLIP_LIMITS.MAX_ITEMS` si l'ajout dépasse 10
  sélections au total (mécanisme existant, pas dupliqué ici).

Vérifié : typecheck/lint propres sur les quatre workspaces (web, backend,
vantage-worker, analysis-core — ces deux derniers non touchés), 608/608
backend (inchangé, aucun test dédié — `coupon.service.ts` n'en a jamais eu).
Pas testé en navigateur cette session. Pas encore committé.

## Engagement réel sur les coupons — vues, joueurs, "déjà joué" (2026-09-04)

Complète le mécanisme ci-dessus : compteurs de vues/joueurs réels (jamais
fabriqués — garde-fou §4 point 6) et gel du bouton "Jouer ce coupon" une fois
joué. Deux nouvelles tables, migration écrite mais **pas appliquée** (comme
d'habitude, l'utilisateur lance ses migrations lui-même) :

- `CouponProposalView` (unique `[couponProposalId, userId]`) — une vue par
  utilisateur distinct, jamais par chargement de page. Enregistrée par le
  nouvel endpoint `POST /coupons/:id/view` (idempotent, upsert), appelé une
  fois au montage de chaque carte (`coupon-card.tsx`).
- `CouponProposalPlacement` (unique `[couponProposalId, userId]`, et
  `betSlipId` unique) — une ligne par utilisateur ayant réellement soumis un
  bet slip via "Jouer ce coupon". Enregistrée **côté serveur**, dans la même
  transaction que la création du bet slip (`BetSlipService.create`) — jamais
  depuis un clic client seul, pour que "N joueurs" ne compte que des paris
  réellement soumis. `CreateBetSlipDto.couponProposalId` (nouveau, optionnel)
  porte l'id ; un id inconnu/périmé est ignoré silencieusement plutôt que de
  faire échouer toute la soumission — placer un pari ne doit jamais casser
  sur un souci de tracking d'engagement.
- `GET /coupons` passe sous `AuthSessionGuard` (ne l'était pas — nécessaire
  pour savoir qui demande, `playedByMe` en dépend) ; `CouponProposalDto`
  porte désormais `viewerCount`/`playerCount`/`playedByMe`.
- Frontend : `CouponSlipButton` a un troisième état, "Déjà joué par vous"
  (readonly, plus de handler de clic) quand `coupon.playedByMe`. Le compteur
  de vues/joueurs s'affiche sous les badges de la carte (icônes `Eye`/
  `Users`), masqué à 0 plutôt que d'afficher "0 vue" (rien à dire, pas un
  signal négatif). `BetSlipDraft.couponProposalId` (nouveau) porte l'id le
  temps que l'utilisateur passe de "Jouer ce coupon" à la soumission réelle
  dans le tiroir — posé par `handlePlay`, effacé en repassant en
  "Dans le coupon" (toggle off) ou par `clearDraft()` (déjà remis à `null`
  via `emptyDraft`).

Vérifié : typecheck/lint propres sur les quatre workspaces, 608/608 backend,
128/128 vantage-worker (inchangé), 491/491 analysis-core (inchangé). Pas
testé en navigateur cette session. Committé (`fd117fe4`) — migration à
appliquer avant de tester en vrai.

## Divers post-chantier — perf Matchs, badge de rôle, accessibilité, téléphone, signup (2026-09-04)

Hors chantier VANTAGE à proprement parler (repris ici pour garder une trace
chronologique unique de la session) — détail complet dans TODO.md, section
"Front web côté joueur — audit UX externe" :

- **Page Matchs 2-3× plus lente** — la pagination existait déjà côté
  backend (`FIXTURE_SCORING_PAGINATION`) ; le vrai coût est la sélection
  imbriquée `fixture→modelRuns→bets→channelSelection→channelDecision`
  (plusieurs requêtes groupées par page, pas un seul JOIN) combinée à un
  défilement infini strictement séquentiel. `defaultLimit` remonté à
  `maxLimit` (100, déjà le plafond) + `rootMargin: "600px"` sur
  l'`IntersectionObserver` pour précharger pendant le scroll.
- **Badge de rôle incohérent** ("Membre" vs "Opérateur" pour le même
  compte) — `app-shell.tsx` avait son propre mapping en dur, déconnecté du
  catalogue i18n `account.roles.*` déjà utilisé par la page Profil.
  Unifié sur la même source.
- **Accessibilité** — `DrawerDescription` ajoutée (sr-only) sur le tiroir
  de bet slip, et `DialogDescription` (visible, utile) sur la modale
  d'onboarding active — les deux émettaient le même avertissement Radix
  "Missing Description".
- **Numéro de téléphone** — `User.phoneNumber`/`phoneNumberConsentGiven`
  (migration écrite, pas appliquée), collecté dans l'onglet Profil
  (`phone-number-row.tsx`) seulement après consentement explicite activé
  par un interrupteur — jamais à l'inscription. Révoquer le consentement
  efface le numéro stocké. Format libre, texte de consentement confirmé
  avec l'utilisateur : prospection terrain, jamais de démarchage
  automatisé.
- **Signalement "des personnes n'arrivent pas à s'inscrire"** — investigué
  en conditions réelles (Playwright, pas juste lecture de code) : parcours
  complet, doublon email, mobile, onboarding jusqu'au bout, rechargement —
  tout fonctionne sans erreur, aucune reproduction locale. `AuthService.
  register` ne loggait rien avant (ni succès ni rejet) — ajouté
  `register: account created` / `register: rejected` (avec le champ
  précis en collision) pour que le prochain signalement soit exploitable ;
  message client inchangé (volontairement générique, anti-énumération de
  comptes). Non résolu — en attente d'un accès aux logs prod ou d'un
  message d'erreur précis rapporté par un utilisateur touché.

Vérifié : typecheck/lint propres sur backend/web, 608/608 backend à chaque
étape. Nav order + perf fix + badge de rôle + téléphone committés par
l'utilisateur (`91334c4d`) ; le fix d'accessibilité de la modale
d'onboarding et le logging de `register` restent à committer.
