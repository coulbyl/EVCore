# Refonte UI — 13. Le style : le tableau d'affichage

_29/10/2026. Direction choisie par l'utilisateur parmi la main tirée par la méthode impeccable (`apps/web/.impeccable/questions/direction-aujourdhui-2026-10-29.json`, contrat dans le brief de surface de `app/dashboard/page.tsx`). Elle se teste d'abord sur Aujourd'hui, puis s'étend écran par écran. Rien ici ne change le contenu décidé dans 01 à 12._

_Depuis le 29/10, la référence normative du style construit est `apps/web/DESIGN.md` (jetons et règles tirés du code). Cette fiche garde le raisonnement du choix._

## 1. L'idée

**Chaque chiffre d'EVCore se lit comme un score sur le tableau du stade** : trois lettres, un nombre tabulaire, une seule couleur allumée. C'est le monde que le joueur connaît par cœur (le bandeau de score de Canal+ Afrique et de beIN, le tableau du stade) et qui dit exactement ce qu'on promet : un résultat, compté, sans commentaire. Il refuse le défaut des applis de paris (fond vert sombre, néon, cartes dans les cartes, bonus) et son opposé (fintech blanche à accent bleu).

Le monde ne prête que quatre choses : **le type, la palette, la densité, un geste signature**. Il ne dessine ni la navigation ni les contrôles : les onglets, les boutons, les listes restent ceux qu'un téléphone a déjà.

## 2. La palette

| Rôle | Valeur | Usage |
| --- | --- | --- |
| Encre (bandeau) | `#0E1320` | Le bandeau de tête de chaque onglet, le bouton principal, le texte sur sol clair |
| Diode allumée | `#FFB300` | **La seule couleur allumée** : chances, ✓ dans le bandeau, l'onglet actif. Jamais ailleurs. |
| Diode éteinte | `#2A3142` sur encre · `#D9DDE3` sur sol | Les points non atteints, les filets |
| Sol | `#F6F7F9` | Le fond de l'écran, blanc froid, lisible au soleil |
| Carte | `#FFFFFF` | La seule surface posée sur le sol : la carte du jour |
| Texte | `#141821` · secondaire `#5B6472` | Rampe de gris fixe à onze pas ; aucun gris hors rampe |
| Gagné / perdu | `#1F8A4C` · `#C62828` | Les résultats seulement : pastilles de forme, ✓ ✗ réglés. Jamais pour décorer. |

**Sombre** : le sol devient `#0B0E16`, la carte `#141821`, le texte `#EEF1F5` ; le bandeau garde son encre, l'ambre ne change pas. On choisit clair par défaut parce que le joueur lit dehors ; le sombre suit le réglage du téléphone.

**Règle** : couleur plate, sans dégradé, sans grain, sans ombre. L'élévation est un filet de 1 px ou rien.

**Corrigé à l'implémentation (A2, 29/10)** pour tenir WCAG AA : vert gagné `#1C8045` en clair (le `#1F8A4C` des maquettes faisait 4,1:1 sur le sol) ; la diode allumée porte un contour `#B07A00` en clair, parce que l'ambre seul fait 1,8:1 sur blanc ; la diode éteinte en clair est un anneau `#7D8799`, pas un disque gris ; le gris discret des chevrons devient `#7D8799`. Rampe de gris : `#FFFFFF #F6F7F9 #E8EBF0 #D9DDE3 #B4BAC4 #7D8799 #5B6472 #2A3142 #141821 #0E1320 #0B0E16`. Vérification : `pnpm --filter web check:contrast`.

## 3. Le type

- **Barlow Condensed** 600 et 700 pour tout ce qui est score : codes d'équipe à trois lettres, cotes, « 8 sur 10 », heures, compteurs. Toujours en chiffres tabulaires.
- **Barlow** 400 et 500 pour le texte : noms d'équipes, paris nommés, faits, lignes d'état. Jamais plus de deux graisses à l'écran.
- Échelle : 11 (mentions), 13 (secondaire), 15 (texte), 17 (pari), 22 (titre de carte), 28 (cote et chance). Rien au-dessus de 28 sur téléphone.
- Les noms complets sur la carte (« Paris SG », « Lens ») ; les codes seulement dans les lignes de score et les pastilles.

## 4. La densité

Une ligne par chose. Un écran = un bandeau, une carte, des lignes filetées, une barre d'onglets. Les lignes se recomposent entières, un texte n'est jamais tronqué (il est coupé à l'écriture). Le budget de texte de [01](01-ce-qu-on-montre.md) § 5 est une contrainte du style autant que du contenu.

## 5. Le geste signature

**La ligne de score.** Tout résultat s'écrit comme un score : `FAV ✓ 1,24 · COM ✓ 1,41 · C2 ✗`. Elle vit dans le bandeau (Hier), dans Résultats (chaque jour), dans la matinée (même texte). Les dix chances sont des **diodes** : allumées en ambre, éteintes en gris. À l'ouverture d'Aujourd'hui, elles s'allument de gauche à droite une fois (300 ms, désactivé si le téléphone demande moins de mouvement). Le soir, la cote de la carte cède la place au ✓ ou ✗ allumé. C'est le seul mouvement de l'application.

## 6. Ce que ça donne sur les autres écrans

- **Matchs** : chaque ligne est une ligne de score (`ARS – CHE · Victoire Arsenal · 7 sur 10`), les diodes réduites à un nombre ; Hier montre le score réel en tabulaire.
- **Résultats** : les grilles de forme en petits carrés verts et rouges, les « jours gagnés sur joués » en condensé ; le bandeau porte Ta semaine le lundi.
- **Vérifie ton ticket** : la barre basse en encre avec « 1 fois sur 9 » en ambre ; l'image partagée est un tableau d'affichage noir avec le chiffre en ambre.
- **Moi, Compte, Aide** : sol, filets, texte ; pas de diode (rien n'y est une chance).
- **Public** : la landing est la carte du jour, telle quelle, sur le sol, avec le bandeau.
- **Admin** : même bandeau, même type, densité plus forte (tables), les trois voyants sont des diodes vert / ambre / rouge, seules exceptions au « une couleur allumée ». Sur téléphone, un cinquième onglet « Admin » pour les comptes admin, puces Accueil · Moteur · Joueurs, tables en lignes.

## 7. Les esquisses

- Décision : `apps/web/.impeccable/mocks/decision/assigned.html` (retenue), `model-pick.html` (le ticket), `canon.html` (le standard).
- Maquette complète sur la toile Design de Claude, 37 écrans : https://claude.ai/artifact/1SWX3fFM9DmEAsagToX9hu. Rangée 1, Aujourd'hui et ses états (matin, soir réglé, coupon ouvert, sombre, rien à jouer, premier lancement, pause) ; rangée 2, Matchs (aujourd'hui, hier, fiche, ticket en cours, feuille du ticket, ticket d'hier, image partagée) ; rangée 3, Résultats (liste, produit, Ta semaine), la cloche, Moi (accueil, Messages, Aide, Jeu responsable, Compte) ; rangée 4, le public (landing téléphone, inscription, connexion, vérification, 404, landing ordinateur) ; rangée 5, l'admin sur téléphone (accueil, Moteur, Joueurs, Réglages) ; rangée 6, l'admin sur ordinateur (accueil, Moteur, Joueurs, Réglages). Sources dans `docs/refonte-ui/maquettes/toile/` (format `.dc.html` de la toile).
- Contrat de direction : `apps/web/.impeccable/surfaces/app-dashboard-page-tsx.md` (seed:45205d7f4d78dbb0).

## 8. Tranché le 29/10 sur la maquette

1. Le bandeau sombre en tête de chaque onglet.
2. L'ambre comme seule couleur allumée, onglet actif compris.
3. Les codes à trois lettres dans la ligne Hier (FAV, COM, C2, NUL, BTS, COR, ACC, IA).
