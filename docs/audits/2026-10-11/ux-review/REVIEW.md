# Revue UX / UI — pages utilisateur, mobile et desktop (2026-10-11)

Parcours réalisé avec un compte **opérateur ordinaire créé pour l'occasion**
(`ux-tester@evcore.local`, rôle OPERATOR, aucune donnée propre), sur la pile
locale branchée sur la base de production restaurée du 10 octobre. Deux
viewports : iPhone 13 (390 × 844) et desktop 1280 × 800. Vingt-deux pages
visitées, captures et mesures automatiques dans ce dossier (`metrics.jsonl` :
débordement horizontal, erreurs console, requêtes en échec, cibles tactiles
< 32 px, textes < 11 px).

**Ce qui va bien.** Aucun débordement horizontal sur aucune page, aucune
erreur console, aucune requête API en échec. La langue est soignée, les
pages Matchs, Formation, Profil et Mesures historiques sont lisibles. Le
tableau de bord ne promet jamais de gain, et le dit.

**Ce qui ne va pas, par ordre de gravité.**

## P0 — bloquant pour un nouvel utilisateur

1. **La bannière « Installer EVCore » recouvre le bas de toutes les pages
   en mobile**, y compris le bouton principal de l'accueil public
   (« Rejoindre la stratégie ») et la dernière carte de chaque liste. Elle
   revient à chaque page tant qu'on ne la ferme pas, et elle s'empile avec la
   barre de navigation basse : un tiers de l'écran utile est perdu.
   _Captures : `mobile__public_landing.png`, `mobile__dashboard.png`._
   → Une seule apparition par session, en haut ou en toast temporaire, jamais
   au-dessus d'un bouton d'action ; ne pas l'afficher sur la page de
   connexion ni sur le formulaire.

2. **Un nouvel utilisateur reçoit 9+ notifications d'ingénierie, en anglais,
   avec des codes bruts** : « ROI Alert — RESULT*BTTS · ROI -16.17% over 30
   bets (threshold: -10%) ». Ce sont des alertes du moteur adressées à tous
   les opérateurs (`notification.service.ts`, `sendRoiAlert`), sur un
   indicateur que le projet a lui-même retiré comme mesure. Pour un
   utilisateur, c'est incompréhensible et anxiogène ; et le badge « 9+ »
   rouge est le premier chiffre qu'il voit. \_Capture :
   `mobile__dashboard_notifications.png`.*
   → Réserver ROI_ALERT et MARKET_SUSPENSION aux administrateurs ; pour les
   opérateurs, des notifications en français sur ce qui les concerne (coupon
   du jour publié, résultat d'un coupon joué, changement de calibration d'un
   canal suivi).

3. **L'accueil connecté ne répond pas à la question « que fais-je ici ? »**
   La première chose visible est un bandeau d'annonce tronqué (« On veut vous
   écouter 🎧 Pa… »), puis « Filtres 1 · Réinitialiser » sans dire ce qui est
   filtré, puis une carte « Calibration des canaux actifs » barrée d'un
   rouge plein « Écart > 30 % détecté », puis des « sélections issues de
   canaux avec un écart ≤ 15 % ». Le coupon du jour, raison d'être du
   produit, n'y apparaît pas. _Captures : `mobile__dashboard.png`,
   `desktop__dashboard.png`._
   → L'accueil doit montrer le coupon du jour, les picks du jour en langage
   clair (« 3 sélections aujourd'hui, 69 % de confiance »), et renvoyer la
   calibration des canaux dans Mesures historiques. Le rouge est réservé à
   ce qui demande une action de l'utilisateur.

4. **L'accueil public annonce « Accès sur invitation » et l'inscription est
   ouverte** (`/auth/register`, sans code). L'un des deux ment. En desktop,
   dans la carte de démonstration, « Les deux équipes marquent » et
   « 54 % attendus » se chevauchent ; « Écarté — edge trop élevé » est du
   jargon interne sur une page marketing. _Capture :
   `desktop__public_landing.png`._

## P1 — fait perdre du temps ou de la confiance

5. **Décisions, mobile : le bloc de filtres occupe 60 % du premier écran**
   (Ligue, Canal, Affichage, navigation par date, puis le bouton d'aide seul
   sur sa ligne). Le premier match n'apparaît qu'au second écran. _Capture :
   `mobile__dashboard_decisions_date_2026-10-10.png`._
   → Une ligne : date au centre, un bouton « Filtres » avec compteur, l'aide
   dans le menu. Même remarque, en moins grave, pour Coupons (carte de date
   avec le bouton d'aide isolé dessous) et Matchs (date alignée à gauche,
   seule page à le faire).
   _Corrigé le 2026-10-11 : une ligne sur les trois pages (bouton
   « Filtres » avec compteur et tiroir bas sur Décisions). Captures :
   `after/lot3__mobile__dashboard_decisions_date_2026-10-10.png`,
   `after/lot3__mobile__decisions_filters_open.png`._

6. **Desktop : les listes de Coupons et de Décisions n'utilisent que la
   moitié gauche de l'écran** ; à 1280 px, les cartes font 430 px et les noms
   d'équipes sont tronqués (« Suwon … vs Hw… ») alors que 600 px restent
   vides à droite. _Captures : `desktop__dashboard_coupons_date_2026-10-09.png`,
   `desktop__dashboard_decisions_date_2026-10-10.png`._
   → Grille à deux ou trois colonnes, ou une colonne pleine largeur avec les
   jambes en ligne.
   _Corrigé le 2026-10-11 : deux colonnes dès 768 px (Coupons) / 1024 px
   (Décisions), trois à partir de 1536 px ; la vue « par heure » devient une
   grille continue triée par coup d'envoi. Captures :
   `after/lot3__desktop__dashboard_coupons_date_2026-10-09.png`,
   `after/lot3__desktop__dashboard_decisions_date_2026-10-10.png`._

7. **Le jargon de calibration est servi tel quel sur chaque pick** : badge
   « Écart ≤ 15 % » répété sous chaque sélection, « Écart > 30 % » en rouge,
   « Clôture @1.27 · −4.0 % » en orange sur un pick pourtant **gagné**. Le
   signe négatif se lit comme une perte ; or c'est la marge payée, et la
   couleur orange est arbitraire tant que la marge n'est pas connue
   (sélections d'avant le 10 octobre). _Capture :
   `desktop__dashboard_decisions_date_2026-10-10.png`._
   → Un seul indicateur de confiance par pick (pastille verte / orange /
   rouge avec libellé « calibré », « à surveiller », « peu fiable »), la
   clôture dans une infobulle ou un détail, en couleur neutre quand la marge
   payée est inconnue. _Code concerné : `channel-row.tsx` (ClosingLine),
   livré le 2026-10-11, à corriger dans la foulée._
   _Corrigé le 2026-10-11 : une seule pastille « Fiable / À surveiller /
   Peu fiable » par pick (Décisions et Arbitrage), détail en langage clair au
   clic ; « Clôture @1.27 » seule, en gris, la valeur signée et la
   comparaison à la marge dans le détail, vert uniquement quand la marge
   payée est connue et battue (Décisions et jambes de coupon). Captures :
   `after/lot4__desktop__dashboard_decisions_date_2026-10-10.png`,
   `after/lot4__desktop__dashboard_decisions_date_2026-10-10__closing_open.png`,
   `after/lot4__desktop__dashboard_decisions_date_2026-10-10__confidence_open.png`._

8. **Le bouton flottant de l'assistant Eva recouvre le menu.** En desktop il
   se superpose à l'entrée « Accueil » de la barre latérale (le texte devient
   « cueil ») ; en mobile il flotte sur les cartes en bas à gauche, pendant
   qu'un second bouton rond (loupe) dépasse à moitié du bord droit. Deux
   boutons flottants plus la bannière d'installation plus la barre basse :
   quatre couches sur le contenu. _Captures : `desktop__dashboard.png`,
   `mobile__dashboard.png`._
   → Un seul bouton flottant, à droite, au-dessus de la barre basse, et une
   position par défaut qui ne chevauche jamais la navigation.
   _Corrigé le 2026-10-11 : Eva ancré en bas à droite (au-dessus de la barre
   basse en mobile), plus de glisser-déposer ; la recherche de page devient
   un bouton d'en-tête desktop, la loupe flottante disparaît. Captures :
   `after/lot3__desktop__dashboard.png`, `after/lot3__mobile__dashboard.png`._

9. **Mes coupons, nouvel utilisateur : l'état vide parle de filtres.**
   « Aucun coupon ne correspond à cette période. Essaie d'élargir le
   filtre. » avec « Filtres 2 » actifs par défaut, et trois tuiles
   « Misé 0 F · Net réglé 0 F · En attente 0 » qui remplissent l'écran. Un
   nouvel arrivant n'a rien à filtrer. _Capture :
   `mobile__dashboard_bet-slips.png`._
   → État vide guidé : « Vous n'avez pas encore joué de coupon. Voir le
   coupon du jour → ». Les tuiles n'apparaissent qu'à partir du premier
   coupon.
   _Corrigé le 2026-10-12 : état vide guidé (jamais joué), « Aucun coupon
   sur cette période » avec un bouton « Afficher les 90 derniers jours »
   sinon, tuiles seulement quand la période contient un coupon._

10. **La devise « F » apparaît partout** (« 0 F » dans l'en-tête, les tuiles)
    sans que l'utilisateur ait choisi de devise ni déposé quoi que ce soit ;
    un portefeuille à zéro en permanence dans l'en-tête mobile prend la
    place la plus visible de l'écran.
    → Masquer le portefeuille tant qu'il est vide, ou l'afficher dans la
    devise choisie à l'inscription.
    _Corrigé le 2026-10-12 : icône seule tant que le solde est à zéro (elle
    reste l'entrée vers la page Portefeuille), montant dès qu'il y en a un._

11. **Onboarding en trois étapes** : correct, mais le champ de recherche a
    un placeholder tronqué (« Rechercher un championnat ou un ») et la liste
    des ligues commence par l'Allemagne par ordre alphabétique : un
    utilisateur français ou ivoirien cherche d'abord « ses » ligues.
    _Capture : `mobile__onboarding.png`._
    → Ligues populaires d'abord (par volume de matchs analysés), puis la
    recherche.
    _Corrigé le 2026-10-12 : groupe « Populaires » en tête (Ligue 1, Premier
    League, La Liga, Serie A, Bundesliga, coupes d'Europe, Ligue 2, 2.
    Bundesliga, Coupe du monde), placeholder raccourci. Le volume analysé
    classait l'Argentine et le Brésil en tête : ce n'est pas ce qu'un nouvel
    arrivant cherche, la liste est donc éditoriale._

## P2 — finitions

12. Formation, mobile : le cercle d'icône recouvre le badge « À découvrir »
    sur chaque carte. _Capture : `mobile__dashboard_formation.png`._
    _Corrigé le 2026-10-12 : la carte mise en avant réserve la hauteur des
    badges (padding haut), le contenu ne remonte plus dessous._
13. Mesures historiques : « PARIS MATÉRIALISÉS — 2026-07-13 → 2026-10-11 »
    en dates ISO et flèche ASCII dans un titre ; les trois tuiles sont
    empilées une par ligne en mobile (deux par ligne suffisent). Le texte
    d'introduction de six lignes se lit avant tout chiffre.
    _Corrigé le 2026-10-12 : « du 13 juillet 2026 au 11 octobre 2026 »,
    tuiles sur deux colonnes en mobile. L'introduction reste._
14. Notifications : les onglets passent sur deux lignes en mobile
    (« Toutes · Non lues · Annonces » puis « Alertes »), et chaque carte
    porte une étiquette « MOYENNE » dont le sens n'est pas donné.
    _Corrigé le 2026-10-12 : onglets sur une ligne défilante, étiquette de
    gravité masquée quand elle vaut la valeur par défaut._
15. Matchs, mobile : un badge « PLANIFIÉ » sur chacune des 173 cartes ne
    distingue rien ; « Indice de paris » est un bouton dont le libellé ne
    dit pas ce qu'il ouvre.
    _Corrigé le 2026-10-12 : badge seulement pour terminé / en cours /
    reporté / annulé ; le bouton s'appelle « Réussite par marché »._
16. Profil : la ligne « Téléphone » est un consentement de six lignes à côté
    d'un interrupteur, sans champ de numéro. La bande d'avatars défile
    horizontalement sans indice qu'elle continue.
    _Corrigé le 2026-10-12 : la ligne dit « Non renseigné · Ajouter mon
    numéro » ; le consentement et l'interrupteur n'apparaissent qu'après le
    clic, le champ juste après. Le bord droit de la bande d'avatars
    s'estompe pour dire qu'elle continue._
17. Formulaire d'inscription : « Nom & prénoms » ; aucune règle de mot de
    passe au-delà de « 8 caractères minimum » ; l'inscription mène à une
    adresse à vérifier sans le dire avant l'envoi.
    _Corrigé le 2026-10-12 : « Nom complet », règle de mot de passe dite
    telle qu'elle est (8 caractères, la seule règle serveur) avec le conseil
    utile, et « un code à 6 chiffres vous sera envoyé à cette adresse » sous
    le champ email._
18. Les confettis sur un coupon gagné sont rejoués à chaque visite de la
    page du jour, même pour un gain qui n'est pas le sien.
    _Déjà corrigé par la PR #250 : une fois par jour, et seulement pour un
    coupon que l'utilisateur a joué._

## Mesures (dev, sans cache : les temps de chargement ne sont pas

représentatifs)

| Page (mobile)       | Cibles < 32 px / visibles | Textes < 11 px |
| ------------------- | ------------------------- | -------------- |
| Accueil             | 2 / 17                    | 28             |
| Coupons (9 oct.)    | 4 / 18                    | 51             |
| Décisions (10 oct.) | 8 / 26                    | **5 926**      |
| Matchs              | 5 / 25                    | 107            |
| Mesures historiques | 1 / 17                    | 326            |
| Profil              | **14 / 28**               | 19             |

La page Décisions rend près de six mille nœuds de texte en dessous de 11 px
sur un téléphone : c'est la totalité des 173 rencontres et de leurs canaux,
rendue d'un bloc. Le profil a quatorze cibles tactiles trop petites (la bande
d'avatars).

## Ordre proposé

1. Bannière d'installation (P0-1) et notifications d'ingénierie (P0-2) : deux
   corrections courtes, sans refonte.
2. Accueil connecté (P0-3) : décider ce qu'il montre ; c'est une page à
   réécrire, pas à retoucher.
3. Barre de filtres compacte commune à Coupons, Décisions, Matchs (P1-5) et
   grille desktop (P1-6).
4. Indicateur de confiance unique par pick, clôture reléguée (P1-7) et
   boutons flottants (P1-8).
5. États vides guidés et devise (P1-9, P1-10), puis les finitions.

## Suite (2026-10-12)

Mesures Décisions / Coupons et critique du point de vue d'un utilisateur
lambda : `docs/audits/2026-10-12/MESURES-DECISIONS-COUPONS.md` (une
sélection mise en avant par match, « Pari sûr du jour » en premier, coupon
5–15 renommé « Coupon long » avec sa fréquence de gain en clair).
