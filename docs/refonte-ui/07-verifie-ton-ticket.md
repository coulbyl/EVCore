# Refonte UI — 7. « Vérifie ton ticket »

_29/10/2026. Suite de [02-les-4-onglets.md](02-les-4-onglets.md) § 2 bis et de [05-etude-cotes-courtes.md](05-etude-cotes-courtes.md) § 3 (c'est la porte d'entrée du produit). Proposition à corriger._

## 1. Ce que c'est

Le joueur arrive avec son combiné de 6 à 10 matchs. On ne lui dit pas de ne pas le jouer : on lui montre **ses chances**, et **ce que 1xBet garde**. Puis, à côté, ce qu'on propose nous. Pas de mise saisie, pas de « Joue », pas de lien vers un bookmaker. Le seul verbe est « Vérifie ».

Le ticket se compose depuis la fiche de match ([06](06-matchs.md) § 2) avec les [+], et depuis un coupon ouvert ([04](04-aujourdhui-en-detail.md) § 1, « Ajouter à mon ticket » n'y est pas : le coupon se suit, il ne se recompose pas).

## 2. La barre basse

Dès qu'un pari est ajouté, une barre apparaît au-dessus des onglets, sur Matchs et sur Aujourd'hui :

```
 ▲  Mon ticket   4 matchs · 12,4   environ 1 fois sur 9   ›
```

Trois chiffres : le nombre de matchs, la cote totale, la chance. Un toucher ouvre la feuille. La barre disparaît quand le ticket est vide.

## 3. La feuille

```
 ‹                                     Mon ticket
────────────────────────────────────────────────
 [ARS] Arsenal – Chelsea   Victoire Arsenal   1,65   ×
 [LYO] Lyon – Lens         Plus de 1,5 but    1,30   ×
 [PSG] PSG – Marseille     Victoire du PSG    1,45   ×
 [LAZ] Lazio – Torino      Match nul          3,40   ×
────────────────────────────────────────────────
 Cote totale                                 10,6
 Tes chances        ○ ○ ○ ○ ○ ○ ○ ○ ●    environ 1 fois sur 9
 Sur la durée, 1xBet garde 31 % de ta mise sur ce ticket
────────────────────────────────────────────────
 Notre Favori du jour                      8 sur 10  ›
────────────────────────────────────────────────
        [ Partager mes chances ]        Vider
```

**De haut en bas**

1. **Les paris**, dans l'ordre des coups d'envoi : logos, équipes, le pari nommé avec l'équipe, la cote 1xBet, une croix pour retirer. Pas de chance par pari : la chance est celle du ticket.
2. **La cote totale**, produit des cotes.
3. **Tes chances** : « environ 1 fois sur 9 », avec 9 points dont un plein. C'est le chiffre que le joueur n'a jamais vu.
4. **Ce que 1xBet garde**, une phrase : « Sur la durée, 1xBet garde 31 % de ta mise sur ce ticket ». Le mot « sur la durée » est obligatoire : sur un ticket, il gagne ou il perd tout.
5. **Notre coupon du jour**, une ligne, pour comparer : le héros d'Aujourd'hui et sa chance. Un toucher l'ouvre.
6. **Partager mes chances** (une image) et **Vider**.

**Budget** : un titre, aucun paragraphe, trois chiffres au premier niveau (cote, chance, ce que 1xBet garde).

## 4. Le calcul, une fois pour toutes

- **La chance** est le produit des fréquences du marché sans marge, pari par pari : `P = Π p_i`. Hypothèse d'indépendance, la même que celle des coupons, et la seule honnête sans modèle de corrélation.
- **La fréquence sans marge** vient de la grille de marché quand ML v2 sera là ; d'ici là, de la méthode de Shin sur le groupe d'issues 1xBet (jamais le retrait proportionnel : il gonfle les outsiders, −23 % mesuré).
- **Ce que 1xBet garde** : `1 − Π (p_i × o_i)`, en pourcentage de la mise. Exemple : huit paris à 1,50 dont la fréquence juste est 0,62 : `(0,93)^8 = 0,56`, 1xBet garde 44 %.
- **« Environ 1 fois sur N »** : `N = arrondi(1 / P)`. Jusqu'à 20, les points ; au-delà, le nombre seul, en grand : « environ 1 fois sur 46 ». À partir de 200 : « moins de 1 fois sur 200 ».
- **Deux paris du même match** ne se combinent pas : ils sont corrélés, et 1xBet les refuse aussi. Le second [+] sur un match déjà présent **remplace** le premier, avec une ligne : « Un seul pari par match ».
- **Un pari commencé** (coup d'envoi passé) sort du calcul et reste affiché en gris, « Commencé ». Le ticket se vide seul le lendemain.
- **Limite** : 15 paris. Au-delà, le [+] dit « 15 au plus ».

## 5. L'image partagée

Elle sert à WhatsApp, et c'est notre seule publicité. Format vertical, fond uni, logo EVCore discret :

- les paris (équipes, pari, cote), sans logos d'équipe si la licence ne le permet pas ;
- la cote totale ;
- **« environ 1 fois sur 9 »** en très grand, avec les points ;
- « Sur la durée, 1xBet garde 31 % » ;
- en bas, petit : « Notre Favori du jour : 8 sur 10 · evcore.app » et « 18+ · Parier comporte des risques de perte ».

Pas le gain potentiel, pas de mise. L'image dit une chose : combien de fois ce ticket passe.

## 6. Les états

| État | Ce qu'on montre |
| --- | --- |
| **Ticket vide** (feuille ouverte depuis Moi ou après Vider) | « Ajoute des paris depuis les matchs », et un lien vers Matchs. Pas de barre basse. |
| **Un seul pari** | La chance du pari seul (« 6 sur 10 »), ce que 1xBet garde (sa marge sur ce marché, « 1xBet garde 7 % »). Pas de « combiné » dans le texte. |
| **Deux paris du même match** | Le second remplace le premier, ligne « Un seul pari par match ». |
| **Pari non coté chez 1xBet** | Il n'a pas de [+] dans la fiche : il n'entre jamais. |
| **Pari dont la cote a changé** depuis l'ajout | La cote se met à jour à l'ouverture de la feuille ; si elle a bougé de plus de 5 %, une pastille « cote mise à jour » sur la ligne, une fois. |
| **Un pari commencé** | Gris, « Commencé », hors calcul. |
| **Ticket très long** (10 à 15) | Même feuille ; la chance passe en nombre seul, « moins de 1 fois sur 200 » au besoin. Pas de message moralisateur : le chiffre suffit. |
| **Le lendemain** | Le ticket d'hier s'affiche une fois, réglé : « Ton ticket d'hier : perdu · il fallait les 8 » ou « gagné · 1 fois sur 46, c'était celle-là ». Jamais « 5 sur 8 passés » : ça nourrit le presque. Puis il se vide. |
| **Hors ligne** | Le ticket reste (il est sur l'appareil) ; les cotes affichées sont celles du dernier chargement, la barre dit « cotes de 18:42 ». |
| **Pause active** | La barre disparaît et la feuille est fermée comme le reste ([04](04-aujourdhui-en-detail.md) § 5). Le ticket est conservé pour la fin de la pause. |

## 7. Ce qui reste du ticket déclaré et du solde

Rien. « Je l'ai joué » avec mise, les dépôts, les retraits et le suivi de mise disparaissent ([02](02-les-4-onglets.md) § 0). Le ticket vérifié n'est pas enregistré côté serveur comme un pari : il est sur l'appareil. On compte seulement, côté serveur et sans identifier le ticket, **qu'un ticket a été vérifié** (nombre de paris, cote totale, chance, jour) : c'est la mesure de [05](05-etude-cotes-courtes.md) § 4.

## 8. Ce qu'il faut construire

- **La feuille et la barre** (client), le ticket sur l'appareil, le vidage le lendemain et l'affichage du ticket d'hier réglé (il faut les résultats des matchs, déjà en base).
- **Le prix juste par pari** côté serveur : fréquence Shin sur le groupe 1xBet, exposée avec la cote dans la fiche de match (« Autres paris » et nos lectures). Avec ML v2, la grille.
- **Le règlement des paris du ticket** : les mêmes règles que les jambes de coupon, pour les trois marchés principaux et nos lectures.
- **L'image** : rendu côté client (canvas), partage natif.
- **Le compteur anonyme** de tickets vérifiés.

## 9. Tranché le 29/10

1. **Le gain** : ni mise ni gain, nulle part (feuille et image). Le ticket parle en chances et en part gardée par 1xBet.
2. **Le ticket d'hier** : réglé et montré une fois, « perdu · il fallait les 8 » ou « gagné · 1 fois sur 46 », puis vidé.
3. **La limite** : 15 paris, le [+] dit « 15 au plus ».
