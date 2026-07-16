# EVCore — Modèle économique

> Document de cadrage stratégique, pas un plan d'implémentation. Rien ici n'est encore
> construit côté billing — voir §8 pour ce qui manque techniquement.
> Analyse basée sur une lecture complète du code (backend, ml-worker Python, web) et des
> données réelles en base au 2026-07-16, pas sur la description aspirationnelle d'EVCORE.md.
> Mise à jour 2026-07-16 : chat support 1:1 + notifications web push (support et annonces) +
> opt-in email par utilisateur construits depuis la version précédente — voir §2 et §6.
> Mise à jour 2026-07-16 (bis) : recadrage stratégique — EVCore n'a pas encore été promu,
> l'application est neuve. Les 20 comptes actuels ne sont pas un signal produit, ce sont des
> comptes internes pré-lancement (voir §7). Le raisonnement se fait en produit/LTV, pas en
> traction observée. Positionnement produit clarifié : on ne vend pas des "canaux", on vend de
> l'analyse curatée, des coupons composés, et de l'accompagnement — voir §6. Le pricing est
> dynamique par construction, pas un catalogue figé — voir §6.
> Contexte technique : [EVCORE.md](../EVCORE.md) · État d'avancement : [ROADMAP.md](../ROADMAP.md)
> Maintenance des chiffres cités (formation + ce document) : [formation-content-maintenance.md](./formation-content-maintenance.md)

---

## 1. Résumé exécutif

EVCore est un moteur multi-canal complet et opérationnel, avec des chiffres de backtest réels
et globalement solides sur son canal phare (VALUE) et une fonctionnalité de génération de
coupon déjà backtestée positivement. L'application n'a pas encore été promue — les 20 comptes
actuels sont des comptes internes pré-lancement, pas un échantillon d'utilisateurs à analyser.
Trois points structurent la stratégie produit à partir de ce constat :

1. **Le produit ne se vend pas par canal, il se vend par niveau de curation et
   d'accompagnement.** VALUE (mise réelle) et le Coupon Composer sont les deux actifs qui
   tiennent hors échantillon — ce sont eux qui justifient le prix, pas un accès brut à chaque
   signal. BTTS/GOALS et les autres signaux nourrissent la curation en coulisse ; ils ne sont
   jamais vendus comme un produit autonome. Détail de l'offre en §6.
2. **L'IA n'est pas encore un argument de vente honnête.** La couche de correction ML
   (Phase 3) est **100% shadow** — elle ne touche jamais un pick réellement montré à un
   utilisateur, et le pipeline qui l'alimente est même resté cassé (aucun `ModelRun` shadow
   généré) après la dernière activation de modèle. Eva est un vrai outil utile mais reste un
   assistant d'analyse single-shot, pas un moteur de décision — le présenter comme "l'IA qui
   trouve vos picks" serait factuellement faux.
3. **La formation est une brique de confiance à construire, pas un module de gamification
   décoratif.** Si le produit vend de la curation plutôt que du picking brut, le client doit
   comprendre pourquoi le Composer a choisi ce coupon — sinon EVCore devient un tipster comme
   un autre. L'état actuel (7 badges, 16 débloqués au total) est un habillage, pas un contenu
   pédagogique réel. C'est un prérequis de lancement, pas un chantier post-lancement — voir §7.
4. **Le mécanisme d'"accompagnement personnalisé" du palier Business est maintenant un vrai
   outil construit** : chat 1:1 temps réel entre un utilisateur et l'équipe EVCore,
   notifications web push (support + annonces), et opt-in email par utilisateur. L'usage
   actuel (0 abonnement push actif, 10 conversations de test) n'est pas un signal — l'outil a
   été livré la veille du recadrage stratégique, avant tout lancement public.

Recommandation inchangée sur le fond : **abonnement SaaS freemium**, pas d'affiliation
bookmaker, avec un **pricing dynamique** plutôt qu'un catalogue figé (détail §6). L'ordre des
étapes est produit-first : finaliser la formation et l'historique public, puis lancer — pas
attendre un signal de traction qui n'a pas de raison d'exister avant tout lancement (§7, §9).

---

## 2. Ce qu'on a construit — état réel par brique

| Brique                                      | Statut réel                                                    | Chiffre à l'appui                                                                                                                                                                                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **VALUE** (mise réelle)                     | Solide, seul canal qui tient hors échantillon                  | Top5 par edge calibré : **+14.98% ROI** tout historique (295 picks) ; **+2.27%** sur le seul 2026 forward — le seul classement qui reste positif hors échantillon, quand le tri par probabilité brute tombe à -12.70%                                              |
| **SAFE** (mise réelle)                      | Prometteur mais échantillon trop fin                           | Seulement 28 jours éligibles au top5 toute la période testée — ROI qui varie de -27% (train) à +2/+10% (2026) : pas assez de volume pour figer une formule                                                                                                         |
| **DOMINANT** (signal)                       | La preuve que le ranking sauve un canal faible                 | Canal complet : **-23.27% ROI** ; mais top5 par probabilité : **+3.30% ROI** — la valeur est dans le classement, pas le canal brut                                                                                                                                 |
| **DRAW** (signal)                           | En amélioration réelle, pas un vœu pieux                       | +1.61% ROI toute la période (1 119 picks), mais +11 à +16% sur 2026 selon la formule vs -19% en 2023                                                                                                                                                               |
| **BTTS / GOALS** (signaux)                  | Pas rentables sur aucun classement testé à ce jour             | BTTS canal complet -37.22% ROI, GOALS -26.05% — ce sont des signaux à fort volume, pas des canaux à edge prouvé                                                                                                                                                    |
| **Coupon composer** (génération auto Top 3) | Réellement curaté, backtesté, positif                          | Documenté dans le code : Train ROI +100.3%, **Test ROI +61.8%**, hit rate test 51.5%, verdict **PASS** (2026-05-19) — c'est aujourd'hui l'actif le plus vendable du produit                                                                                        |
| **Investment (page "Investir")**            | Fonctionnalité distincte du coupon, pas un doublon             | Classe les picks individuels par probabilité de gain réelle (pas par EV brut — choix backtesté), applique une correction de biais par canal (ex. SAFE surconfiant de +12.5pt), exclut les picks GOALS qui contredisent le lambda Poisson du moteur                 |
| **Correction ML (Phase 3)**                 | **100% shadow, jamais consommée dans une décision réelle**     | Flag `ML_CORRECTION_ENABLED` off par défaut ; même activé, le résultat n'est écrit que dans `ModelRun.features` (log), jamais lu par le code qui construit le pick final. Pipeline resté cassé après la dernière activation (aucun `ModelRun` shadow généré)       |
| **Eva** (analyse Groq single-shot)          | Utile, mais un assistant, pas un moteur                        | Modèle `llama-4-scout-17b` (tier gratuit Groq), 1 appel non-streamé par analyse, 2048 tokens max, quota **50 requêtes/jour, identique pour tous les utilisateurs** — aucune distinction de palier n'existe                                                         |
| **Module Audit**                            | Base de transparence déjà là, non packagée                     | Endpoints publics (`/fixtures`, `/overview`) exposant picks, probabilités, EV et résultats réglés — c'est un outil ops interne aujourd'hui, pas une page "preuve de traçabilité" présentée aux utilisateurs                                                        |
| **Gamification + Formation**                | Squelette technique en place, contenu pédagogique à construire | 7 badges définis, **16 débloqués au total** — le mécanisme de gamification existe mais le contenu de formation réel (comprendre l'edge, la variance, lire un coupon composé, gérer sa bankroll) reste à écrire ; prérequis de lancement, voir §7                   |
| **Chat support 1:1 + notifications push**   | Construit (2026-07-16), pas encore adopté                      | Chat temps réel utilisateur ↔ équipe EVCore, web push (VAPID) pour le support et les annonces, opt-in email par utilisateur (settings) — **10 conversations, 6 messages, 0 abonnement push actif** sur 20 comptes ; l'outil du palier Business existe, l'usage non |
| **Billing / Stripe / entitlements**         | Inexistant                                                     | Rien à vendre tant que ça n'existe pas — §8                                                                                                                                                                                                                        |
| **Traction utilisateur**                    | Non pertinent avant lancement                                  | 20 comptes internes (1 admin + 19 operators), pré-lancement — pas un échantillon à analyser ni un signal produit ; à ne pas citer dans un pitch, ni comme preuve ni comme problème                                                                                 |

---

## 3. Où est la vraie valeur (et où elle n'est pas) — mis à jour

Ce qui a une valeur marchande démontrée par les chiffres, pas par l'intuition :

- **VALUE + son classement par edge calibré** est le seul actif qui résiste à l'épreuve du
  hors-échantillon (2026 forward toujours positif). C'est la seule chose qu'on peut mettre en
  avant sans réserve dans un argumentaire commercial.
- **Le coupon composer** est un vrai produit fini, pas une fonctionnalité brute : sélection,
  anti-corrélation, scoring, backtest documenté et positif (Test ROI +61.8%). C'est l'actif le
  plus proche d'un "produit premium" vendable tel quel.
- **Investment** apporte une deuxième porte d'entrée honnête : des picks individuels classés
  par vraie probabilité, avec correction de biais mesurée par canal — un signal de rigueur
  différenciant si on le montre (pas seulement le résultat, mais la correction elle-même).

Ce qui n'a **pas** de valeur marchande aujourd'hui, à ne surtout pas vendre en premier :

- **BTTS et GOALS** ne sont rentables sur aucun classement testé — les vendre comme des
  "canaux premium" serait mentir sur la base des propres chiffres du produit. Ils restent des
  signaux de volume/exploration, à présenter comme tels.
- **"IA" comme argument marketing** : la correction ML n'affecte aucun pick réel (shadow pur,
  pipeline même cassé récemment) et Eva est un assistant d'analyse ponctuel, pas un système de
  décision autonome. Toute communication du type "notre IA choisit vos paris" serait factuellement
  fausse au regard du code actuel — au mieux un futur argument, pas un argument présent.
- **La traction elle-même** : avec 20 comptes et 2 bet slips utilisateur créés, il n'y a rien
  à montrer en "preuve sociale". Un pitch qui s'appuierait sur "nos utilisateurs" serait
  fabriqué. Le seul chiffre honnête à montrer aujourd'hui est la performance du moteur, pas
  l'adoption.

---

## 4. Le cadre légal — garde-fous à construire, pas un préalable bloquant

EVCore ne prend aucune mise, ne détient aucun fonds joueur, et ne verse aucun gain lié à un
résultat sportif sur la plateforme. La régulation ANJ (licence d'opérateur, contrôle des
mises, séquestre des fonds joueurs) s'applique aux **bookmakers**, pas à un service
d'analyse/pronostics payant. Vendre des analyses sportives par abonnement est une activité
éditoriale légale en France sans licence d'opérateur — ce n'est **pas un point bloquant** avant
de vendre.

Ce qui reste réel, comme garde-fous à intégrer dès le départ :

- **Discours commercial** : ne jamais promettre un gain garanti (droit de la consommation,
  pratiques commerciales trompeuses — pas une règle spécifique aux jeux d'argent). Tout ROI
  affiché doit rester explicitement historique et daté, jamais projeté.
- **Vendre BTTS/GOALS comme "premium" serait aussi un problème de pratique commerciale
  trompeuse** au vu des chiffres du §2 — indépendamment de toute régulation jeu d'argent, c'est
  déjà un motif d'alerte de droit commun.
- **Processeurs de paiement** : Stripe classe parfois les services liés aux paris sportifs en
  "high-risk"/restricted business même sans prise de mise — à vérifier avant intégration.
- **Affiliation bookmaker = seul vrai changement de régime réglementaire.** Raison suffisante
  pour l'exclure du modèle économique (§5), indépendamment du reste.

**Action recommandée, non bloquante** : avis juridique utile avant un lancement commercial à
l'échelle, mais ne conditionne pas le fait de commencer à construire et tester.

---

## 5. Modèles de revenus envisageables

| Modèle                                                 | Fit avec l'existant                                                                                                                                                                               | Recommandation                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Abonnement SaaS freemium**                           | Excellent — la distinction VALUE (staked, prouvé) / signaux (BTTS/GOALS non prouvés) donne une frontière honnête free/premium ; le coupon composer backtesté positif est un vrai argument premium | **Recommandé, modèle principal**                                                                              |
| **Paiement à l'usage (coupon ponctuel / crédits Eva)** | Techniquement simple, mais Eva coûte des tokens Groq réels par appel (quota actuel 50/j identique pour tous — pas soutenable en gratuit illimité si un palier payant existe)                      | Complément seulement, pour metering Eva au-delà d'un quota inclus                                             |
| **Affiliation bookmaker (CPA/revshare)**               | Contredit le positionnement, dépendance à des acteurs dont l'intérêt est opposé à celui d'EVCore                                                                                                  | **Écarté**                                                                                                    |
| **B2B / API interne**                                  | Cohérent à terme (architecture déjà découplée), mais prématuré : le produit lui-même n'a pas encore de traction B2C à démontrer à un client B2B                                                   | Complément à moyen terme, pas un point de départ                                                              |
| **Communauté premium (leaderboard/badges)**            | Le mécanisme existe mais n'est quasiment pas utilisé (16 badges débloqués au total) — pas encore prouvé comme levier                                                                              | Garder en levier de rétention, ne pas le vendre comme feature autonome tant que l'usage réel n'est pas prouvé |

---

## 6. Structure retenue : essai → gratuit → Premium → Business

Reformulation du principe de vente : **on ne vend pas un accès à des canaux, on vend trois
choses — de l'analyse (la preuve), de la curation (le Coupon Composer, Investment), et de
l'accompagnement (Business)**. Les canaux individuels (VALUE, SAFE, DOMINANT, BTTS, DRAW,
GOALS) sont la matière première du moteur, jamais des SKU vendus séparément. Un client Premium
ne "débloque pas BTTS" — il achète l'accès à la curation complète, qui elle-même sait quoi
faire ou ne pas faire de BTTS.

Décisions actées : l'essai redescend vers un palier gratuit limité plutôt qu'un paywall dur ou
un accès illimité ; les coupons manuels de l'équipe sont tracés publiquement au même standard
que le reste du moteur ; le palier Business a une capacité explicitement plafonnée ; **le
pricing est dynamique, pas un catalogue figé** (détail en fin de section).

### 0 — Essai (30 jours, à l'inscription)

- Accès complet à l'expérience curatoire : Coupon Composer, Investment, VALUE temps réel,
  formation complète, gamification, Eva (quota standard)
- Sauf : export de la fiche EVCore
- 1 device
- À J+30 : bascule automatique vers le palier Gratuit (pas de coupure brutale, conversion
  progressive vers Premium plutôt qu'un mur payant immédiat)

### Gratuit (permanent, après l'essai)

- **VALUE** en lecture différée (ex. J-1) — la seule preuve qu'on peut montrer sans risquer
  l'argent réel de personne, et le meilleur teaser honnête de ce que fait le moteur
- Formation + gamification en accès libre — canal d'acquisition et de pédagogie, jamais gaté
- Pas de Coupon Composer, pas d'Investment complet, pas de coupons manuels équipe, pas
  d'export, Eva en quota réduit
- 1 device

### Premium (abonnement payant) — le produit central

- **Coupon Composer** (Top 3 quotidien, backtesté +61.8% test ROI) — l'argument de vente
  principal : "on curate pour toi", pas un accès à des données brutes
- **Investment** (classement probabiliste avec correction de biais par canal) — la deuxième
  porte d'entrée pour le client qui préfère des picks individuels à un coupon groupé
- Analyse complète en temps réel sur tous les signaux du moteur, **présentée avec son statut
  réel** (edge prouvé vs signal d'exploration — voir §2/§3) : jamais de signal non prouvé
  vendu comme un edge démontré
- **Coupons manuels de l'équipe EVCore — diffusion large** (annonce dashboard ou page dédiée,
  visibles par tous les abonnés Premium+), avec un **ROI/hit-rate public tracké au même
  standard que le reste du moteur** — condition non négociable pour rester cohérent avec le
  positionnement "discipline mesurable, pas un générateur de tips" (voir §8 pour ce que ça
  implique techniquement)
- Formation avancée avec suivi de progression individuel, export de la fiche EVCore, Eva en
  quota étendu
- 2 devices

### Business (abonnement payant, capacité explicitement plafonnée — ex. 10-15 places affichées)

- Tout Premium, plus un vrai service humain, pas une feature :
  - **Accompagnement par l'équipe EVCore — suivi personnalisé.** Le canal existe déjà
    techniquement (chat 1:1 temps réel + notifications web push construits le 2026-07-16,
    voir §2) — reste à réserver ce canal aux clients Business via entitlement (aujourd'hui il
    est disponible à tout utilisateur authentifié, sans distinction de palier, puisqu'aucun
    entitlement n'existe encore — §8).
  - Définition d'un objectif de profil de pari (ROI cible, bankroll, tolérance au risque) et
    revue périodique de la trajectoire réelle vs objectif — **ceci reste à construire**, le
    chat ne fait qu'ouvrir un canal de discussion, pas un suivi structuré d'objectif
  - **Coupons manuels ciblés** — même mécanisme de composition que les coupons Premium, mais
    diffusé à un ou plusieurs utilisateurs précis plutôt qu'à tous les abonnés : le coach
    compose un coupon adapté au profil/objectif de CE client, pas un contenu générique. C'est
    la vraie différence structurelle avec le coupon Premium (diffusion large) — même
    fonctionnalité de composition, cible différente
- Le plafond de places n'est pas qu'une contrainte opérationnelle : c'est aussi l'argument
  marketing (rareté réelle, pas artificielle — l'équipe actuelle ne peut honnêtement pas suivre
  plus de N clients en accompagnement humain)
- Prix nettement supérieur aux deux autres paliers, reflétant le temps humain réel engagé — ne
  pas le sous-tarifer sous prétexte que "c'est juste un palier de plus"

**Sur le tracking des coupons ciblés** : un coupon diffusé à un seul client relève du conseil
personnalisé, pas d'une allégation produit générale — il doit rester tracké (le client voit sa
propre performance dans son suivi d'objectif), mais n'a pas vocation à être agrégé dans le ROI
public affiché aux prospects (coupons Premium ci-dessus). Mélanger les deux fausserait le
chiffre public dans un sens comme dans l'autre — à garder strictement séparés dans le modèle de
données comme dans l'affichage.

Ne pas construire de 5ᵉ palier avant d'avoir des utilisateurs payants réels à qui demander ce
qu'ils veulent en plus.

### Pricing dynamique, pas un catalogue figé

Le tarif de chaque palier n'est pas une constante gravée dans le produit — c'est un paramètre
ajustable (offre de lancement, test A/B, palier fondateur verrouillé, ajustement par marché ou
par cohorte). Conséquence technique directe : le prix ne doit jamais être hardcodé dans le
front ni dans les entitlements — il vit dans la configuration du `Plan` Stripe (§8), interrogé
au moment de l'affichage et du paiement, jamais mémorisé côté client.

Repères de lancement (à valider, pas figés) :

- **Offre fondateur** : un tarif Premium verrouillé à vie pour les N premiers abonnés (ex. les
  100-200 premiers) — crée de l'urgence au lancement sans dévaloriser le prix catalogue
  ultérieur, et donne un signal de rareté cohérent avec le plafond du palier Business.
  Repère de départ : Premium ≈ 30-40€/mois, Business ≈ 150-250€/mois pour 10-15 places — à
  confirmer par test, pas par intuition.
- **Annuel** : une seule remise annuelle par palier au lancement, pas de multiplication
  d'options avant d'avoir des retours réels de conversion.
- **Contrainte légale inchangée** : quel que soit le prix affiché, aucun ROI ne doit être
  formulé comme une promesse de gain — toujours historique et daté (voir §4).

---

## 7. Prérequis de lancement : produit-first, pas traction-first

L'application n'a pas encore été promue — les 20 comptes actuels sont internes, pré-lancement.
Ce n'est donc pas un problème de traction à résoudre, c'est un chantier de préparation de
lancement à finir. Le raisonnement se fait en LTV/produit attendu, pas en usage observé
aujourd'hui. Ce qui doit être vrai **avant** le grand lancement :

1. **Une formation réelle, pas décorative.** Le produit vend de la curation (Composer,
   Investment) plutôt que du picking brut — le client doit comprendre pourquoi un coupon a été
   composé ainsi, sinon EVCore devient un tipster comme un autre malgré des chiffres
   supérieurs. C'est un prérequis produit, pas un chantier d'engagement post-lancement.
   Contenu à construire en détail — voir la suite de la conversation produit.
2. **Un vrai historique de traçabilité public** — l'audit module a déjà les données
   (`/fixtures`, `/overview`), il manque une page qui les présente comme une preuve de track
   record plutôt qu'un outil de debug interne. C'est l'actif de conversion n°1 au lancement :
   la preuve chiffrée remplace la promesse.
3. **Ne pas vendre l'IA tant qu'elle n'agit pas réellement** — soit finir la promotion hors
   shadow de la couche ML (actuellement bloquée), soit ne jamais en faire un argument avant
   que ce soit vrai. Ce point ne dépend pas du calendrier de lancement, il dépend de l'état du
   code.
4. **Le chat/push Business doit être gaté avant le lancement**, pas après — aujourd'hui
   disponible à tout utilisateur authentifié sans entitlement (§8). Le livrer grand public par
   défaut au lancement viderait l'argument de rareté du palier Business avant même de l'avoir
   vendu.

Ce chantier ne dépend d'aucun signal d'usage actuel — il conditionne la qualité du lancement
lui-même, pas une hypothèse à valider avant de lancer.

---

## 8. Ce qui manque techniquement pour vendre

1. **Provider de paiement** (Stripe) — abonnements récurrents, essais, webhooks.
2. **Modèle `Subscription`/`Plan`** en base + entitlement sur `User`, indépendant du `role`
   `ADMIN/OPERATOR` déjà existant. Le prix vit dans la config du `Plan` (source Stripe),
   jamais hardcodé dans le front — condition du pricing dynamique posée en §6.
3. **Gate d'accès** sur les endpoints premium (coupon composer, Investment, SAFE/DRAW) —
   aujourd'hui tout est ouvert à tout utilisateur authentifié. Le chat support (§2) suit la
   même règle : rien ne le réserve aujourd'hui au palier Business, il faudra ajouter cette
   distinction en même temps que le reste des gates d'entitlement.
4. **Quota Eva par palier** — le `ChatUsage`/rate-limit existant est un quota technique global
   (50/j pour tous), pas un mécanisme de palier ; à distinguer explicitement.
5. **Pages légales** (CGU, confidentialité, mentions de jeu responsable) et **page de
   pricing** — aucune des deux n'existe.
6. **Page de track record public** — les données existent (module Audit), l'UI utilisateur
   non.
7. **Limitation par device** — le modèle `Session` actuel logue IP/userAgent mais n'a aucune
   notion de device ni de cap ; il faut soit un fingerprint device, soit une limite de sessions
   actives simultanées, plus la mécanique de dé-connexion quand la limite est dépassée.
8. **Coupons manuels de l'équipe** — nouvelle entité à créer (distincte de `CouponProposal`,
   qui est générée par le moteur), avec son propre settlement et son propre ROI/hit-rate
   public tracké — condition posée en §6 pour rester cohérent avec le positionnement produit.
   Doit porter une **visibilité** explicite dès la conception (`BROADCAST` vs `TARGETED`),
   pas une distinction ajoutée après coup : un coupon broadcast s'agrège au ROI public
   (prospects), un coupon ciblé reste privé au(x) client(s) désigné(s) (Business) et alimente
   leur suivi d'objectif personnel — les deux doivent être exclus l'un de l'autre dans tout
   calcul agrégé pour ne pas fausser le chiffre affiché publiquement.
9. **Interface de composition admin** pour les coupons manuels — l'admin doit pouvoir composer
   un coupon à la main et le publier (annonce dashboard ou page dédiée pour un coupon
   broadcast ; sélecteur d'un ou plusieurs clients Business pour un coupon ciblé) ; rien de tel
   n'existe aujourd'hui, à construire au-dessus de l'`Announcement` model existant (broadcast
   seulement — il n'a pas de notion de destinataire) ou d'une nouvelle table qui, elle,
   supporte les deux modes nativement.
10. **Suivi d'objectif de profil de pari (Business)** — nouvelle entité pour stocker l'objectif
    convenu avec le client (ROI cible, bankroll, tolérance au risque) et rapprocher sa
    trajectoire réelle (bets + coupons ciblés reçus) de cet objectif dans le temps ; rien
    d'équivalent n'existe aujourd'hui (le profil utilisateur actuel n'a que `unitMode`/
    `unitAmount`/`unitPercent`, pas d'objectif ni de suivi de trajectoire).

---

## 9. Risques à surveiller

- **Lancer avant que la formation et la preuve publique soient prêtes** : le grand lancement
  est la stratégie d'acquisition retenue (pas une traction organique à attendre) — mais lancer
  sans contenu pédagogique réel ni page de track record revient à vendre la promesse "discipline
  mesurable" sans en donner les moyens de vérification au client. Le risque n'est pas de lancer
  tôt, c'est de lancer incomplet sur ces deux points précis (§7).
- **Sur-vendre BTTS/GOALS ou l'IA** : les deux points où le produit ne tient pas encore ses
  propres chiffres — un seul utilisateur qui compare le ROI annoncé à son vécu suffit à casser
  la confiance.
- **Churn narratif** : si le produit glisse vers "des picks" plutôt que "une discipline
  mesurée", il perd son seul vrai différenciateur face aux comptes tipster gratuits.
- **Coupons manuels non tracés dès le lancement** : publier des coupons manuels avant que leur
  ROI public soit implémenté (§6/§8) recréerait exactement le service de tips non vérifiable
  que le positionnement d'EVCore rejette — à ne pas lancer en avance sur la traçabilité.
- **Friction du device-limiting** : un utilisateur qui perd l'accès sur son 2ᵉ appareil sans
  message clair (pourquoi, comment gérer ses devices) se traduit en support/churn plus qu'en
  levier de conversion — prévoir une page de gestion des sessions actives, pas juste un blocage.

---

## 10. Prochaines étapes concrètes

1. **Construire le contenu de formation réel** (edge, variance, lecture d'un coupon composé,
   bankroll) — prérequis de lancement, pas un chantier d'engagement post-lancement (§7).
2. Construire la page de track record public (données déjà là via le module Audit) — l'actif
   de conversion le plus rentable à produire pour le lancement.
3. Construire l'entité "coupon manuel équipe" + son settlement + son ROI public — **avant**
   de publier le moindre coupon manuel, pas après (§9).
4. Définir la capacité réelle du palier Business (combien de clients l'équipe peut
   honnêtement suivre) et fixer un repère de prix dynamique en fonction de ce plafond (§6).
5. Redéfinir le quota Eva par palier (aujourd'hui un flat 50/j technique, pas un plan produit)
   et construire la limitation par device (aucune infra existante aujourd'hui).
6. Vérifier la catégorisation Stripe (restricted businesses) et caler le wording commercial —
   pas bloquant, mais à faire avant d'intégrer un paiement.
7. Intégration Stripe + modèle `Subscription`/`Plan` (prix piloté par config, jamais hardcodé)
   - gate d'accès, une fois 1-4 validés.
8. Grand lancement avec la structure essai → gratuit → Premium → Business, tarif fondateur
   verrouillé sur les premiers abonnés, mesurer la conversion réelle avant d'ajuster le
   pricing dynamique ou d'envisager le B2B.
