# Notifications et Compte : des états qui ne mentent plus, et rien d'inerte

_Suite du plan produit, branche `feat/produit-ux`, du 27/10/2026. Revue isolée : **Notifications 20/40, Compte 19/40**. Captures dans `captures/pages-restantes-avant` et `captures/notifications-compte-apres`, sorties des détecteurs dans `scripts/pr-avant-*` et `scripts/pr-apres-*` (`notifications`, `params-account-profil`)._

## Ce que la revue a trouvé

- **Notifications.** Un centre de notifications générique, hérité des alertes d'ingénierie.
  - 285 messages de l'abonnement retiré le 03/09 s'affichaient encore (« Abonnement — VALUE (Valeur) »), dont 48 non lus dans la cloche.
  - Une réponse du support restait non lue pour toujours (115 sur 119 en base) et comptait deux fois : une dans la cloche, une dans l'Inbox.
  - Une annonce avait deux états « lu » indépendants, et son texte n'était pas affiché.
  - Un échec de chargement affichait « Tout est à jour ».
  - Le joueur voyait un onglet « Annonces » qui doublait « Toutes ».
- **Compte.** Un profil de réseau social, avec trois réglages qui ne pilotaient rien.
  - Le profil de risque promettait d'« orienter le mélange des coupons », et « Offensif » invitait à prendre plus de risque.
  - « Types de pari suivis » et « Ligues suivies » n'étaient lus nulle part.
  - Aucun accès au jeu responsable depuis le tableau de bord.
  - L'adresse e-mail se changeait en ligne, sans mot de passe, et la vérification sautait sans prévenir.
  - Le crayon d'édition était invisible au toucher.
  - Le badge « Opérateur » se lit « bookmaker » chez un parieur.

## Ce qui est fait

| Commit     | Changement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `5b4017ee` | **Backend.** Les messages de l'abonnement retiré ne sont plus servis ni comptés. Une annonce n'a qu'un seul état « lu » : la lire dans la cloche la marque lue dans Annonces, et inversement. Ouvrir la conversation marque lues les réponses du support. Purge SQL fournie.                                                                                                                                                                                                                                                                                                                                                                  |
| `35c87f58` | **Notifications** : un titre, une phrase sur ce que l'app envoie, un vrai état d'erreur avec « Réessayer », un aperçu de l'annonce et un lien direct vers elle, « Ouvrir la conversation » pour une réponse du support. Plus de gravité ni d'onglet vide pour le joueur. Une notification lue reste lisible. Tout est à 44 px. **Compte** : carte « Jeu responsable » en tête, retrait de Personnalisation et de l'assistant d'accueil (le guide démarre dès la première visite), adresse e-mail non modifiable en ligne, crayon visible, échec d'avatar signalé, rôle réservé aux admins, « Mon compte », « Affichage », « Devise et mise ». |

| `impeccable`, éléments signalés | 375 sombre | 375 clair | 1280 sombre | 1280 clair |
| ------------------------------- | ---------: | --------: | ----------: | ---------: |
| Notifications                   |     12 → 2 |    13 → 1 |      11 → 2 |     14 → 3 |
| Compte (profil)                 |      6 → 6 |     5 → 5 |       8 → 6 |     10 → 8 |

| Détecteur maison    | Notifications 375 | Notifications 1280 | Compte 375 | Compte 1280 |
| ------------------- | ----------------: | -----------------: | ---------: | ----------: |
| Textes sous 12 px   |             5 → 0 |              8 → 3 |      7 → 0 |      13 → 3 |
| Cibles sous 44 px   |             8 → 0 |            20 → 12 |     14 → 0 |     31 → 17 |
| Titres (`h1`, `h2`) |             0 → 3 |              0 → 3 |      2 → 4 |       2 → 4 |

Ce qui reste :

- **Sur grand écran**, tout vient de la barre latérale : liens de 36 px à la souris, intitulés de groupe à 11 px.
- **Sur Compte**, `impeccable` signale :
  - le halo du bouton flottant et un dégradé de la coque, présents sur toutes les pages ;
  - des cartes posées dans le panneau de page ;
  - une hiérarchie de titres resserrée (16 et 18 px).

  Le bandeau dégradé du profil est retiré.

## Tests

`notifications-account.spec.ts`, sur téléphone et ordinateur, en rôle joueur :

- l'aperçu d'une annonce et son lien vers `/dashboard/updates?id=…` ;
- ni gravité ni onglet « Annonces » ;
- « Jeu responsable » en tête du profil, sans « Offensif » ni « Opérateur » ;
- l'ancien onglet Personnalisation mène au profil.

La passe joueur complète (Coupons, Décisions, Avis IA, Formation, fiche de match, Mes coupons, Suivi de mise, Notifications, Compte) est verte : 57 tests.

## À faire côté utilisateur

**Purger les messages de l'abonnement retiré**, quand tu veux. Ils ne s'affichent déjà plus. Rejouée à blanc sur la copie de prod, la purge retire 285 lignes :

```bash
docker exec -i evcore-postgres psql -U postgres -d evcore < docs/audits/2026-10-27/sql/purge-subscription-notifications.sql
```

## Décisions prises sans attendre, réversibles

1. **Personnalisation et l'assistant d'accueil sont retirés côté joueur.** Les colonnes en base et les endpoints backend restent. Pour les rebrancher, il faudrait livrer ce qu'ils promettaient :
   - des ligues suivies qui filtrent Décisions ;
   - pour chaque type de pari suivi, « du … au …, sur N réglées : X % réalisées pour Y % annoncées ».
2. **L'adresse e-mail ne se change plus en ligne.** Le bon parcours demande du travail backend : mot de passe, puis code envoyé à la nouvelle adresse avant de basculer. En attendant, le joueur écrit à l'équipe.

## Suite du 28/10 : suppression, pause et résumé du matin

Les trois questions ouvertes ont été tranchées par l'utilisateur le 28/10, sur recommandation. Elles sont livrées dans cet ordre, parce que la pause doit pouvoir couper les notifications.

| Commit                 | Changement                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `799efb21`, `cfac64b0` | **Suppression du compte en libre-service.** Mot de passe demandé, effet immédiat, pas de délai de grâce. Tout part en cascade, plus les paris propres au joueur et ses pièces jointes de support. Les comptes admin sont refusés. Rejouée à blanc sur la copie de prod, la suppression d'un joueur ne laisse rien. CGU, Confidentialité et Jeu responsable sont mises à jour.                                                                |
| `969bc5ed`, `9c5480ea` | **Pause de 24 heures, 7 jours ou 30 jours**, sans retour anticipé : elle ne peut que se prolonger. Pendant la pause, le serveur refuse ce qui propose un pari (coupons, Décisions, Avis IA, fiche de match, saisie de coupon, export d'analyse). Les annonces ne sont plus poussées. L'écran remplace ces pages par l'annonce de la pause. L'historique reste ouvert. La boîte de suppression propose la pause une fois.                     |
| `8f475c8f`, `a2ac2239` | **Résumé du matin**, à 8 h UTC : « Tes coupons d'hier — 2 coupons réglés : 1 gagné, 1 perdu. Misé 2 000 F, rendu 1 540 F : -460 F. » Un par joueur et par jour, dans l'app et en push vers ses appareils, avec un lien vers Mes coupons. Une perte s'écrit comme un gain, sans appel à rejouer. Jamais pendant une pause, et jamais deux fois le même jour. Sur la copie de prod, 10 joueurs ont déjà déclaré un coupon, au plus 2 par jour. |

**Deux migrations à lancer en prod avant de déployer le backend** :

- `20261028120000_add_user_paused_until` ;
- `20261028130000_add_slips_settled_digest_notification`.

Elles sont appliquées sur la copie locale.

## Questions encore ouvertes

1. **Le consentement téléphone** parle de « prospection terrain ». Le texte n'est pas touché : en changer le sens après coup changerait ce à quoi les joueurs ont consenti.
2. Les 10 avatars sont chargés depuis `api.dicebear.com`. Les servir localement allégerait la page en 3G.
