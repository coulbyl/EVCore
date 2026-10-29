# Refonte UI — sommaire et état d'avancement

_Mis à jour le 29/10/2026. On écrit d'abord ce que chaque écran montre, pour qui, dans quel ordre et avec quels états. Le style vient à la fin, quand toute l'application est écrite._

Légende :
- ✅ **écrit** : le contenu et la hiérarchie sont décidés.
- 🟡 **esquissé** : les blocs sont posés, mais il manque le détail ou les états.
- ⬜ **à écrire**.

## Joueur — l'application (4 onglets)

| Nouvel écran | Remplace | État | Ce qui manque |
| --- | --- | :---: | --- |
| **Aujourd'hui** | Accueil, Coupons | ✅ | [04-aujourdhui-en-detail.md](04-aujourdhui-en-detail.md), validé le 29/10 (héros Favori + relais Combiné, fait par jambe visible, bouton « Suivre »). Réserve ouverte sur l'attrait des cotes courtes : [05-etude-cotes-courtes.md](05-etude-cotes-courtes.md), relecture le 10/12. |
| **Matchs** | Décisions, Avis IA, fiche de match | ✅ | [06-matchs.md](06-matchs.md), validé le 29/10 (grands championnats d'abord, sans-lecture repliés, phrase IA visible). La fiche actuelle reste côté admin. |
| **Vérifie ton ticket** | Ticket déclaré, solde | ✅ | [07-verifie-ton-ticket.md](07-verifie-ton-ticket.md), validé le 29/10 (ni mise ni gain, ticket d'hier montré une fois, 15 paris au plus). |
| **Résultats** | Mesures historiques | ✅ | Écrit dans [08-resultats.md](08-resultats.md) (ligne Hier, une ligne par produit en jours gagnés, détail avec grille, annoncé/réalisé, En francs, jour par jour). Validé le 29/10 : « Trop tôt » à 10 jours pour tout, Résultats ouvert pendant la pause. Coupon long tranché : remplacé par l'accumulateur de chasseurs vendu à la semaine ([ACCUMULATEUR.md](../audits/2026-10-29/ACCUMULATEUR.md)). |
| **Moi** | Mes coupons, Suivi de mise, Inbox, Notifications, Compte, Formation, Glossaire | ✅ | Écrit dans [09-moi.md](09-moi.md) (bilan des coupons suivis, En cours · Réglés, quatre lignes, cloche sans onglets). Tranché le 29/10 : coupons déclarés et suivi de mise effacés à la mise en ligne, suppression du compte dans Jeu responsable. Une seule conversation dans Messages. |
| ↳ Mes coupons suivis | Mes coupons | ✅ | [09-moi.md](09-moi.md) § 1 et § 7. |
| ↳ Messages | Inbox | ✅ | [09-moi.md](09-moi.md) § 2 : une conversation, pièces jointes gardées. |
| ↳ Notifications | Notifications, Annonces | ✅ | [09-moi.md](09-moi.md) § 6 : la cloche, quatre sortes, sans onglet ; textes dans 10. |
| ↳ Jeu responsable | Compte › Jeu responsable | ✅ | [09-moi.md](09-moi.md) § 4 : pause, numéros d'aide, suppression du compte. |
| ↳ Compte | Compte (5 onglets) | ✅ | [09-moi.md](09-moi.md) § 5 : une page en sections, devise gardée, mise par unité retirée. |
| ↳ Aide | Formation, Glossaire | ✅ | [09-moi.md](09-moi.md) § 3 : 9 fiches, « ? » contextuel, glossaire fondu dans les fiches. |

## Joueur — ce qui traverse tous les écrans

| Sujet | État | Ce qui manque |
| --- | :---: | --- |
| Règles de texte et filtres | ✅ | — |
| Premier lancement | ✅ | [10-transverse.md](10-transverse.md) § 1 : ligne d'accueil une fois, demande de notifications au premier Suivre. |
| États communs | ✅ | [10-transverse.md](10-transverse.md) § 2 : 8 états, 3 règles. |
| Notifications poussées | ✅ | [10-transverse.md](10-transverse.md) § 3 : 4 sortes + résultat du soir (validé), textes et destinations, créneau 8 h–1 h. |
| Ordinateur | ✅ | [10-transverse.md](10-transverse.md) § 4 : colonne gauche à 4 entrées, feuilles en colonne droite (validé). |
| Mentions obligatoires | ✅ | [10-transverse.md](10-transverse.md) § 5 : ligne fixe, image, inscription, mots interdits. |
| Langue et devise | ✅ | [10-transverse.md](10-transverse.md) § 6 : fr/en (validé), F CFA, heures de l'appareil. |

## Public — avant la connexion

| Écran | État | Ce qui manque |
| --- | :---: | --- |
| Landing | ✅ | [11-public.md](11-public.md) § 1 : phrase de marque, le héros du jour en vrai avec sa forme, bouton, nos résultats, comment ça marche, pied légal ; page `/resultats` publique ; image de partage du jour. |
| Inscription | ✅ | [11-public.md](11-public.md) § 2 : prénom, e-mail, mot de passe, deux cases ; nom d'utilisateur retiré. |
| Connexion, vérification, mot de passe oublié, double authentification | ✅ | [11-public.md](11-public.md) § 3–6 : e-mail + mot de passe, vérification qu'on peut passer, double authentification facultative. |
| Pages légales (CGU, confidentialité, mentions, jeu responsable) | ✅ | [11-public.md](11-public.md) § 7 : contenu gardé, style de l'app, neuf champs d'éditeur à compléter avant mise en ligne. |
| Page introuvable | ✅ | [11-public.md](11-public.md) § 8 : une ligne, un bouton, anciennes adresses redirigées. |

## Admin

| Écran | État | Ce qui manque |
| --- | :---: | --- |
| Accueil admin | ✅ | [12-admin.md](12-admin.md) § 1 : trois voyants à règles écrites, « À faire » tiré des alertes existantes, les passes de la journée avec Relancer, aujourd'hui en chiffres, e-mail au passage au rouge. |
| Moteur | ✅ | [12-admin.md](12-admin.md) § 2 : produits (retirés compris, CLV, marge), canaux × compétition, marchés suspendus avec Réactiver ; fiche de diagnostic depuis Matchs ; outils et rapports dans le dépôt. |
| Joueurs | ✅ | [12-admin.md](12-admin.md) § 3 : quatre chiffres du mois, messages sans réponse, comptes avec pause visible et fiche, annonce comme action. |
| ⚙ Réglages (décidé le 29/10) | ✅ | [12-admin.md](12-admin.md) § 4 : cinq réglages, aucun secret, pris en compte à la prochaine passe, journal unique des actions humaines. |
| Supprimés | ✅ | Audit, Rapports, Documentation, Glossaire, Formation, ML, Performance, Matchs admin, Avis IA admin, Annonces (page), Suivi de mise : [12-admin.md](12-admin.md) § 0. |

## Ordre proposé

_Tout le contenu est écrit et validé au 29/10 au soir. Le style est choisi le même soir (« le tableau d'affichage », [13-style.md](13-style.md)) et testé sur Aujourd'hui ; il s'étend ensuite écran par écran._

1. **Finir le joueur** : Aujourd'hui en détail et ses états, puis Matchs, Vérifie ton ticket, Résultats, Moi et chacun de ses sous-écrans, puis les sujets transverses.
2. **Le public** : landing, inscription, connexion, pages légales.
3. **L'admin**.
4. **Le style**, testé sur Aujourd'hui puis étendu : direction « le tableau d'affichage » choisie le 29/10 ([13-style.md](13-style.md)), validé sur la maquette Aujourd'hui (bandeau sur chaque onglet, ambre seule couleur allumée, codes à trois lettres dans Hier) ; maquette complète de 37 écrans sur la toile Design (joueur avec ses états, public, admin sur téléphone et sur ordinateur ; liste dans 13 § 7) : https://claude.ai/artifact/1SWX3fFM9DmEAsagToX9hu. Implémentation : une seule branche `feat/refonte-ui`, PR 1 = public + joueur, PR 2 = admin, un commit par ligne de todo ([14-roadmap.md](14-roadmap.md), [15-todo.md](15-todo.md)).

## Décisions déjà prises (29/10)

- 4 onglets : Aujourd'hui · Matchs · Résultats · Moi.
- Pas de preuve sociale (« N joueurs suivent »).
- Ni bulle Eva, ni recherche globale, ni notes, ni guide pas à pas.
- Plus de solde, de dépôts, de retraits ni de mise par unité.
- Un seul geste sur un coupon : « Suivre » (renommé le 29/10, était « Je le suis »).
- Héros : le Favori, le Combiné en relais ; le fait par jambe toujours visible.
- Les coupons du jour sont composés la veille à 17 h UTC (IA à 20 h 30) : pas d'état « pas encore arrivés », seulement une panne.
- « Vérifie ton ticket » et « En francs » remplacent le solde.
- Le ticket vérifié ne montre ni mise ni gain ; il est réglé et montré une fois le lendemain ; 15 paris au plus.
- Moi : coupons déclarés et suivi de mise effacés à la mise en ligne ; suppression du compte dans Jeu responsable ; une seule conversation avec l'équipe.
- Public : landing = le héros du jour en vrai + `/resultats` public ; inscription à 3 champs sans nom d'utilisateur ; 2FA facultative ; vérification e-mail passable.
- Admin à l'essentiel : trois écrans (Accueil, Moteur, Joueurs) + Réglages ; Relancer à l'écran ; fiches d'Aide dans le code par PR ; e-mail d'exploitation au passage au rouge ; outils et rapports dans le dépôt.
- Résultats ne montre jamais de pourcentage ni de rejeu : des coupons publiés, datés et comptés.
- Le Coupon long 2,5–5 et le coupon prix 5–15 disparaissent ; un accumulateur de chasseurs (3 jambes 2,0–4,0 classées par coût du marché, cote 8–15, rien du moteur au-dessus de 1,80) les remplace, **vendu à la semaine** : « une semaine sur deux finit dans le vert ». Nom montré à choisir. Lot à planifier après la refonte.
- Au-dessus de la cote 1,80, la chance affichée est celle du marché sans marge, jamais celle du moteur ; aucun produit ne prend une jambe du moteur au-dessus de 1,80.
- Le Chasseur BTTS reste (même fréquence qu'un plus/moins, 3 points plus cher en argent) ; pas de produit du week-end.
- Filtres : aucune liste déroulante côté joueur, au plus une bascule visible par écran.
