# Refonte UI — 4. Aujourd'hui en détail

_29/10/2026. Suite de [02-les-4-onglets.md](02-les-4-onglets.md) § 1 et de [03-coupon-heros.md](03-coupon-heros.md). Proposition à corriger : le coupon ouvert, ses états dans le temps, puis les états de l'écran lui-même. Toujours en blocs, sans style._

## 1. Le coupon ouvert

Toucher le héros ou une ligne de produit ouvre **une feuille** par-dessus l'écran (pas une nouvelle page : on la referme d'un geste vers le bas, on retombe sur Aujourd'hui).

```
 ‹                                   Favori du jour
────────────────────────────────────────────────
 ● ● ● ● ● ● ● ● ○ ○    8 sur 10          1,28
────────────────────────────────────────────────
 [PSG]  PSG                       19:00
 [LEN]  Lens                      Ligue 1
        Victoire du PSG                    1,28
        PSG a gagné ses 9 derniers matchs à domicile
────────────────────────────────────────────────
 Forme sur 30 jours
 ✓ ✓ ✗ ✓ ✓ ✓ ✓ ✗ ✓ ✓ ✓ ✓ ✓ ✗ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓
 19 jours gagnés sur 24 · pire série 1
 1xBet garde 6 % sur ce pari
────────────────────────────────────────────────
                 [ Suivre ]
```

**De haut en bas**

1. **L'en-tête** : le nom du produit. Pas de date (c'est aujourd'hui), pas d'étiquette de source.
2. **La ligne de chance** : les 10 points, « 8 sur 10 », la cote totale 1xBet. Ce sont les trois chiffres du budget ; il n'y en a pas d'autre au premier niveau.
3. **Les jambes**, une par match, dans l'ordre des coups d'envoi :
   - logos et noms des deux équipes, l'un sous l'autre (comme sur un ticket) ;
   - l'heure et le championnat, en petit ;
   - le pari **nommé avec l'équipe** (« Victoire du PSG », « Plus de 1,5 but », « Les deux marquent ») et sa cote 1xBet ;
   - **un fait**, une ligne, toujours visible. C'est le seul texte de la feuille.
4. **La forme du produit** sur 30 jours, « 19 jours gagnés sur 24 », la pire série, et ce que 1xBet garde sur ce coupon. Tout est daté par la période affichée dans Résultats ; ici on ne répète pas la date.
5. **Le bouton** « Suivre », fixé en bas, toujours visible même quand on fait défiler.

**Ce qui n'y est pas** : la cote de référence, la clôture, la fréquence du marché contre la nôtre, la probabilité jointe, le relevé, l'identifiant. Tout cela vit dans Résultats (détail du produit) ou dans l'admin.

**Sur un combiné** (Combiné du jour, Coupon cote 2) : mêmes blocs, trois jambes au plus visibles sans défiler. La cote totale est celle du combiné ; chaque jambe garde la sienne.

**Sur un chasseur** : un seul match, comme le Favori, avec sa bande de cote en sous-titre du nom (« Chasseur Nul · 2,90 à 3,60 ») parce que c'est la seule chose qui le distingue.

### Le fait par jambe

Il remplace le paragraphe d'explication. Une phrase, un chiffre, une équipe, au présent : « Arsenal a marqué dans ses 12 derniers matchs à domicile », « Lazio et Torino : 4 nuls sur leurs 6 derniers », « Plus de 9 corners dans 7 des 8 derniers matchs de Brest à domicile ».

Règles :
- un seul fait par jambe, choisi par le pari (une victoire parle de victoires, un but parle de buts) ;
- toujours vrai sur les données du moteur à la génération, jamais rédigé par le LLM pour les coupons du moteur ;
- 60 caractères au plus ;
- s'il n'y a pas de fait solide, on n'écrit rien. Une jambe sans phrase vaut mieux qu'une phrase creuse.

À construire : aujourd'hui seul le combiné de l'IA a un texte (`llmReasonDetails`), et c'est un paragraphe. Les jambes du Favori, du Combiné, du Coupon cote 2 et des chasseurs n'ont que leur `featureSnapshot`. Le fait doit être calculé côté backend à la génération et stocké sur la jambe, pour qu'il ne change plus après coup.

## 2. Le coupon dans le temps

Un coupon vit cinq moments. Chacun change la feuille **et** la carte sur Aujourd'hui de la même manière.

| Moment | Ce qu'on voit sur la carte | Ce qui change dans la feuille |
| --- | --- | --- |
| **À venir** | L'heure du premier match. « Suivre ». | Rien de plus. |
| **En cours** (premier match commencé) | « En cours » à la place de l'heure. Le bouton disparaît. | Les jambes commencées portent « En cours », les autres leur heure. Pas de score en direct : on ne les a pas, on ne les invente pas. |
| **Gagné** | ✓ vert en grand à la place de la cote, cote à côté en petit. | Chaque jambe a sa pastille ✓ et son score. |
| **Perdu** | ✗ rouge en grand. | La ou les jambes perdues sont ✗, les autres ✓. On voit où ça a cassé. |
| **Remboursé** (match reporté ou annulé) | « Remboursé », en gris. | La jambe reportée dit « Reporté », les autres gardent leur pastille. |

**Le cas du gain partiel** : une jambe remboursée, les autres gagnées. La carte dit **✓** avec la cote réellement payée (« 1,32 au lieu de 1,45 ») ; la feuille montre la jambe remboursée en gris. C'est un gain, on ne le cache pas ; la cote réduite dit la vérité du paiement.

**Le soir même**, dès que le dernier match est réglé, la carte passe à ✓ ou ✗ sans attendre le matin. Le lendemain, elle quitte Aujourd'hui et devient un mot dans la ligne Hier.

**Un coupon ne disparaît jamais tant qu'il est en cours** : si on ouvre l'app à 23 h, le coupon du jour est encore là, avec ses pastilles acquises et ses matchs restants.

## 3. « Suivre »

- **Avant le premier coup d'envoi** : bouton plein, « Suivre ». Un toucher, pas de confirmation. Le bouton devient « Suivi ✓ », plus léger ; un second toucher retire le suivi, sans question.
- **Après le premier coup d'envoi** : plus de bouton. On ne suit pas un coupon déjà commencé. À vérifier côté serveur : aujourd'hui `follow` n'a pas cette règle, il faut l'ajouter.
- **Ce que ça donne** : le coupon apparaît dans Moi › Mes coupons suivis, et son résultat arrive dans le résumé du matin. Une ligne sous le bouton le dit, une seule fois, au premier suivi : « Tu recevras son résultat demain matin ».
- **Rien d'autre** : pas de mise, pas de montant, pas de lien vers 1xBet.

## 4. La ligne Hier

En haut d'Aujourd'hui, une ligne, toujours là :

- **Jour normal** : `Hier   Favori ✓ · Combiné ✓ · Cote 2 ✗`. Un mot par produit qui a joué, dans l'ordre de l'écran. Les chasseurs sont inclus s'ils ont joué.
- **Un produit absent hier** : il n'apparaît pas. On ne dit pas « — » ; l'absence est l'absence.
- **Rien hier** (aucun coupon) : la ligne disparaît. Pas de « Aucun coupon hier ».
- **Si j'ai suivi un coupon hier** : son résultat vient en premier, en gras : `Hier   Ton Favori ✓ · Combiné ✓ · Cote 2 ✗`.
- **Le lundi** : `Ta semaine   Favori 5/6 · Combiné 4/6 · Cote 2 2/5`. Jours gagnés sur jours joués, du lundi au dimanche. Le mardi, retour à Hier.
- **Au toucher** : Résultats, déjà posé sur la bonne période.

Encore en cours à l'heure où on regarde (un match d'hier soir pas réglé) : le produit porte « … » à la place de ✓ ou ✗.

## 5. Les états de l'écran

### Jour normal

Le bloc du § 6 de [01](01-ce-qu-on-montre.md) : Hier, le héros, les autres produits, les absents en gris, mes coupons en cours.

### Le héros s'abstient

Le Combiné prend la place du héros, avec les mêmes blocs. Le Favori descend dans la liste des absents, en gris : « Pas de Favori aujourd'hui · aucun favori à domicile entre 1,20 et 1,35 ». La raison est celle du moteur, avec les mots déjà en place (`couponAbstentions`). Rien ne signale le remplacement : pour le joueur, le coupon du jour est le Combiné.

Si le Combiné s'abstient aussi, le relais continue dans l'ordre de la liste : Coupon cote 2, puis le premier chasseur présent. On ne monte jamais un coupon IA en héros tant que le § 3 du [03](03-coupon-heros.md) n'est pas revu.

### Jour sans aucun coupon

```
 Hier   Favori ✓ · Combiné ✗
────────────────────────────────────────────────
 Rien à jouer aujourd'hui
 Pas de Favori · aucun favori à domicile entre 1,20 et 1,35
 Pas de Combiné · pas assez de paris fiables à cote courte
 Pas de Coupon cote 2 · aucune combinaison entre 2 et 3
────────────────────────────────────────────────
 Voir les matchs du jour  ›
```

S'abstenir est un résultat : chaque produit dit pourquoi, sans texte d'excuse. Le lien mène à Matchs. La ligne Hier reste.

### Les coupons ne sont pas là alors qu'ils devraient

Les coupons du jour J sont composés **la veille à 17 h UTC** (passe d'aperçu J+1, cotes relevées juste avant), et le combiné de l'IA à **20 h 30 UTC** sur le même vivier ; la passe d'analyse de 21 h recompose mais ne remplace jamais une proposition existante (mesuré sur la prod du 29/10, `docs/audits/2026-10-29/ENV-PROD.md`). Quand le joueur se réveille, ils existent déjà, et même la veille au soir : il n'y a pas d'état « pas encore arrivés » en fonctionnement normal. S'ils manquent, c'est une panne (générateur, cotes 1xBet absentes). L'écran montre alors Hier et une ligne : « Pas de coupon pour l'instant · réessaie plus tard ». Jamais une heure, jamais un compte à rebours, et l'admin reçoit l'alerte.

### Chargement

La forme du héros en gris clair (deux lignes et un rond), une seconde au plus. Si ça dure, on garde le squelette ; on n'affiche jamais une roue au centre d'un écran vide.

### Hors ligne

Le dernier contenu vu reste affiché tel quel, avec une ligne en haut : « Hors ligne · vu à 18:42 ». « Suivre » est grisé. Dès le retour du réseau, la ligne disparaît et l'écran se met à jour seul. Il faut pour cela garder la dernière réponse d'Aujourd'hui sur l'appareil : à construire.

### Erreur du serveur

Même traitement que hors ligne, avec « On n'arrive pas à charger · réessayer ». Jamais de code, jamais de message technique.

### Pause active

L'onglet ne montre ni coupon ni ligne Hier :

```
 En pause jusqu'au 12 novembre
 Tu as choisi cette pause. Elle ne se raccourcit pas.
────────────────────────────────────────────────
 Résultats  ›
```

Le serveur refuse déjà les coupons pendant la pause (`PausedGuard`). Matchs est fermé de la même manière ; Résultats et Moi restent ouverts. Pas de bouton pour reprendre plus tôt : la pause ne peut qu'être prolongée (Moi › Jeu responsable).

### Le résultat tombe pendant qu'on regarde

La carte change d'état sans recharger la page, dès que le règlement arrive (à la cadence actuelle du règlement, pas en direct). Pas d'animation de victoire, pas de son, pas de confetti. Le ✓ ou le ✗ apparaît, c'est tout.

### Match reporté avant le coup d'envoi

La jambe passe en gris « Reporté » dans la feuille et sur la carte le nombre de matchs se corrige (« 2 matchs » au lieu de 3) avec la cote recalculée. Le coupon reste jouable sur les jambes restantes ; s'il n'en reste qu'une sur un combiné, le produit l'assume comme un simple.

### Première ouverture du jour après un gain suivi

Rien de spécial sur l'écran : la ligne Hier le dit en gras (§ 4), le résumé du matin l'a déjà annoncé. On ne construit pas de « moment de célébration » (principe 5).

## 6. Ce qui reste à construire pour cet écran

- Le **fait par jambe**, calculé et stocké à la génération (§ 1).
- Le **relais du héros** quand le Favori s'abstient (§ 5), une règle serveur, pas un choix côté écran.
- Le **refus de suivre** après le premier coup d'envoi (§ 3).
- La **cote recalculée** et le nombre de matchs sur reporté avant le coup d'envoi (§ 5).
- Le **cache hors ligne** de la réponse d'Aujourd'hui (§ 5).
- La **ligne Hier** avec « Ton Favori » quand le coupon a été suivi, et « Ta semaine » le lundi (§ 4).

## 7. Tranché le 29/10

1. **Le héros** : Favori, Combiné en relais. Validé, avec une réserve : les cotes courtes accrochent-elles ? Étude dans [05-etude-cotes-courtes.md](05-etude-cotes-courtes.md).
2. **L'heure d'arrivée des coupons** : fausse question, les coupons sont composés la veille à 17 h UTC, le combiné IA à 20 h 30 (§ 5).
3. **Le fait par jambe** : toujours visible.
4. **Le bouton** s'appelle « Suivre », pas « Je le suis ».
