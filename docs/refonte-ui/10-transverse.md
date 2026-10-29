# Refonte UI — 10. Ce qui traverse tous les écrans

_29/10/2026. Proposition à corriger. Six sujets qui ne sont à personne et qu'on écrit une fois : le premier lancement, les états communs, les notifications poussées, l'ordinateur, les mentions obligatoires, la langue et la devise._

## 1. Le premier lancement

Pas de guide pas à pas, pas d'assistant ([02](02-les-4-onglets.md) § 0). Un nouveau joueur arrive sur **Aujourd'hui**, comme tout le monde, avec deux différences, une seule fois :

```
 EVCore                                🔔  (K)
────────────────────────────────────────────────
 Chaque jour, un pari qu'on suit depuis le 13/10 :
 gagné 4 jours sur 5. On ne prend jamais ta mise.    ×
────────────────────────────────────────────────
 [PSG] PSG – Lens  19:00  Victoire du PSG  1,28
 ● ● ● ● ● ● ● ● ○ ○   8 sur 10
                 [ Suivre ]
 …
```

1. **Une ligne d'accueil** au-dessus du héros, refermable, qui ne revient pas : ce qu'on fait (un pari par jour, suivi et compté), ce qu'on ne fait pas (prendre une mise). Deux phrases, c'est le seul paragraphe autorisé de l'application, et il s'affiche une fois.
2. **Au premier « Suivre »**, la ligne « Tu recevras son résultat demain matin » sous le bouton ([04](04-aujourdhui-en-detail.md) § 3), puis la demande d'autorisation des notifications poussées, à ce moment-là et pas avant : le joueur vient de dire qu'il veut un résultat.

Rien d'autre : pas de choix de championnats, pas de questionnaire, pas de tour des onglets. La ligne Hier est vide le premier jour (« Hier · rien à montrer »), elle se remplit le lendemain.

## 2. Les états communs

Écrits une fois, les mêmes partout. Chaque fiche d'écran y renvoie.

| État | Règle | Ce qu'on voit |
| --- | --- | --- |
| **Chargement** | Jamais de roue au milieu d'un écran vide. La forme de l'écran s'affiche en gris (les blocs à leur place) jusqu'à l'arrivée des données. | Blocs gris, pas de texte. |
| **Hors ligne** | Le dernier écran vu reste lisible, avec son heure. Les gestes qui écrivent (Suivre, Partager, envoyer un message) sont grisés. | Une ligne en haut : « Hors ligne · vu à 18:42 ». |
| **Erreur du serveur** | On garde ce qu'on a (le dernier contenu, s'il existe) et on dit qu'on réessaie. Jamais de code, jamais de « une erreur est survenue ». | « On n'arrive pas à charger · réessayer ». |
| **Vide** (rien à montrer) | Une ligne qui dit ce qui manque et où aller, jamais une illustration. | « Rien à jouer aujourd'hui », « Suis ton premier coupon · Aujourd'hui › ». |
| **Pause active** | Aujourd'hui, Matchs et Vérifie ton ticket fermés avec la date de retour ; Résultats et Moi ouverts ([09](09-moi.md) § 4). | « En pause jusqu'au 5/11 à 19:00 », et Jeu responsable pour prolonger. |
| **Maintenance** | Une page, pas un onglet : « On revient dans quelques minutes », l'heure prévue si on la connaît. | Logo, une ligne, rien à toucher. |
| **Session expirée** | Retour à la connexion avec l'écran demandé en mémoire : après connexion, on revient où on était. | L'écran de connexion, sans message d'erreur. |
| **Version ancienne** | Quand le serveur refuse une version trop vieille de l'application : une ligne en haut, « Mets à jour pour continuer ». | Une ligne, un bouton. |

Trois règles pour tous :
- **une ligne d'état remplace un contenu, elle ne s'y ajoute pas** ;
- **jamais deux états en même temps** : hors ligne l'emporte sur erreur, pause l'emporte sur tout ;
- **jamais un état sans issue** : chaque ligne d'état dit quoi faire ou quand revenir.

## 3. Les notifications poussées

Quatre sortes, celles de la cloche ([09](09-moi.md) § 6), chacune avec son heure, son texte et son endroit d'arrivée. Toutes activées par défaut, toutes coupées par un interrupteur dans Compte, aucune pendant une pause. Jamais de notification « les coupons du jour sont publiés » : les coupons existent dès la veille, le joueur n'a pas à être réveillé pour ça ; ils sont dans la matinée.

| Sorte | Quand | Titre | Texte | Mène à |
| --- | --- | --- | --- | --- |
| **Ta matinée** | 8 h, heure d'Abidjan | « Ta matinée EVCore » | Hier d'abord, tes coupons suivis, puis aujourd'hui : « Favori ✓ 1,24 · Combiné ✗. Ton Combiné suivi : perdu. Aujourd'hui : Favori 1,28 · Combiné 1,41 · Cote 2 2,30. » Les absences en fin : « Pas de Chasseur Nul aujourd'hui. » | Aujourd'hui |
| **Ta semaine** | Lundi 8 h, à la place de la matinée | « Ta semaine EVCore » | « Favori : 5 jours gagnés sur 6. Combiné : 4 sur 6. Tes coupons suivis : 3 gagnés, 2 perdus. » Puis les coupons du jour, comme la matinée. | Résultats, feuille Ta semaine |
| **Résultat de ton coupon** | Le soir même, dès le dernier match réglé, entre 20 h et 1 h seulement | « Ton Favori est passé ✓ » ou « Ton Combiné a perdu ✗ » | Une ligne : « PSG – Lens 2-0 · 1,24 » ou « cassé sur Lazio – Torino 1-0 ». | Moi, le coupon réglé |
| **Réponse de l'équipe** | Quand l'équipe écrit | « L'équipe t'a répondu » | Les 60 premiers caractères du message. | Messages |
| **Annonce** | Quand on en publie une, jamais plus d'une par semaine, jamais le soir | Le titre de l'annonce | Sa première ligne. | L'annonce |

Règles :
- **jamais de montant, jamais de gain** dans une notification, même pour un coupon gagné ;
- **jamais entre 1 h et 8 h** ; ce qui tombe dans ce créneau attend la matinée ;
- **une notification porte une chose** : la matinée regroupe, le reste ne regroupe pas ;
- **le texte est celui de l'écran** : les mêmes mots que la ligne Hier et que le bilan, pour que le joueur reconnaisse ce qu'il ouvre ;
- la version e-mail, quand elle est activée, est la matinée et la semaine seulement, avec le même texte.

Un joueur qui n'a pas autorisé les notifications poussées voit les mêmes lignes dans la cloche, rien de plus.

## 4. L'ordinateur

L'application est faite pour le téléphone ; sur un écran large elle ne change pas de contenu, seulement de disposition.

```
 ┌──────────┬───────────────────────────────────────┬───────────────────────┐
 │ EVCore   │  Hier  Favori ✓ · Combiné ✓            │  ‹  Favori du jour    │
 │          │                                        │  ● ● ● ● ● ● ● ● ○ ○  │
 │ ● Aujour.│  [PSG] PSG – Lens  19:00               │  [PSG] PSG            │
 │   Matchs │  Victoire du PSG   1,28   8 sur 10     │  [LEN] Lens           │
 │   Résult.│                    [ Suivre ]          │  …                    │
 │   Moi    │                                        │                       │
 │          │  Combiné du jour   3 matchs · 1,41  ›  │                       │
 │ 🔔  (K)  │  …                                     │                       │
 └──────────┴───────────────────────────────────────┴───────────────────────┘
```

- **Les 4 onglets en colonne à gauche**, la cloche et l'initiale en bas de cette colonne. C'est la barre latérale déjà en place, réduite à quatre entrées.
- **Les feuilles** (coupon ouvert, fiche de match, ticket, détail d'un produit) s'ouvrent **dans une colonne à droite**, pas par-dessus : sur un écran large on lit la liste et le détail ensemble. Sur un écran moyen (tablette), la feuille reste par-dessus comme sur téléphone.
- **La largeur du contenu est bornée** (la colonne centrale ne dépasse pas la largeur d'une lecture confortable) : rien ne s'étire.
- **Vérifie ton ticket** : la barre basse devient une ligne fixe en bas de la colonne centrale.
- **Rien de plus sur ordinateur** : pas de tableau, pas de colonnes supplémentaires, pas de filtres de plus. L'admin, lui, est fait pour l'ordinateur et a ses propres règles.

## 5. Les mentions obligatoires

- **Une ligne fixe** en pied de chaque écran du joueur, sous les onglets : « 18+ · Parier comporte des risques de perte ». Toujours la même, jamais masquée, jamais plus grande.
- **Sur l'image partagée** (ticket, coupon) : la même ligne, en bas.
- **À l'inscription** : la date de naissance n'est pas demandée ; une case « J'ai 18 ans ou plus (21 au Cameroun), ou l'âge légal de mon pays » et une case « J'accepte les conditions », comme livré le 27/10.
- **Les pages légales** (conditions, confidentialité, mentions, jeu responsable) sont accessibles depuis Moi › Compte en bas et depuis le pied de la landing. Elles gardent leur sommaire et leur contenu ; leur style suivra celui de l'application.
- **Le nom du bookmaker** : « 1xBet » est nommé partout où une cote est affichée, parce que c'est le prix que le joueur trouvera. Aucun lien vers 1xBet, jamais, nulle part.
- **Jamais** les mots « sûr », « garanti », « gagnant », « rentable », ni un gain en francs sur un coupon à venir, sur aucun écran ni aucune image.

## 6. La langue et la devise

- **Français par défaut**, anglais disponible dans Compte › Affichage. Les deux fichiers de langue existent ; le registre reste le tutoiement en français et le « you » direct en anglais.
- **La devise** : F CFA par défaut, sans centimes, avec l'espace fine comme séparateur de milliers (« 14 000 F »). Le joueur peut la changer dans Compte. Elle ne sert qu'à deux endroits : « En francs » dans Résultats et « 1xBet garde X F sur 100 » dans les fiches d'Aide. Partout ailleurs on parle en fréquences et en cotes.
- **Les cotes** : toujours avec une virgule et deux décimales en français (« 1,28 »), un point en anglais.
- **Les heures** : celles de l'appareil, en format 24 h, sans fuseau affiché ; les coupons sont composés à 17 h UTC, soit 17 h à Abidjan, et la matinée part à 8 h d'Abidjan quel que soit l'appareil.
- **Les noms d'équipes et de championnats** passent par les mêmes tables de traduction que l'application actuelle (`translateCompetition`), une seule source.
- **Les dates** : « mardi 28 » dans la journée, « 28/10 » dans les listes, jamais le mois en lettres avec l'année.

## 7. Ce qu'il faut construire

- **La ligne d'accueil** une fois (drapeau côté serveur, pas sur l'appareil : elle ne doit pas revenir après réinstallation).
- **La demande de notifications** au premier Suivre, et non à l'ouverture de Messages.
- **Les états communs** en composants partagés (chargement en forme grise, ligne d'état, page de maintenance, version ancienne).
- **La notification « Résultat de ton coupon »** le soir même (nouvelle : aujourd'hui le résultat n'arrive qu'avec la matinée), avec son créneau 20 h–1 h.
- **La colonne de droite** sur écran large pour les feuilles.
- **Le retrait** des types d'exploitation de la cloche joueur ([09](09-moi.md) § 6).

## 8. Tranché le 29/10

1. **La notification du soir** « Ton Favori est passé ✓ » : créée, créneau 20 h–1 h.
2. **L'ordinateur** : colonne de détail à droite sur écran large, par-dessus sur tablette.
3. **L'anglais** : gardé.
