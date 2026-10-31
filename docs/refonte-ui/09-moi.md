# Refonte UI — 9. Moi et ses sous-écrans

_29/10/2026. Suite de [02-les-4-onglets.md](02-les-4-onglets.md) § 4. Proposition à corriger. L'onglet Moi remplace Mes coupons, Suivi de mise, Inbox, Notifications, Compte (5 onglets), Formation et Glossaire. Le suivi de mise disparaît avec le solde ([02](02-les-4-onglets.md) § 0)._

## 0. La question à laquelle il répond

« Et moi, où j'en suis ? » Moi est le seul onglet qui parle du joueur et non des produits : ses coupons suivis, ses messages, ses réglages. Tout le reste de l'application dit « nous » ; ici on dit « toi ».

## 1. L'onglet

```
 EVCore                                🔔  (K)
────────────────────────────────────────────────
 Kouassi
 7 coupons gagnés · 4 perdus            depuis le 13/10
────────────────────────────────────────────────
 ● En cours   Réglés
 Favori du jour        19:00   PSG – Lens · 1,28         ›
 Combiné du jour       20:45   3 matchs · 1,41           ›
────────────────────────────────────────────────
 Messages                                  1 réponse  ›
 Aide                                                 ›
 Jeu responsable                                      ›
 Compte                                               ›
────────────────────────────────────────────────
                                   Se déconnecter
────────────────────────────────────────────────
  Aujourd'hui    Matchs    Résultats    Moi
```

**Premier niveau, de haut en bas**

1. **Le prénom** et **mon bilan** : « 7 coupons gagnés · 4 perdus », la date du premier suivi en petit. Un remboursé n'est ni l'un ni l'autre, il n'apparaît que s'il y en a : « · 1 remboursé ». Rien en francs ici : les coupons suivis n'ont pas de mise. Sans aucun suivi : « Suis ton premier coupon », qui mène à Aujourd'hui.
2. **Mes coupons suivis**, une bascule En cours · Réglés, la seule de l'écran. Chaque ligne : le produit, l'heure du premier match (ou la pastille ✓ ✗ et la cote payée une fois réglé), les matchs ou le match, la cote. Un toucher ouvre le coupon, la feuille de [04](04-aujourdhui-en-detail.md) § 1 ; sur un coupon réglé, la feuille réglée de [04](04-aujourdhui-en-detail.md) § 2. Réglés : les 30 derniers, puis « Voir plus ».
3. **Quatre lignes** : Messages (avec « 1 réponse » quand l'équipe a répondu et qu'on ne l'a pas lue), Aide, Jeu responsable, Compte.
4. **Se déconnecter**, en bas, en léger.

**Ce qui sort** : le solde, les dépôts, les retraits, la mise par unité, « Déclarer un dépôt », les badges (Diplômé, Calibré, Patience, jamais attribués ou presque), le classement, la personnalisation. Les coupons déclarés à la main avec une mise ([02](02-les-4-onglets.md) § 0) : **effacés à la mise en ligne** (tranché le 29/10), avec les dépôts et retraits ; on n'en crée plus, rien n'en reste à l'écran.

**Budget** : aucun titre, aucun paragraphe, un chiffre par ligne.

## 2. Messages

C'est l'Inbox actuelle, gardée telle quelle dans son principe : une conversation avec l'équipe, du texte, une photo, un message vocal, et une réponse « généralement en quelques heures ».

```
 ‹                                        Messages
────────────────────────────────────────────────
 Équipe EVCore                           hier 18:42
   Merci, on a corrigé la cote du Combiné d'hier.
 (toi)                                   hier 17:10
   Le combiné affichait 1,41 mais 1xBet…      [photo]
────────────────────────────────────────────────
 [ 📎 ]  Écris à l'équipe…                  [ 🎤 ]
```

- **Une seule conversation**, pas de liste de conversations. Le joueur n'a qu'un interlocuteur, l'équipe. Un message « nouvelle question » repart dans le même fil. (Aujourd'hui : une liste avec « Nouvelle conversation » ; à fusionner.)
- **La réponse automatique** à l'ouverture d'un fil (« on répond généralement en quelques heures ») reste, une fois par fil, en gris.
- **Lu / pas lu** : la ligne « 1 réponse » sur Moi et la cloche portent le même compte ; ouvrir le fil marque tout lu.
- **Ce qui sort** : la bannière d'activation des notifications poussées en haut du fil (elle va dans Compte › Notifications), les pièces jointes limitées à ce que le téléphone sait partager.

## 3. Aide

Formation et Glossaire deviennent **un index de fiches courtes**, sans vidéo, sans badge, sans parcours. Les 5 fiches d'une minute livrées le 27/10 restent le socle ; on y ajoute une fiche par mot que l'application emploie.

```
 ‹                                             Aide
────────────────────────────────────────────────
 Comment lire un coupon                               ›
 « 8 sur 10 », ça veut dire quoi                      ›
 Pourquoi on s'abstient certains jours                ›
 Suivre un coupon                                     ›
 Vérifie ton ticket                                   ›
 Le Favori, le Combiné, le Cote 2, les chasseurs      ›
 Nos résultats : comment on les compte                ›
 Jeu responsable                                      ›
────────────────────────────────────────────────
 Une question ? Écris-nous                            ›
```

- **Une fiche = un écran**, 150 mots au plus, un exemple chiffré, pas de lien sortant sauf vers l'écran concerné. Les anciennes adresses de Formation redirigent.
- **Le « ? » contextuel** : à côté d'un mot nouveau ailleurs dans l'application (« 8 sur 10 », « jusqu'à 3 semaines sans gain »), un toucher ouvre la fiche directement, par-dessus l'écran, et la referme d'un geste. C'est l'explication « au doigt » déjà en place (TapHint), ramenée à une seule source.
- **Le glossaire** disparaît comme page : chaque terme devient soit une fiche, soit une ligne dans une fiche. Un mot qui n'a pas sa place dans une fiche n'a pas sa place à l'écran.
- La dernière ligne mène à Messages.

## 4. Jeu responsable

Une page courte, la seule de Moi qui a une phrase d'intro.

```
 ‹                                   Jeu responsable
────────────────────────────────────────────────
 Parier doit rester un jeu. Si ce n'est plus le cas,
 fais une pause : l'application se ferme le temps choisi,
 sans retour anticipé.
────────────────────────────────────────────────
 [ 24 heures ]   [ 7 jours ]   [ 30 jours ]
────────────────────────────────────────────────
 Besoin d'aide ?  SOS Joueurs · 09 74 75 13 13 (France)
 Les numéros par pays dans la page Jeu responsable      ›
────────────────────────────────────────────────
 Supprimer mon compte                                  ›
```

- **La pause** : trois durées, une confirmation en une ligne (« L'application sera fermée jusqu'au 5/11 à 19:00. Tu ne pourras pas revenir avant. »), prolongeable, jamais écourtée. C'est la règle livrée le 28/10, inchangée.
- **Pendant la pause** : Aujourd'hui, Matchs et Vérifie ton ticket sont fermés avec la date de retour ; Résultats et Moi restent ouverts ; aucune notification poussée ni matinée ; les coupons suivis se règlent quand même et attendent dans Réglés.
- **Les numéros d'aide** par pays vivent sur la page publique Jeu responsable ; ici une ligne et un lien.
- **Supprimer mon compte** : ici, pas dans Compte, parce que c'est un acte de jeu responsable avant d'être un réglage. Mot de passe, immédiat, sans délai de grâce, comme livré le 28/10. La confirmation dit ce qui part : « Tes coupons suivis, tes messages et ton compte seront supprimés tout de suite. »

## 5. Compte

Cinq onglets aujourd'hui (profil, sécurité, préférences, notifications, devise et mise) ; une seule page demain, en sections, sans onglet.

```
 ‹                                          Compte
────────────────────────────────────────────────
 Kouassi                                    modifier
 kouassi@…   · e-mail vérifié
 +225 07 …                                  modifier
────────────────────────────────────────────────
 Mot de passe                                    ›
 Double authentification               activée  ›
 Appareils connectés                        2   ›
────────────────────────────────────────────────
 Notifications
 Ma matinée (8 h)                    ● activée
 Ma semaine (lundi 8 h)              ● activée
 Résultat de mes coupons suivis      ● activé
 Réponses de l'équipe                ● activées
 Par e-mail aussi                    ○
────────────────────────────────────────────────
 Affichage
 Thème        Système · Clair · Sombre
 Langue       Français · English
 Devise       F CFA
```

- **Profil** : prénom, e-mail (changement par lien de vérification, comme aujourd'hui), téléphone. Pas d'avatar à téléverser : l'initiale suffit.
- **Sécurité** : mot de passe, double authentification (déjà en place), appareils connectés avec « Déconnecter les autres ».
- **Notifications** : quatre interrupteurs, tous activés par défaut (règle du lot 4), plus « Par e-mail aussi ». Les textes des notifications sont écrits dans [10-transverse.md](10-transverse.md). Ici on ne règle pas le contenu, seulement l'envoi.
- **Affichage** : thème, langue, devise. **La devise reste** (F CFA par défaut, parce que « En francs » s'affiche dans la devise du joueur) ; **la mise par unité disparaît** avec le suivi de mise.
- **Ce qui sort** : « Devise et mise », les badges, la personnalisation, l'assistant d'accueil, la suppression (déplacée dans Jeu responsable).

## 6. La cloche

Elle est dans l'en-tête de chaque onglet, pas dans Moi, mais elle mène au même monde : la liste des notifications, sans onglet, les plus récentes d'abord.

```
 ‹                                   Notifications
────────────────────────────────────────────────
 aujourd'hui 08:00   Ta matinée EVCore
   Favori ✓ 1,24 · Combiné ✗. Aujourd'hui : Favori 1,28 ·
   Combiné 1,41 · Cote 2 2,30.                            ›
 lundi 08:00         Ta semaine EVCore
   5 jours gagnés sur 6 avec le Favori. …                 ›
 28/10 18:42         L'équipe t'a répondu                 ›
 27/10 09:10         Nouveau : le Chasseur Corners        ›
```

- **Quatre sortes** et pas plus : la matinée, la semaine, une réponse de l'équipe, une annonce. Chaque ligne mène quelque part : Aujourd'hui, Résultats (Ta semaine), Messages, ou l'annonce.
- **Pas d'onglets** Toutes / Non lues / Annonces / Alertes : la liste est courte (une à deux lignes par jour), l'onglet ne sert plus. Le badge de la cloche compte les non-lues ; ouvrir la liste ne marque rien, toucher une ligne la marque.
- **Les alertes d'exploitation** (ROI, suspension, ETL, ML) ne sont jamais envoyées au joueur ; elles vivent dans l'admin.
- **Une annonce importante** peut aussi s'afficher une fois en haut d'Aujourd'hui, refermable ([02](02-les-4-onglets.md) § 1).

## 7. Les états

| État | Ce qu'on montre |
| --- | --- |
| **Aucun coupon suivi** | « Suis ton premier coupon · Aujourd'hui › » à la place de la liste ; bilan absent. |
| **Coupon suivi en cours, match commencé** | La ligne dit « En cours » ; la feuille montre les jambes commencées. |
| **Coupon suivi réglé ce soir** | Il passe dans Réglés dès le dernier match, avec sa pastille ; le bilan se met à jour sans attendre le matin. |
| **Coupon suivi remboursé** | « Remboursé », en gris, hors bilan gagné/perdu, compté à part. |
| **Messages, aucune réponse encore** | Le fil avec la réponse automatique en gris ; pas de compteur. |
| **Pause active** | Moi reste ouvert ; Jeu responsable affiche la date de retour et « Prolonger » ; Mes coupons suivis se lisent. |
| **E-mail non vérifié** | Une ligne sous l'e-mail, « Vérifie ton e-mail › », et les notifications par e-mail grisées. |
| **Chargement, hors ligne, erreur** | Mêmes règles que [04](04-aujourdhui-en-detail.md) § 5 ; hors ligne, les coupons suivis vus en dernier restent lisibles. |

## 8. Ce qu'il faut construire

- **Le bilan des coupons suivis** : gagnés, perdus, remboursés, depuis le premier suivi, côté serveur (aujourd'hui `/bet-slips/summary` compte les coupons déclarés avec mise ; il faut le même sur `coupon_follow`).
- **Refuser le suivi après le premier coup d'envoi** ([04](04-aujourdhui-en-detail.md) § 3).
- **Une seule conversation** par joueur dans Messages (fusion des fils existants).
- **Les fiches d'Aide** : réécrire les 5 fiches aux titres ci-dessus, en ajouter 4, rediriger Formation et Glossaire, brancher le « ? » contextuel sur l'index.
- **La page Compte sans onglets** et le déplacement de la suppression vers Jeu responsable.
- **La cloche sans onglets**, et le retrait des types d'exploitation de la liste joueur.
- **Les coupons déclarés et le suivi de mise** : suppression des données (coupons déclarés, dépôts, retraits, mise par unité) par migration à la mise en ligne, et du code qui les sert.

## 9. Tranché le 29/10

1. **Les anciens coupons déclarés avec mise** : effacés pour tout le monde à la mise en ligne, avec le suivi de mise.
2. **La suppression du compte** : dans Jeu responsable.
3. **Messages** : une seule conversation par joueur.
