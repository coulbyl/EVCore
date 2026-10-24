# Critique UX : Accueil connecté (rôle Opérateur)

_Revue du 24/10/2026, première page du chantier A du plan produit (`docs/plan-produit-ux-chasseurs-2026-10-23.md`). Méthode `impeccable critique` en mode dégradé : l'évaluation A (revue de design) a tourné dans un sous-agent isolé, sans voir l'évaluation B ; l'évaluation B a d'abord tourné avec un détecteur maison (`apps/web/e2e/support/ux-detect.mjs`, sorties dans `scripts/accueil-*.json`), puis, une fois le lanceur du skill autorisé, avec le détecteur d'impeccable injecté dans la page rendue (`apps/web/e2e/support/impeccable-inject.mjs`, sorties dans `scripts/impeccable-accueil-*.json`). Le scan de code source d'impeccable (`impeccable detect --json` sur les composants de l'Accueil) ne renvoie rien ; tout vient du rendu._

_Captures : `captures/accueil__{375,1280}__{dark,light}.png`, pleine hauteur, en français, produites par `apps/web/e2e/captures.spec.ts` sur le faux backend (`E2E_ROLE=OPERATOR`). Le faux backend renvoie 6 coupons le même jour (dont 4 « Coupon long ») : en production un jour typique en a 3. La structure est jugée, pas le volume de test._

## Score de santé (heuristiques de Nielsen, 0–4)

| #   | Heuristique                      |   Note    | Constat                                                                                                                                                                                                                                               |
| --- | -------------------------------- | :-------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Visibilité de l'état du système  |     2     | Aucune date sur la page. Sur 375 px l'heure du coup d'envoi est tronquée dans chaque jambe (« Premier League · Angleterre · 1… »). Une jambe non réglée n'a aucun état (à venir, en cours, finie).                                                    |
| 2   | Correspondance monde réel        |     2     | Bons mots (« Dom. ou Nul », « Gagne environ 1 jour sur 3 »). Jargon au premier écran : « @1.22 », « CHANCES 21 % », « Choisi sur les cotes », « Clôture @1.90 », deux cotes par jambe. « Pari sûr » dit le contraire de ce que le produit pense.      |
| 3   | Contrôle et liberté              |     3     | Rien ne piège. Mais toutes les explications sont en `title=` : inaccessibles au doigt.                                                                                                                                                                |
| 4   | Cohérence et standards           |     2     | « Déjà joué par toi » / « Vous n'avez encore rien joué ». « 1,20–1,35 » / « @1.22 » / « 66.7% ». Jambe VOID « Annulé », coupon VOID « Remboursé ». « Pari sûr **du jour** » listé sous « Hier ».                                                      |
| 5   | Prévention des erreurs           |     2     | Bon : « + » seulement avant le coup d'envoi, bande 1,20–1,65, 5 sélections max. Mauvais : l'erreur n°1 (lire 1,22 comme « sûr ») est induite par le libellé ; aucun plafond sur les coupons affichés.                                                 |
| 6   | Reconnaissance plutôt que rappel |     2     | Il faut savoir que la barre sous la carte est la probabilité jointe (elle ressemble à un chargement), que la couleur de la pastille code un canal, que le chip gris est la source.                                                                    |
| 7   | Flexibilité et efficacité        |     2     | Un tap pour tout ajouter. Pas d'accélérateur ; un joueur qui ne suit que le combiné défile le favori et les coupons longs chaque jour.                                                                                                                |
| 8   | Esthétique et minimalisme        |     2     | 6 cartes de même poids pour 3 produits différents ; barre de progression redondante avec la tuile « Chances » ; « Fiable » sur 5 sélections sur 5 ; « 62 % de chances » répété sur chaque jambe ; colonne droite vide sur 60 % de la hauteur desktop. |
| 9   | Récupération d'erreur            |     2     | « Le coupon du jour n'a pas pu être chargé. » sans bouton ni cause.                                                                                                                                                                                   |
| 10  | Aide et documentation            |     2     | Rien de contextuel : aucun « ? » à côté de « Chances », aucun lien vers la formation depuis une carte. « Pourquoi ce coupon ? » n'existe que pour les coupons IA, jamais pour le favori ni le combiné du moteur.                                      |
|     | **Total**                        | **21/40** | **Acceptable, bas de la bande** : la structure est là, les mots et la hiérarchie trahissent le produit.                                                                                                                                               |

## Verdict de spécificité

**Spécifique dans ses données, interchangeable dans sa composition, et muette sur la seule chose qui la rendrait unique.** Ce qu'aucun pronostiqueur n'affiche est bien là : « 19 jours gagnés sur 24 (30 derniers jours) », la cote payée à côté de la cote annoncée, la clôture, l'état vide « L'abstention est un résultat, pas une panne ». Mais la grammaire visuelle (@1.22, « ✓ GAGNÉ » en capitales vertes, tuiles métriques, pastilles) est celle des canaux Telegram que le joueur cible fuit. Et nulle part la page ne dit « annoncé X %, réalisé Y % » ni « à mise fixe, ça fait −3 % », alors que `returnPerUnit` est dans la réponse de l'API et que `globalRoi` est chargé par le bloc « Mes coupons ».

**Détecteur (B)**, sur les quatre captures, identique en clair et en sombre sauf mention :

| Mesure                                                                 | Mobile 375                                                                                                                                                          | Desktop 1280                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Titre de l'onglet                                                      | « Console EVCore »                                                                                                                                                  | idem                                                                               |
| Titres                                                                 | Aucun `h1` ; quatre `h2`                                                                                                                                            | idem                                                                               |
| Textes sous 12 px                                                      | **135** éléments, dont les tuiles « COTE / CHANCES » à 9,3 px, badges et fréquences à 9,6–9,9 px, ligne compétition · heure à 11,2 px                               | 134                                                                                |
| Contraste insuffisant (WCAG AA)                                        | Avatar « E2 » 2,8 ; « Perdu » 3,8 ; en clair aussi les pastilles « 71 % / 82 % / 74 % » à 3,6–3,7 et les libellés de la barre basse « Coupons / Accueil » à 4,0–4,4 | Avatar 2,8 ; « Perdu » 3,8 ; en clair pastilles et « PERDU / REMBOURSÉ » à 3,6–3,8 |
| Cibles tactiles sous 44 px                                             | **18 sur 24** : icônes d'en-tête 36 px, « Ajouter au coupon » **20 × 20 px**, liens « Tous les coupons » 16 px de haut, « Clôture @1.90 » 14 px de haut             | 27 sur 30 (navigation latérale à 36 px de haut)                                    |
| Débordement horizontal, images sans alt, éléments interactifs sans nom | aucun                                                                                                                                                               | aucun                                                                              |
| Mots interdits (plan marketing §5)                                     | « sûr » × 2                                                                                                                                                         | « sûr » × 2                                                                        |

**Détecteur impeccable (B, dans la page rendue)**, 147 à 150 éléments signalés selon la configuration :

| Règle                            | Mobile sombre | Mobile clair | Desktop sombre | Desktop clair | Ce que c'est                                                                                                                                                                                                               |
| -------------------------------- | ------------: | -----------: | -------------: | ------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `undersized-ui-text`             |            92 |           92 |             91 |            91 | Texte fonctionnel sous 11 px : tuiles « COTE / CHANCES / 1XBET » à 9,3 px, « ✓ Gagné » et chips de source à 9,6 px, « Gagné » / « Résultat » / « 62 % de chances » à 9,9–10,9 px                                           |
| `tiny-text`                      |            27 |           27 |             27 |            27 | Texte courant sous 12 px : badges de classe et relevés (« 19 jours gagnés sur 24 ») à 9,9 px, ligne compétition · heure à 11,2 px                                                                                          |
| `nested-cards`                   |            20 |           20 |             20 |            20 | Carte dans carte : chaque jambe est une carte dans la carte coupon, chaque sélection du jour aussi, les trois tuiles de « Mes coupons » aussi                                                                              |
| `low-contrast`                   |             5 |           12 |              9 |            18 | Sombre : « ✗ PERDU » 4,3, « Perdu » sur rouge 3,8, pastille « 79 % » 4,4, avatar 2,8. Clair : « ✓ GAGNÉ » 2,4, « @4.32 » payé 2,4, « 82 % » 3,1, « 1xBet 1.18 » 3,1, badge « Pari sûr » 4,2, intertitres de navigation 2,3 |
| `side-tab`                       |             5 |            5 |              5 |             5 | Bande colorée de 3 px à gauche de chaque sélection du jour (couleur de canal)                                                                                                                                              |
| `ai-color-palette`               |             1 |            1 |              1 |             1 | Dégradé cyan de fond                                                                                                                                                                                                       |
| `dark-glow`                      |             1 |            0 |              0 |             0 | Halo coloré (`#14b8a6`) sur fond sombre : le bouton flottant                                                                                                                                                               |
| `first-viewport-column-overflow` |             0 |            0 |              1 |             1 | La grille deux colonnes de l'accueil ouvre la page sur une colonne qui déborde du premier écran                                                                                                                            |

Les deux détecteurs concordent sur le micro-texte et les contrastes, et le second ajoute trois constats de structure que le premier ne voyait pas : les cartes imbriquées (20 par page), la bande latérale de canal, et la colonne principale qui dépasse le premier écran en desktop. L'avatar « E2 » et les intertitres de navigation sont hors du périmètre de la page (coquille partagée) mais à corriger au même moment.

Où A et B se recoupent : la densité de micro-texte (B) est la cause matérielle du bruit que A décrit (tuiles, badges, fréquences, deux cotes). Les cibles de 20 px (B) sont les « + » et le chip « Fiable » que A signale comme collés. Ce que B a vu et que A n'a pas relevé : les contrastes du mode clair sur les pastilles de probabilité et la barre basse, l'absence de `h1`, le titre d'onglet « Console EVCore ». Faux positif de B : l'avatar « E2 » est un initiale décorative, pas un texte à lire.

## Impression générale

La page sait déjà dire la vérité, elle ne la met pas en avant. Elle montre que le produit gagne souvent et cache qu'il rend l'argent. La plus grande opportunité tient en une ligne en tête de page : « Hier : 2 gagnés sur 3. Depuis 30 jours, à mise fixe : −3 %. »

## Ce qui fonctionne

1. **Le relevé prospectif sur la carte** et la **cote payée** (« @6.91 · payé @4.32 ») : les deux éléments les plus honnêtes qu'un parieur francophone verra sur une app de ce type.
2. **L'état vide** « Pas de coupon aujourd'hui… L'abstention est un résultat, pas une panne » : la meilleure phrase de la page, visible seulement les jours sans coupon.
3. **« Les sélections du jour »** : la règle est écrite dans le sous-titre, cinq au plus, une décision par ligne, ajout en un tap et seulement avant le coup d'envoi. Le bloc le plus « Operate » de la page.

## Problèmes prioritaires

### [P1] 1. « Pari sûr du jour », et des chiffres sans période exacte ni rendement

- **Constat** : `coupon-class.ts` nomme le produit « Pari sûr du jour », affiché en tête d'accueil, sur chaque carte et sous « Hier ». Les fréquences de repli (« 7 jours sur 10 », « 1 jour sur 3 ») viennent d'une simulation et s'affichent dès que moins de 5 jours sont réglés. « 30 derniers jours » sans dates. `returnPerUnit` (0,97 dans le mock, soit −3 % à mise fixe) est chargé et jamais montré. P1-2 du 23/10 confirmé, inchangé.
- **Pourquoi** : « sûr » + « 4 jours sur 5 » + « GAGNÉ » vert est la quasi-garantie que le joueur cible vient fuir ; sans le rendement, « 19 sur 24 » se lit comme un gain alors que le produit a perdu sur la fenêtre.
- **Correction** : `FAVOURITE.label = "Favori du jour · cote 1,20–1,35"` ; sous 5 jours réglés, « Relevé en cours · 3 jours réglés » au lieu de la fréquence simulée ; texte du relevé « 19 jours gagnés sur 24 · à mise fixe : −3 % · du 24/09 au 23/10 » (`components/coupon-card.tsx`, `use-coupon-track-record.ts` a déjà `returnPerUnit`, il manque les dates côté API) ; sous « Hier », « Favori · 1 sélection ».

### [P1] 2. L'accueil n'applique pas le plafond que son propre commentaire annonce

- **Constat** : `today-coupons.tsx` dit que le coupon long reste sur la page Coupons et que l'accueil montre « un pari sûr et un combiné ». Le filtre réel n'exclut que `UNIQUE` et le `COMBO` de source `LLM` ; la classe `LONG` (créée le 18/10) passe, et il n'y a aucun `slice`. Vérifié dans le code. En production : trois cartes au lieu des deux promises, quatre un jour d'`intraday`.
- **Pourquoi** : le coupon long perd 2 jours sur 3 ; en tête d'accueil au même poids que le favori, il réinstalle le « ✗ PERDU » quotidien que le commentaire du 12/10 voulait éviter, et le joueur « combinés à cote 6 » y voit son produit validé.
- **Correction** : liste blanche `HOME_CLASSES = {FAVOURITE, COMBO}`, filtre sur la classe et `source !== "LLM"`, `.slice(0, 2)` ; une ligne de rappel vers la page Coupons pour le coupon long (« gagne environ 1 jour sur 3, pire série 8 jours ») plutôt qu'une carte ; commentaire mis à jour.

### [P1] 3. La page ne répond jamais à « suis-je en gain ou en perte ? »

- **Constat** : `my-slips-summary.tsx` affiche en attente / gagnés / réussite ; `lostBets` et `globalRoi` (« −4,1 % » dans le mock) sont dans la même réponse et non rendus. « RÉUSSITE 66,7 % » sans effectif ni période. « Hier » liste les coupons sans total, à 3 500 px sur mobile. La page se termine sur un taux de réussite positif alors que le joueur est en perte, et le bouton flottant Eva recouvre la tuile.
- **Pourquoi** : c'est la priorité n°1 du diagnostic joueur et la raison pédagogique du produit : 67 % de réussite à cote 1,2–1,5 peut être une perte. La page montre le taux et cache la perte.
- **Correction** : remplacer la tuile « Réussite » par « À mise fixe : −4,1 % sur 3 coupons réglés » et une ligne « 2 gagnés · 1 perdu · 1 en attente » ; une ligne de synthèse au-dessus de « Hier » (« Hier : 2 gagnés, 1 perdu, 1 remboursé ») avec la source dans le libellé quand deux coupons partagent une classe (clôt P2-11) ; sur mobile, ordre « Hier » → « Le coupon du jour » → « Sélections » → « Mes coupons » ; padding bas pour le bouton flottant.

### [P1] 4. L'heure du match est tronquée sur téléphone, et la page n'a pas de date

- **Constat** : `fixture-card-header.tsx` met « compétition · pays · heure » dans un seul paragraphe tronqué ; à 375 px l'heure disparaît sur toutes les jambes. Aucune date dans le titre ni l'en-tête.
- **Pourquoi** : la seule contrainte opérationnelle d'un pari est « avant quelle heure ».
- **Correction** : heure dans un `span` non rétrécissable, à part du texte tronqué ; en mobile, « 19:00 · Premier League » ; titre « Le coupon du jour · ven. 24 oct. » via `Intl.DateTimeFormat`.

### [P2] 5. Bruit structurel sur chaque carte, et micro-texte illisible

- **Constat** : `today-picks.tsx` ne garde que les canaux `GREEN` puis affiche `ConfidenceBadge` : « Fiable » est tautologique (5 sur 5). `ProgressBar` = tuile « Chances ». Deux cotes par jambe, la meilleure en premier et en plus gros, un opérateur nommé dans la tuile (P2-8). Le chip de source n'explique rien sans survol. Détecteur : 135 textes sous 12 px, tuiles à 9,3 px, cibles « + » de 20 px, contrastes 3,6–3,8 en clair.
- **Correction** : retirer `ConfidenceBadge` du bloc Sélections et `ProgressBar` de la carte ; une cote par jambe, la jouable en premier (« Cote jouable 1,18 · relevée jusqu'à 1,22 »), tuile « COTE JOUABLE » sans nom d'opérateur ; chip de source remplacé par une phrase sous le badge, ouvrable au doigt (`HoverCard` contrôlé comme `closing-line.tsx`) ; plancher typographique 12 px pour tout texte lu, 11 px pour les seuls libellés de tuile en capitales ; « + » à 44 px de zone de tap ; pastilles de probabilité en clair à 4,5 de contraste.

### [P2] 6. Deux mots pour « jouer », deux registres pour « vous »

- **Constat** : « Jouer ce coupon » / « Déjà joué par toi » (`components/coupon-card.tsx`) contre « Vous n'avez encore rien joué » (`fr.json`). Le produit ne place aucun pari.
- **Correction** : « Suivre ce coupon » / « Suivi », tutoiement partout (registre confirmé le 24/10, `apps/web/PRODUCT.md`) ; sortir les chaînes codées en dur de la carte (« Pourquoi ce coupon ? », « Dans le coupon », « Intraday », textes des `title`) vers `fr.json`.

### [P2] 7. Mentions et vocabulaire

- **Constat** : aucune mention 18+ ni message de risque sur la page (plan marketing §5) ; solde « 500 760 000 F » en permanence dans l'en-tête ; nav « Portefeuille », sous-titre « Console de pilotage », titre d'onglet « Console EVCore », aucun `h1`.
- **Correction** : pied de page court « 18+ · Parier comporte des risques de perte » ; « Portefeuille » → « Suivi de mise » ; sous-titre et titre d'onglet « EVCore » ; `h1` visuellement discret « Accueil · ven. 24 oct. ».

## Signaux d'alerte par persona

- **Koffi (combinés 6–10 matchs, téléphone)** : voit des « Coupon long · cote 2,5–5 ✓ GAGNÉ @5.99 » avant les sélections et retient « l'app sort du 6 ». « 1 jour sur 3 » sans « pire série 8 jours » : il abandonne au 4e jour perdu. Les cinq « + » de 20 px lui laissent reconstruire un combiné de 5 « Fiable » à 82 %, 79 %, 77 % sans voir la probabilité jointe. Cotes 1xBet absentes du bloc Sélections alors que `playableOdds` est dans les données : il verra 1,25, trouvera 1,22 chez lui et conclura que l'app ment.
- **Aminata (veut comprendre)** : « Pourquoi ce coupon ? » n'existe que sur les coupons IA ; la différence « Choisi sur les cotes » / « Sélections du moteur », la chose la plus intéressante du produit, est dans un `title` qu'elle ne peut pas ouvrir. « 30 derniers jours » sans dates et « 66,7 % » sans effectif nourrissent son objection.
- **Junior (a payé un coupon VIP)** : « Pari sûr », « GAGNÉ » en capitales vertes, « 19 jours gagnés sur 24 » : la grammaire du canal VIP. Le bouton flottant à animation `ping` l'incite à taper sans dire ce que c'est. « Jouer ce coupon » et le nom d'opérateur lui font croire que l'app mise pour lui. Il repart sur « RÉUSSITE 66,7 % ».

## Observations mineures

- « LE COUPON DU JOUR » au singulier au-dessus de plusieurs cartes.
- Sur 375 px, « LES SÉLECTIONS DU JOUR » passe sur deux lignes et « @1.28 » se détache de l'heure à la ligne suivante.
- Couleurs de canal (vert, violet, bleu) sans légende ; la pastille « 82 % » colorée se lit comme un score de confiance.
- Mode sombre : les jambes `border-border/70` sur `bg-panel` se fondent dans la carte ; le clair est plus lisible.
- `weekly-brief.tsx` : textes en dur, « ROI 1X2 » sans période ni effectif, visible seulement le lundi.
- Confettis : la condition « majorité des coupons gagnés » comptera le coupon long tant que le P1 n°2 n'est pas corrigé.
- Desktop : `lg:sticky top-4` sur la colonne droite garderait « Hier / Mes coupons » en vue.

**Statut des points du 23/10** : P1-2 confirmé ; P2-7 confirmé ; P2-8 confirmé (tuile et jambe) ; P2-11 corrigé en tête d'accueil, pas dans « Hier », et reproduit pour « Coupon long » ; P2-12 confirmé, tautologique ici. Diagnostic §6 : n°3 et n°5 faits ; n°1, n°2, n°6, n°8 non faits.

## Questions à se poser

1. Et si la première ligne de l'accueil n'était pas un coupon mais un relevé ? « Hier : 2 gagnés sur 3. Depuis 30 jours, à mise fixe : −3 %. »
2. Pourquoi afficher « Chances 21 % » alors que le dépôt a mesuré que la probabilité du moteur ne bat pas le prix ? Que perd la carte si elle ne montre que la cote jouable, la fréquence mesurée avec ses dates et la pire série ?
3. Le jour sans coupon est-il le meilleur jour du produit ou un écran vide ? Si « l'abstention est un résultat » est vrai, pourquoi la page ordinaire ne le rappelle-t-elle jamais ?

## Plan de correction (une PR `fix/ux-accueil`)

1. P1 n°2 (filtre et plafond) et P1 n°4 (heure, date) : structure, sans débat.
2. P1 n°1 et n°3 : libellé « Favori du jour », rendement à mise fixe sur la carte et dans « Mes coupons », synthèse « Hier », ordre mobile. Dépend de la décision sur le nom (plan, décision 1) et d'un champ `from`/`to` sur `/coupons/track-record`.
3. P2 n°5 à 7 : bruit, micro-texte, cibles, contrastes, textes, mentions.
4. Re-capture et re-passage du détecteur : objectif 0 texte lu sous 12 px, 0 cible sous 44 px dans le contenu, 0 contraste sous 4,5, 0 mot interdit.

## Notes d'exécution

Cible : `/dashboard` (rôle Opérateur). Liste d'exclusions : aucune. Indépendance des évaluations : A dans un sous-agent séparé, B dans le contexte principal, synthèse après les deux. Détecteur `impeccable detect` : scan de source vide ; détecteur de page injecté via `live-server` (port 8400) et Playwright, 4 configurations, 147–150 éléments. Superposition visuelle : injectée en navigateur sans tête, pas d'onglet humain. Serveurs : faux backend, Next et `impeccable live-server` lancés à la main pour les détecteurs, arrêtés après (`live-server stop --keep-inject`, aucun fichier du projet modifié). Fichiers temporaires : sorties JSON copiées dans `scripts/`, le reste dans le scratchpad de session.

## Après corrections (24/10, branche `feat/produit-ux`)

Seize commits, de `bdb1f272` à `70eb7f3a`. Captures dans `captures/apres/`, sorties des détecteurs dans `scripts/apres-*.json`. Même faux backend, même rôle Opérateur.

**Ce qui a changé pour le joueur**

- L'accueil montre deux cartes (Favori du jour, Combiné du jour) ; le coupon long tient sur une ligne qui renvoie à la page Coupons.
- « Pari sûr du jour » s'appelle « Favori du jour ».
- La ligne de relevé dit « 19 jours gagnés sur 24 · à mise fixe −3 % · du 25/09 au 23/10 », et « Relevé en cours · 3 jours réglés » sous cinq jours ; plus aucune fréquence simulée.
- « Mes coupons » répond à « suis-je en gain ou en perte ? » : « 2 gagnés · 1 perdu · 1 en attente » et « Ton résultat à mise fixe −15 % sur 3 paris réglés ». Le chiffre vient d'un nouveau calcul backend sur les paris du joueur ; l'ancien `globalRoi` mesurait les paris internes VALUE de tous les utilisateurs.
- « Hier » s'ouvre sur un bilan d'une ligne et passe en tête sur téléphone ; deux coupons de même classe se distinguent par leur source.
- L'heure du match ne se tronque plus ; le titre porte la date.
- Plus de badge « Fiable » tautologique ni de barre de progression ; la cote jouable apparaît sur les sélections du jour.
- Jambes en rangées, plus de cartes dans la carte ; textes à 12 px (11 px pour les libellés de tuile) ; cibles de 44 px ; contrastes AA.
- Tutoiement partout ; les textes de la carte coupon passent par les fichiers de traduction.
- Titre d'onglet et nom d'installation « EVCore » ; mention « 18+ · Parier comporte des risques de perte » en bas de l'accueil ; « Suivi de mise » à la place de « Portefeuille ».

**Détecteurs, avant → après**

| Mesure (impeccable, dans la page) | Mobile sombre | Mobile clair | Desktop sombre | Desktop clair |
| --------------------------------- | ------------: | -----------: | -------------: | ------------: |
| Total des signalements            |      151 → 16 |     157 → 15 |       154 → 18 |      163 → 19 |
| Texte fonctionnel sous 11 px      |        92 → 0 |       92 → 0 |         91 → 1 |        91 → 1 |
| Texte courant sous 12 px          |        27 → 0 |       27 → 0 |         27 → 0 |        27 → 0 |
| Contraste insuffisant             |         5 → 1 |       12 → 1 |          9 → 2 |        18 → 3 |
| Cartes imbriquées                 |        20 → 8 |       20 → 8 |         20 → 8 |        20 → 8 |

| Mesure (détecteur maison)  | Mobile                          | Desktop         |
| -------------------------- | ------------------------------- | --------------- |
| Cibles tactiles sous 44 px | 18 → 6                          | 27 → 15         |
| Mots interdits             | « sûr » × 2 → 0                 | « sûr » × 2 → 0 |
| `h1`                       | aucun → « Accueil »             | idem            |
| Titre d'onglet             | « Console EVCore » → « EVCore » | idem            |

**Ce qui reste, et pourquoi**

- **Coquille partagée, pas l'Accueil** : avatar en initiales blanches sur orange (2,8:1), nom d'utilisateur de la barre latérale en clair (3,8:1), icônes d'en-tête à 36 px (réglées le 19/10 pour tenir un solde à neuf chiffres à 360 px), libellés de la navigation latérale à 36 px de haut. À traiter dans une passe dédiée à la coquille.
- **Cartes imbriquées restantes (8)** : ce sont les cartes posées dans le panneau de page commun à tout le tableau de bord (sélections du jour, tuile de résultat). Les retirer change la coquille de toutes les pages.
- **Bande colorée de canal, dégradé cyan, halo du bouton flottant** : signatures visuelles actuelles, à trancher avec `DESIGN.md` plutôt qu'à la pièce.
- **Desktop** : la colonne principale dépasse le premier écran (`first-viewport-column-overflow`).
- **Différé volontairement** : « Jouer ce coupon » → « Suivre ce coupon » (c'est une fonctionnalité, suivi sans mise et notification) ; nom du bookmaker à l'écran (décision ouverte dans `apps/web/PRODUCT.md`).

**Score Nielsen re-noté : 26/40 (contre 21/40).** Note posée par l'auteur des corrections, à confirmer par une revue indépendante lors de la prochaine passe : visibilité de l'état 3 (date et heure visibles, mais une jambe non réglée n'a toujours pas d'état), correspondance au réel 3, contrôle 3, cohérence 3 (« Annulé » reste sur les jambes remboursées), prévention des erreurs 3, reconnaissance 2 (explications encore au survol), flexibilité 2, minimalisme 3, récupération d'erreur 2, aide 2.
