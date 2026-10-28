# Mesures historiques : la page qui dit si les pourcentages tiennent

_Étape 3 du plan produit, branche `feat/produit-ux`, du 27/10/2026. Méthode : une revue de design par un sous-agent isolé, qui n'a vu que les captures « avant » et le code, sans connaître les corrections prévues. Les deux détecteurs (impeccable dans la page, détecteur maison) mesurent avant et après. Captures dans `captures/track-record-avant` et `captures/track-record-apres`, sorties brutes dans `scripts/tr-*.json`. Toutes les captures sont faites sur le faux backend (`E2E_ROLE=OPERATOR`) : les chiffres affichés sont fictifs._

La question du joueur sur cette page : **« puis-je croire les pourcentages ? »**

## Ce que la revue a trouvé

Score Nielsen de la revue : **18/40 (faible)**. Verdict : page générique de tableau de bord. L'en-tête « Annoncé / Réalisé », refait juste avant, était la seule partie écrite dans la langue du joueur. Tout le reste parlait celle du moteur.

| Constat                                                                                                                                                                                                             | Gravité |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Le tableau affichait un ratio « 0.84× » (lu comme une cote sur téléphone), « ROI », « n=390 », et un badge « Écart 15–30 % » : un écart relatif que le joueur lisait en points, et qui ne disait pas dans quel sens | P1      |
| Aucune lecture par tranche de cote, alors que c'est là que la calibration change : la moyenne de l'en-tête mélange des favoris à 80 % et des cotes longues à 30 %                                                   | P1      |
| « Classement ligues » lisait la table `bet`, morte depuis le 04/09 : il affichait « pas assez de matchs analysés » juste sous « 14 966 pronostics réglés »                                                          | P1      |
| La carte « Aujourd'hui » listait des matchs à suivre sur une page de mesures, et son badge annonçait « Écart ≤ 15 % » même quand un canal orange était actif                                                        | P1      |
| Un seul endpoint en échec faisait tomber toute la page (`Promise.all`, pas d'`error.tsx`)                                                                                                                           | P2      |
| Sur grand écran, l'en-tête se coupait en trois colonnes. L'intro parlait de « versions historiques », de « cohorte » et d'« avis IA modifiables »                                                                   | P2      |
| La somme des lignes du tableau ne retombait pas sur le total de l'en-tête : VALUE, SAFE et les avis IA figuraient dans l'un et pas dans l'autre                                                                     | P2      |

## Ce qui est fait

| Commit     | Correction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `27e33c08` | Backend : le résumé renvoie la même cohorte découpée à 1,45 et 1,80. Les stats par canal et par compétition exposent la probabilité moyenne annoncée.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `018763d1` | Backend : chaque tranche porte le même statut de calibration que les canaux.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `8535bb47` | Section **« Par cote »** sous l'en-tête, lue en fréquence (« sur 100 annoncés à 32 %, 26 sont passés »). Tableau en **Annoncé / Réalisé / Lecture / Réglés / À mise fixe**. Verdict en mots, avec son sens. Le résultat à mise fixe n'est plus triable. Le tableau est aligné sur la cohorte de l'en-tête, et les avis IA ont une ligne à part, hors total. La carte des ligues et la carte du jour sont retirées. Chaque bloc a son repli « Réessaie ». `error.tsx` ajouté. Squelette de chargement aligné. En-tête réparé. Textes au tutoiement. Nombres au format français. Onglets de période à 44 px. |
| `ecc05729` | Sur téléphone, des rangées séparées au lieu de cartes dans le panneau. Sélecteur à 44 px. Titre équilibré.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `018c4bdc` | Même étape, autre écran (P2-9 de l'audit du 23/10) : plus de classement des joueurs par ROI dans « Mes coupons » ni dans la coquille. Plus de badges de volume (« Vétéran », « Expert », « Maître ») ni de série (« En feu »). Les avatars qu'ils débloquaient deviennent libres.                                                                                                                                                                                                                                                                                                                          |

### Les mots du verdict

| Statut (inchangé côté backend) | Réalisé ÷ annoncé  | Affiché            |
| ------------------------------ | ------------------ | ------------------ |
| GREEN                          | 0,85 à 1,15        | Conforme           |
| ORANGE                         | 0,70 à 0,85        | Un peu optimiste   |
| ORANGE                         | 1,15 à 1,30        | Un peu prudent     |
| RED                            | sous 0,70          | Trop optimiste     |
| RED                            | au-dessus de 1,30  | Trop prudent       |
| INSUFFICIENT_DATA              | moins de 30 réglés | Pas assez de recul |

Le sens compte : un pourcentage trop optimiste fait perdre, un pourcentage trop prudent non.

### Ce que la section « Par cote » montre sur la vraie base

Copie de production du 24/10, 90 derniers jours, même cohorte que l'en-tête (avant coup d'envoi, dédupliquée, hors VALUE, SAFE et avis IA) :

| Tranche           | Réglés | Annoncé | Réalisé | À mise fixe |
| ----------------- | -----: | ------: | ------: | ----------: |
| Cote sous 1,45    | 11 360 |  76,0 % |  76,9 % |      −3,1 % |
| De 1,45 à 1,80    |  7 213 |  65,3 % |  59,4 % |      −4,9 % |
| De 1,80 et plus   | 28 597 |  31,7 % |  25,8 % |     −12,7 % |
| Sans cote relevée |  2 626 |       — |       — |           — |

Sous 1,45, l'annonce tient. Au-dessus de 1,80, elle est trop optimiste d'un cinquième (réalisé ÷ annoncé 0,81) : le joueur le lit désormais en clair. Les 2 626 pronostics sans cote comptent dans le total et dans aucune tranche, et la page l'écrit.

## Mesures avant → après

| Mesure (`/dashboard/track-record`)   | 375 sombre | 375 clair | 1280 sombre | 1280 clair |
| ------------------------------------ | ---------: | --------: | ----------: | ---------: |
| impeccable, éléments signalés        |     31 → 8 |    30 → 7 |     33 → 11 |    34 → 12 |
| Textes sous 12 px (détecteur maison) |     24 → 9 |    24 → 9 |      21 → 4 |     21 → 4 |
| Cibles sous 44 px                    |     10 → 7 |    10 → 7 |     19 → 16 |    19 → 16 |
| Mots interdits                       |      1 → 0 |     1 → 0 |       1 → 0 |      1 → 0 |

Ce qui reste appartient à la coquille, commune à toutes les pages : libellés de la barre du bas à 11 px, icônes d'en-tête à 36 px, avatar à 2,8:1, liens de la barre latérale à 36 px. Les libellés des cartes de chiffres sont à 11 px en capitales, le plancher retenu pour cette taille. Sur grand écran, les cartes de chiffres et le tableau posés dans le panneau de page comptent encore comme « cartes imbriquées » ; ce sera traité avec la passe sur la coquille.

## Score re-noté

Auto-évaluation après corrections, pas une revue indépendante : **18 → 29/40**.

| Heuristique            | Avant | Après | Ce qui manque encore                                                        |
| ---------------------- | ----: | ----: | --------------------------------------------------------------------------- |
| État du système        |     2 |     3 | Pas de date de dernier règlement                                            |
| Langage du joueur      |     1 |     3 | « Canal » reste un mot du moteur                                            |
| Contrôle               |     3 |     3 |                                                                             |
| Cohérence              |     1 |     3 |                                                                             |
| Prévention des erreurs |     2 |     3 |                                                                             |
| Reconnaître            |     2 |     3 | Pas d'explication au doigt sur chaque verdict, seulement la légende         |
| Souplesse              |     2 |     2 | Pas de filtre sur ce que le joueur a vu : Notre sélection, coupons, avis IA |
| Esthétique             |     2 |     3 |                                                                             |
| Récupération           |     1 |     3 |                                                                             |
| Aide                   |     2 |     3 |                                                                             |

## Restes, dans l'ordre

1. **Onglets de cohorte** « Notre sélection », « Jambes de coupon », « Avis IA » : il faut un endpoint par cohorte. Aujourd'hui la page mesure tous les canaux, ce qui n'est pas exactement ce que le joueur voit.
2. Date du dernier règlement à côté de la période.
3. La question de fond posée par la revue : le canal est-il un concept que le joueur doit apprendre, ou un détail interne à cacher derrière « Notre sélection » et « Coupons » ? À trancher avant de refaire Décisions.
4. Résultat à mise fixe traduit en F CFA pour une mise type.
