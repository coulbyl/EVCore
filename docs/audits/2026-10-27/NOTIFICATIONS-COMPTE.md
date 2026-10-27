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

## Questions ouvertes

1. **Quelles notifications le joueur doit-il recevoir ?** Proposition de la revue : le règlement de ses coupons déclarés, pertes comprises. Jamais « les coupons du jour sont publiés », qui pousserait à jouer.
2. **Pause et suppression en libre-service.** La pause doit-elle seulement couper les notifications, ou aussi masquer les coupons pendant N jours ? Pour l'instant, la carte « Jeu responsable » renvoie vers l'équipe pour supprimer le compte.
3. **Le consentement téléphone** parle de « prospection terrain ». Le texte n'est pas touché : en changer le sens après coup changerait ce à quoi les joueurs ont consenti.
4. Les 10 avatars sont chargés depuis `api.dicebear.com`. Les servir localement allégerait la page en 3G.
