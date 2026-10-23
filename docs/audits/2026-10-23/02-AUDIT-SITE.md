# Audit de c-evcore.com — QA, UX, conversion

_Audit du 23/10/2026, mis à jour le même jour après le test en direct du parcours connecté. Site en production confronté au dépôt `coulbyl/EVCore` (commit `e74af2b`, 19/10/2026). Voir aussi `01-FICHE-PRODUIT.md`._

## Méthode et limites

- **Parcours public testé en direct**, navigateur Chromium sans interface, en 1440×900 puis en 375×812 (profil iPhone) : accueil, inscription, connexion, mot de passe oublié, accès direct au tableau de bord, pages légales et tarifs attendues, page 404, `robots.txt`, `sitemap.xml`, manifeste, image d'aperçu de partage. Mesures relevées : statut HTTP, balises title/meta/Open Graph, temps de réponse, LCP, CLS, poids, débordement horizontal, erreurs console.
- **Parcours connecté testé en direct sur desktop**, dans la session Chrome que vous avez ouverte avec un compte de rôle Opérateur (le rôle d'un nouvel inscrit) : accueil, Coupons (aujourd'hui et veille), Avis IA, Décisions, Matchs, Mes coupons et classement, Formation, Mesures historiques (30 jours, 90 jours, tout l'historique), Bankroll, Profil. Aucun coupon joué, aucun dépôt, aucun réglage modifié.
- **Limites** : ce compte existe depuis avril, l'onboarding et la première visite d'un inscrit n'ont donc pas pu être revus en direct (captures du 11/10 dans le dépôt utilisées à la place). La fenêtre Chrome n'a pas pu être réduite à 375 px : le parcours connecté sur mobile repose sur les captures du dépôt (`docs/audits/2026-10-11/ux-review`, `docs/audits/2026-10-12/captures`). Je n'ai pas créé de compte de test, car je n'ouvre pas de compte moi-même sur un site en production.
- **Aucun paiement à tester** : il n'existe ni abonnement, ni tarif, ni paiement dans le produit (fiche produit §4).
- Les temps mesurés viennent d'un serveur bien connecté. Ils ne représentent pas une connexion mobile 3G/4G à Abidjan.

## Synthèse

| Axe                                    | État                                                                                                                                                                                                                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proposition de valeur en 5 s           | Insuffisante : le mot « football » n'apparaît pas au-dessus de la ligne de flottaison, le visiteur comprend « investissement » avant « paris sportifs ».                                                                                                                   |
| Crédibilité des chiffres               | Mitigée : la landing évite les ROI (bon point) et deux cartes coupons affichent désormais un relevé prospectif, mais le track record annonce **100 % de réussite et +64 % de ROI sur 30 jours… pour 1 seul pari**, et la bankroll trace une projection de solde en hausse. |
| Lisibilité pour un non-initié          | Faible : edge, Poisson, canaux, AVOID, drawdown, « @1.19 ».                                                                                                                                                                                                                |
| Parcours inscription → pick → paiement | Inscription en un écran et accès immédiat, mais aucun paiement n'existe et la promesse d'un code de vérification n'est pas tenue.                                                                                                                                          |
| Mentions obligatoires                  | **Absentes** : ni 18+, ni jeu responsable, ni avertissement de risque, ni CGU, ni confidentialité.                                                                                                                                                                         |
| Mobile                                 | Mise en page propre, pas de débordement, mais bannière d'installation sur le bouton d'appel à l'action.                                                                                                                                                                    |
| Performance                            | Bonne : LCP 0,9–1,9 s, CLS 0, 531 Ko pour l'accueil.                                                                                                                                                                                                                       |
| SEO et partage                         | Faible : pas de robots.txt ni de sitemap, titres identiques sur toutes les pages, aperçu WhatsApp/Facebook trompeur et exposant des données personnelles.                                                                                                                  |

---

## P1 — à corriger avant toute promotion

### P1-1. Aucune mention obligatoire : âge, jeu responsable, risques, CGU, confidentialité

- **Constat** : aucune mention « 18+ », aucun message de jeu responsable ni d'avertissement sur le risque de perte, aucun lien vers des CGU ou une politique de confidentialité, ni sur l'accueil, ni dans le pied de page, ni à l'inscription. Les adresses `/cgu`, `/confidentialite`, `/mentions-legales` renvoient 404. Le formulaire d'inscription ne comporte aucune case (âge, acceptation des conditions, consentement aux données).
- **Reproduction** : ouvrir https://c-evcore.com → descendre au pied de page (seuls « © 2026 » et un slogan) → ouvrir `/auth/register` → aucune case à cocher. Ouvrir https://c-evcore.com/cgu → 404.
- **Impact** : un service lié aux paris sans vérification d'âge ni avertissement ne peut pas être promu proprement. Meta, Google et TikTok exigent des pages d'atterrissage conformes pour ce type de contenu (voir plan marketing). Le site collecte e-mail, nom complet et, en option, un numéro de téléphone sans politique de confidentialité, ce qui pose un problème vis-à-vis de la loi ivoirienne sur la protection des données personnelles.
- **Fichiers** : `apps/web/app/(public)/page.tsx` (pied de page), `apps/web/app/(public)/auth/components/register-form.tsx`, `apps/backend/src/modules/auth/dto/register.dto.ts` (aucun champ de consentement ni de date de naissance), pages à créer sous `apps/web/app/(public)/`. Le manque est déjà listé dans `docs/business-model.md` §8.5.

### P1-2. Un produit s'appelle « Pari sûr du jour »

- **Constat (en production le 23/10)** : la première carte de l'accueil et de la page Coupons est « Pari sûr du jour · cote 1,20–1,35 », avec « CHANCES 75 % ». Point positif depuis le code du 19/10 : deux cartes affichent maintenant un relevé prospectif (« 6 jours gagnés sur 7 (30 derniers jours) », « 7 jours gagnés sur 9 »). Mais le « Coupon long » affiche encore « Gagne environ 1 jour sur 3 », une fréquence issue d'une simulation, sans période ni effectif. Et sur 7 jours, « 30 derniers jours » laisse croire à un mois complet.
- **Reproduction** : connecté → Accueil ou Coupons → première et troisième cartes.
- **Impact** : « pari sûr » est exactement le type de formule à bannir. Une fréquence de gain élevée sur des cotes de 1,20–1,35 ne dit rien de la rentabilité ; le track record affiche −7,1 % de ROI sur 90 jours. Pour un non-initié, « 75 % de chances » plus « sûr » se lit comme une quasi-garantie. C'est aussi un motif de rejet publicitaire et un risque de pratique commerciale trompeuse.
- **Fichiers** : `apps/web/domains/coupon/helpers/coupon-class.ts` (libellés et fréquences de repli), `apps/backend/src/modules/coupon/coupon-favourite-generation.service.ts` (titre « Pari sûr … » écrit en base), `apps/web/messages/fr.json` l.688.
- **Correction proposée** : renommer (« Sélection simple du jour », « Favori du jour ») ; pour toutes les cartes, n'afficher que le relevé prospectif avec ses dates exactes (« 6 jours gagnés sur 7, du 16 au 22/10 ») et rien tant que l'effectif est trop faible.

### P1-3. Le discours « investissement » présente le pari comme un placement

- **Constat** : titre de page et aperçu de partage « Arrêtez de parier. Commencez à investir. », badge « Stratégie d'investissement sportif », sections « Conçu pour l'investisseur », « Investir, pas parier », « construire un portefeuille », « allocation de capital », pages d'inscription et de connexion « Commencez à investir avec méthode ». La meta description affirme qu'« EVCore alloue une mise sur chaque pick sélectionné par ses canaux SAFE, DOMINANT et BTTS ».
- **Reproduction** : ouvrir l'accueil, lire l'onglet du navigateur ; partager le lien dans WhatsApp ; afficher le code source (`<meta name="description">`).
- **Impact** : assimiler les paris à un investissement suggère un rendement là où les audits internes établissent que le moteur ne bat pas le marché. Les plateformes publicitaires refusent les annonces qui présentent le jeu comme une source de revenus. La meta description contredit les règles écrites en tête de `page.tsx` (ne jamais laisser croire qu'EVCore mise pour quelqu'un ; ne jamais nommer de canaux), et SAFE n'est plus un canal mais un filtre.
- **Fichiers** : `apps/web/app/(public)/layout.tsx` (title, description, Open Graph, Twitter), `apps/web/app/(public)/page.tsx` (l.307, 566, 637–680), `apps/web/app/(public)/auth/register/page.tsx`, `apps/web/app/(public)/auth/login/page.tsx`.

### P1-4. L'aperçu de partage expose des données personnelles et montre une fausse richesse

- **Constat** : l'image Open Graph (`/screenshots/desktop.png`) est une capture du tableau de bord de juillet qui montre le nom réel et l'identifiant du fondateur, sa photo, un solde de **« 500 710 000 F »**, un menu « Investir » qui n'existe plus et des écarts « +63 % » ou « +75 % ». Elle mesure 1904×983 alors que les balises annoncent 1200×630.
- **Reproduction** : coller https://c-evcore.com dans WhatsApp ou le débogueur de partage Facebook ; ou ouvrir https://c-evcore.com/screenshots/desktop.png.
- **Impact** : c'est le premier visuel vu par quiconque reçoit le lien. Un solde de 500 millions de francs suggère de l'argent facile, les « +63 % » ressemblent à des gains, le nom du fondateur est publié. Le ratio incorrect provoque un recadrage aléatoire selon la plateforme.
- **Fichiers** : `apps/web/public/screenshots/desktop.png`, `apps/web/app/(public)/layout.tsx`.
- **Correction proposée** : visuel dédié 1200×630 (logo, promesse, mention 18+), sans donnée de compte.

### P1-5. Le track record affiche « 100 % de réussite, +64 % de ROI » sur 30 jours pour un seul pari

- **Constat (confirmé en direct le 23/10)** : en tête de « Mesures historiques », sous le titre « Ce que le moteur EVCore a réellement produit » :
  - **30 jours** (« du 23 septembre au 23 octobre 2026 ») : **Paris réglés 1, Taux de réussite 100,0 %, ROI +64,0 %**, barre verte ;
  - **90 jours** : 1 298 paris, 46,5 %, ROI −7,1 % ;
  - **Tout l'historique** (« du 1er janvier 2023 ») : 3 412 paris, 48,9 %, ROI **+0,5 %**.
    Ces indicateurs lisent la table `bet` (source `MODEL`), qu'aucun code n'alimente plus depuis le 04/09 (TODO.md l.62) ; la seule écriture restante concerne les paris des utilisateurs (`bet-slip.service.ts`). Le chiffre « tout l'historique » mélange par ailleurs des périodes reconstituées avant l'audit de septembre.
- **Reproduction** : connecté → Mesures historiques → onglet « 30 jours ».
- **Impact** : c'est le pire chiffre possible à montrer à un prospect : une capture « 100 % · +64 % » circulera comme une promesse de gain, sur un effectif de 1. Le « +0,5 % » historique sera tentant à reprendre en communication alors qu'il n'est pas défendable. (Le garde-fou de suspension de marché, lui, a bien été rebranché sur `channel_selection_deduped` et fonctionne : la promesse de la landing sur ce point est exacte.)
- **Fichiers** : `apps/backend/src/modules/dashboard/dashboard.repository.ts` (`getSettledBetsForPnl`), `apps/backend/src/modules/dashboard/dashboard.service.ts` (`getPnlByCanal`), `apps/web/app/dashboard/track-record/page.tsx`.
- **Correction proposée** : rebrancher ces cartes sur les coupons publiés et les sélections dédupliquées (`channel_selection_deduped`), afficher l'effectif à côté de chaque taux, et masquer taux et ROI sous un seuil d'effectif (comme le fait déjà la mention « Volume insuffisant » du tableau par canal).

### P1-8. Des matchs que le moteur dit exclure figurent dans les coupons et les « sélections du jour »

- **Constat (en direct le 23/10)** : dans Décisions, quatre matchs portent le bandeau « Données suspectes », dont l'info-bulle explique que le moteur « exclut automatiquement toutes les sélections de ce match des paris réels ». Or ces quatre matchs gardent une « Notre sélection » marquée **« Fiable »** (Radnicki Niš–Novi Pazar, Polonia Varsovie–Miedź Legnica, Operário–Athletic Club, Cruzeiro–Remo). **Polonia–Miedź est une jambe du « Coupon long » du jour**, et Cruzeiro–Remo figure dans « Les sélections du jour » de l'accueil.
- **Reproduction** : connecté → Décisions → repérer les cartes « Données suspectes » → ouvrir l'info-bulle → comparer avec Coupons (Coupon long) et l'accueil.
- **Impact** : le produit contredit sa propre règle sur l'écran principal, le jour même. Pour un utilisateur attentif, c'est la preuve que les garde-fous affichés ne sont pas appliqués.
- **Fichiers** : génération du coupon long et des sélections du jour (`apps/backend/src/modules/coupon/`, `packages/analysis-core/src/coupon/guardrails.ts`) ; badge « Fiable » et bandeau (`apps/web/app/dashboard/decisions/components/`).

### P1-9. La bankroll trace une projection de solde en hausse

- **Constat (en direct le 23/10)** : la page Bankroll affiche un graphique « Évolution du solde » avec une courbe pointillée « Projection 30j » qui monte jusqu'à environ 5 milliards de francs. Le calcul est une extrapolation linéaire des mouvements passés, dépôts compris (`slope * i`). Les graduations sont incohérentes (« 0 Md F, 5 Md F, 5 Md F, 5 Md F, 0 F ») et l'axe des dates s'arrête au 22/09 alors que la période va jusqu'au 23/10. Le solde déclaratif (500 760 000 F) apparaît par ailleurs en permanence en haut de chaque page.
- **Reproduction** : connecté → icône portefeuille en haut à droite ou `/dashboard/bankroll`.
- **Impact** : une projection de solde croissante est, visuellement, une promesse de gain. Elle confond dépôts et gains.
- **Fichier** : `apps/web/app/dashboard/bankroll/components/bankroll-page-client.tsx` (l.106–132, `projectionDays`), `apps/web/components/charts/ev-area-chart.tsx`.
- **Correction proposée** : supprimer la projection ; séparer clairement dépôts et résultat des paris.

### P1-6. « 300 000+ prédictions confrontées au résultat » est vraisemblablement un comptage gonflé

- **Constat** : le chiffre vient d'un relevé du 22/08 (302 763 « sélections réglées », commentaire de `page.tsx`). Le dépôt documente qu'un comptage brut de `channel_selection` multiplie le nombre réel d'environ 2,4 (un match est ré-analysé 5 à 7 fois avant le coup d'envoi) et inclut près de 48 000 analyses faites après le match (CLAUDE.md, « Never count channel_selection raw »). « 7 saisons d'historique » repose sur des données reconstituées depuis 2019.
- **Reproduction** : accueil → bandeau de chiffres sous « Trois familles ».
- **Impact** : c'est le seul chiffre de volume de la page. S'il est contesté, toute la promesse de rigueur s'effondre. À recompter sur la vue dédupliquée, en ne gardant que les analyses antérieures au match.
- **Fichier** : `apps/web/app/(public)/page.tsx` (`SCALE`, l.70–75).

### P1-7. Aucun outil de mesure d'audience

- **Constat** : aucun script d'analytics ni pixel publicitaire sur le site (ni GA4, ni Plausible, ni Meta, ni TikTok), aucune capture des paramètres UTM à l'inscription.
- **Impact** : impossible de mesurer une campagne, d'attribuer une inscription à un canal ou de suivre l'activation.
- **Fichiers** : `apps/web/app/layout.tsx`, `apps/web/app/(public)/auth/components/register-form.tsx`.

---

## P2 — à corriger pendant la préparation de la campagne

### P2-1. « Accès sur invitation » alors que l'inscription est ouverte

- **Constat** : la landing affiche deux fois « Accès sur invitation ». L'inscription est libre : aucun code d'invitation côté front ni côté API.
- **Reproduction** : accueil → « Rejoindre la stratégie » → le formulaire ne demande aucun code.
- **Impact** : soit le visiteur renonce en pensant ne pas être éligible, soit il découvre une fausse rareté. Dans les deux cas, la confiance baisse.
- **Fichiers** : `apps/web/app/(public)/page.tsx` l.330 et l.645 ; `apps/backend/src/modules/auth/auth.service.ts` (`register`).

### P2-2. La proposition de valeur ne passe pas le test des 5 secondes

- **Constat** : au-dessus de la ligne de flottaison, ni « football », ni « paris sportifs », ni « gratuit ». Le titre (« Un avis sur chaque match. Une conviction sur presque aucun. ») est élégant mais demande un effort. La carte d'exemple utilise « buts attendus » et « Écarté — edge trop élevé ». La différence avec un pronostiqueur (raisonnement visible, refus motivés, résultats réglés) n'apparaît qu'au troisième écran, sous un vocabulaire technique (Poisson, familles, canaux, AVOID, drawdown).
- **Impact** : le parieur visé ne comprend pas en un coup d'œil qu'il s'agit d'analyses de matchs de football, gratuites, avec un historique public.
- **Fichier** : `apps/web/app/(public)/page.tsx` (section hero et `FAMILIES`).

### P2-3. La promesse d'un code de vérification n'est pas tenue

- **Constat** : sous le champ e-mail, « Un code à 6 chiffres vous sera envoyé à cette adresse pour la vérifier. » Après validation, l'utilisateur arrive directement sur le tableau de bord : l'API d'inscription n'envoie aucun code, la vérification n'existe que dans Paramètres → Sécurité.
- **Impact** : promesse non tenue dès la première minute, e-mails non vérifiés (relances et récupération de compte moins fiables, adresses jetables acceptées sans contrôle).
- **Fichiers** : `apps/web/app/(public)/auth/components/register-form.tsx` (`onSubmit`), `apps/backend/src/modules/auth/auth.service.ts` (`register`), `apps/web/app/(public)/auth/verify/`.

### P2-4. Sur mobile, la bannière d'installation recouvre l'appel à l'action

- **Constat** : en 375×812 (iPhone), la bannière « Installer EVCore — Touchez Partager… » apparaît dès la première visite, au bas de l'écran d'accueil, sur la zone où se trouve le second bouton « Se connecter ».
- **Reproduction** : ouvrir l'accueil sur iPhone, première visite.
- **Impact** : on propose d'installer l'application avant que le visiteur ait compris de quoi il s'agit. Le second appel à l'action est masqué.
- **Fichier** : `apps/web/components/pwa-install-banner.tsx` (n'afficher qu'après inscription ou après plusieurs visites).

### P2-5. SEO de base absent

- **Constat** : `robots.txt` et `sitemap.xml` renvoient 404, pas de balise canonique. Toutes les pages publiques partagent le titre de l'accueil. Les 404 et le manifeste s'appellent « Console EVCore », avec la description « Console opérateur pour les analyses EVCore, les fixtures et les flux d'audit » (c'est aussi le nom proposé à l'installation sur mobile).
- **Impact** : indexation non maîtrisée, résultats de recherche peu engageants, application installée sous un nom d'outil interne.
- **Fichiers** : `apps/web/app/layout.tsx`, `apps/web/app/manifest.ts`, `robots.ts` et `sitemap.ts` à créer dans `apps/web/app/`, metadata à ajouter aux pages `auth/*`.

### P2-6. Page 404 pensée pour un utilisateur connecté

- **Constat** : l'unique bouton est « Retour au dashboard », qui renvoie un visiteur anonyme vers la connexion. Aucun lien vers l'accueil.
- **Fichier** : `apps/web/app/not-found.tsx`.

### P2-7. Picks et indicateurs difficiles à lire pour un non-initié

- **Constat (en direct le 23/10)** : cotes notées « @1.33 », « CHANCES 75 % » sans explication, étiquettes « Choisi sur les cotes » ou « Sélections du moteur », colonnes « Calibration 0.95× / ROI / Taux de réussite / Échantillon » sur le track record. Sur le « Combiné du jour », deux jambes à 87 % chacune donnent « CHANCES 69 % », alors que le produit des deux fait 76 % : l'écart n'est expliqué nulle part. Rien n'explique au premier passage ce que signifie « 75 % » ni pourquoi un pari « à 75 % » peut perdre de l'argent sur la durée.
- **Impact** : l'argument central (calibration) est invisible pour le parieur visé, qui retient seulement le pourcentage le plus élevé.
- **Fichiers** : `apps/web/components/coupon-card.tsx`, `apps/web/app/dashboard/coupons/components/coupon-card.tsx`, `apps/web/app/dashboard/track-record/components/channel-stats-table.tsx`, `apps/web/app/dashboard/decisions/components/channel-row.tsx`.

### P2-8. 1xBet sert de référence affichée dans l'interface

- **Constat (en direct le 23/10)** : chaque carte affiche deux cotes, « COTE » et « 1XBET ». L'écart est parfois large : « Combiné du jour » à @1.44, mais @1.30 chez 1xBet (−10 %) ; la veille, @1.44 contre @1.23 (−15 %). C'est la cote la plus haute, celle du meilleur bookmaker relevé, qui est mise en avant.
- **Impact** : nommer un opérateur dans l'interface peut se lire comme une recommandation, ce qui pose un problème réglementaire et publicitaire selon le pays (voir plan marketing §2). Mettre en avant la meilleure cote surestime ce que le joueur obtiendra réellement. Une formulation neutre suffit (« cote jouable estimée », sans nom de bookmaker), affichée en premier.
- **Fichiers** : `apps/web/components/playable-odds.tsx`, `apps/web/components/coupon-card.tsx`, `apps/web/app/dashboard/coupons/components/coupon-card.tsx`, `apps/web/app/dashboard/decisions/components/channel-row.tsx`.

### P2-9. Classement des joueurs par ROI et badges de série

- **Constat (en direct le 23/10)** : Mes coupons → onglet « Classement des joueurs » : « Top joueurs », classés par ROI dès 5 coupons joués, avec une icône de flamme. Le profil affiche des badges de performance, dont « En feu » (série) ainsi que « Expert » et « Maître ».
- **Impact** : classer des parieurs par ROI sur 5 coupons récompense la chance et pousse à jouer plus. Cela contredit le discours du produit (ROI sans puissance statistique à ces volumes, mise unitaire, discipline) et les principes de jeu responsable. Le classement deviendra aussi une source de captures « je suis n° 1 » difficiles à contrôler.
- **Fichiers** : `apps/web/app/dashboard/components/user-leaderboard.tsx`, `apps/web/app/dashboard/bet-slips/components/bet-slip-list-page-client.tsx`, module `apps/backend/src/modules/gamification/`.
- **Correction proposée** : retirer le classement ; garder les badges d'apprentissage (« Diplômé », « Calibré », « Patience ») et supprimer ceux qui récompensent les séries ou le gain.

### P2-10. Les textes « Avis IA » contiennent encore du jargon interne et un ton incitatif

- **Constat (en direct le 23/10)** : les analyses IA contiennent « Nos données internes montrent… », « juste en dessous du seuil habituel, ce qui place ce pari à la limite du doute », « La cote de 1,53 reste dans la fourchette autorisée, offrant ainsi une opportunité intéressante », ou encore « rendant très probable une victoire ». Ce problème est déjà relevé dans PREMIERE-LECTURE.md §2. La page « Avis IA » a pour titre d'onglet « Arbitrage — EVCore » (route `/dashboard/arbitrage`), alors que l'arbitrage désigne autre chose dans les paris.
- **Impact** : « opportunité intéressante » et « très probable » sont des formules de vente. « Seuil » et « fourchette autorisée » exposent des mécanismes internes sans les expliquer.
- **Fichiers** : nettoyeur des textes du générateur LLM (`apps/vantage-worker`), `apps/web/app/dashboard/arbitrage/page.tsx` (metadata).

### P2-11. Deux produits différents portent le même nom « Combiné du jour »

- **Constat (en direct, coupons du 22/10)** : deux cartes « Combiné du jour · 2 sélections », l'une « Analyse IA » (5 jours gagnés sur 8), l'autre « Sélections du moteur » (7 jours sur 9). Dans le bloc « Hier » de l'accueil, elles apparaissent l'une « Gagné », l'autre « Perdu », sans moyen de les distinguer. Le « Pari sûr » de la veille reste « En attente » parce que son match se joue le 23 à 18 h.
- **Impact** : l'utilisateur ne sait pas quel combiné suivre, et les relevés des deux se confondent.
- **Fichiers** : `apps/web/domains/coupon/helpers/coupon-class.ts`, `apps/web/app/dashboard/components/home/yesterday-coupons.tsx`.

### P2-12. « Une conviction sur presque aucun » contre 52 sélections « Fiable » par jour

- **Constat (en direct le 23/10)** : Décisions affiche 54 « Notre sélection » sur les 54 matchs du jour, dont 52 avec le badge « Fiable ». La landing promet « Un avis sur chaque match. Une conviction sur presque aucun. »
- **Impact** : le badge « Fiable » sur presque tout vide le mot de son sens, et un parieur le lira comme « sûr ». C'est l'inverse de la promesse de sélectivité.
- **Fichiers** : `apps/web/app/dashboard/decisions/components/channel-row.tsx` (badge), `apps/web/app/(public)/page.tsx` (titre).
- **Correction proposée** : remplacer « Fiable » par une information qui a du sens (« canal bien calibré sur 30 jours, n = … ») ou réserver un repère visuel aux quelques sélections réellement mises en avant.

---

## P3 — finitions

- **P3-1. En-têtes de sécurité absents** : ni HSTS, ni Content-Security-Policy, ni X-Frame-Options ; `x-powered-by: Next.js` exposé (configuration Caddy ou `next.config`).
- **P3-2. Accueil non mis en cache** : `cache-control: no-store` sur une page statique ; premier octet à 1,1 s à froid, contre 0,2 s ensuite.
- **P3-3. Aucun championnat africain couvert** : seul le cycle (terminé) des qualifications africaines à la Coupe du monde figure dans le seed. Pas de Ligue 1 ivoirienne, de Botola, de Ligue des champions CAF. Ce n'est pas bloquant (le public parie surtout sur l'Europe), mais c'est un manque pour des contenus locaux.
- **P3-4. Formulaire d'inscription** : cinq champs dont « Nom complet » et une bio. Le nom complet n'est pas utile au premier accès, et l'indication du mot de passe est répétée (placeholder et aide).
- **P3-5. Logo** : « EV » est dans une image, seul « Core » est lu par les lecteurs d'écran.

## Ce qui fonctionne bien

- Performance : LCP 1,9 s (desktop, à froid) et 0,9 s (mobile), CLS nul, 531 Ko et 24 requêtes pour l'accueil, aucun débordement horizontal en 375 px, aucune erreur JavaScript.
- Les règles de rédaction de la landing (pas de taux de réussite, pas de ROI, « la décision vous appartient ») sont saines et rares dans le secteur. Le track record affiche « Historique daté, jamais une promesse de gain futur » et montre un ROI négatif quand il l'est.
- Les routes privées redirigent bien vers la connexion ; l'API renvoie 401 sans session.
- La vue « Écarté » avec motif de refus est un vrai différenciateur face aux pronostiqueurs.
- En direct : le tableau par canal masque les taux sous 30 sélections (« Volume insuffisant »), le pied du track record rappelle qu'aucun chiffre ne garantit une performance future et qu'il n'y a pas de preuve de mise, la cote de clôture est affichée sur les sélections réglées, et le centre de formation (15 contenus, progression) est une excellente matière pour la campagne.

## Écarts entre ce que le produit fait et ce que le site affiche

| Le site dit                                                         | Le code fait                                                                                           |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| « Accès sur invitation »                                            | Inscription libre, sans code.                                                                          |
| « EVCore alloue une mise sur chaque pick … SAFE, DOMINANT et BTTS » | EVCore ne mise rien ; SAFE est un filtre, pas un canal ; 19 canaux.                                    |
| « Un code à 6 chiffres vous sera envoyé »                           | Aucun envoi à l'inscription.                                                                           |
| « Ce que le moteur a réellement produit », du … à aujourd'hui       | Table non alimentée depuis le 04/09 : 1 pari, 100 %, +64 % sur 30 jours.                               |
| « 300 000+ prédictions confrontées au résultat »                    | Comptage probablement brut (ré-analyses et analyses après coup incluses).                              |
| « Pari sûr du jour », « Gagne environ 1 jour sur 3 » (coupon long)  | Nom à bannir ; fréquence issue d'une simulation, sans période ni effectif ; ROI à −7,1 % sur 90 jours. |
| Info-bulle « le moteur exclut toutes les sélections de ce match »   | Ces matchs restent « Notre sélection · Fiable » et l'un d'eux est dans le coupon long du jour.         |
| « Une conviction sur presque aucun »                                | 52 sélections « Fiable » sur 54 matchs.                                                                |

## Verdict

**Pas prêt à promouvoir.** Le produit est sérieux et le site est techniquement sain, mais une campagne aujourd'hui enverrait du trafic vers un site sans mention d'âge ni de jeu responsable, avec un produit nommé « Pari sûr », un aperçu de partage qui affiche 500 millions de francs, un historique qui annonce 100 % de réussite sur un seul pari, une projection de solde en hausse et des garde-fous contredits à l'écran. Aucune régie publicitaire n'acceptera la page d'atterrissage en l'état.

Le minimum avant lancement correspond à P1-1 à P1-9, plus P2-1, P2-3, P2-9 et P2-12. L'essentiel relève de la rédaction et de la configuration. Les vrais chantiers techniques sont le rebranchement du track record (P1-5) et l'application de l'exclusion « Données suspectes » aux coupons (P1-8).
