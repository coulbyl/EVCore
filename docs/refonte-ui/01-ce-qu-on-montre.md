# Refonte UI — 1. Ce qu'on montre, avant comment

_29/10/2026. On ne parle pas encore de couleurs ni de polices. On décide ce qui mérite d'être à l'écran, pour qui, et pourquoi ça attire. Le style viendra ensuite, au service de cette hiérarchie._

## 1. Ce que le joueur vient chercher

Koffi, 29 ans, à Abidjan, sur un Android d'entrée de gamme. Il ouvre l'app debout, entre deux choses, avant les matchs du soir puis le lendemain matin. Il ne lit pas : il regarde.

Il vient avec **trois questions**, et il veut la réponse en dix secondes :

1. **Qu'est-ce que je joue aujourd'hui ?**
2. **Hier, ça a donné quoi ?** Pour lui, et pour vous.
3. **Est-ce que je peux vous croire ?**

Tout ce qui ne répond pas à l'une des trois passe au second niveau, derrière un toucher.

## 2. Ce qu'on montre aujourd'hui

- **9 entrées de menu** côté joueur, plus 5 boutons dans l'en-tête (solde, recherche, cloche, notes, avatar), une barre basse de 5 onglets et une bulle Eva.
- **7 blocs sur l'Accueil** : annonces, coupons du jour, notre sélection, hier, mes coupons, point de la semaine, mention de risque.
- **Une quinzaine d'informations par coupon** :
  - pour le coupon : classe, source (« Choisi sur les cotes », « Analyse IA »), résultat, historique en phrase, pire série, cote, référence, chances, marge 1xBet, relevé ;
  - pour chaque jambe : équipes, heure, ligue, pays, score, cote, pari, type de pari, fréquence, « 1xBet prend X % », résultat.
- **Des cartes dans des cartes**, des étiquettes en capitales espacées, des phrases d'explication partout.

**Verdict** : on montre ce que le moteur sait, pas ce dont le joueur a besoin. Chaque chiffre est vrai et utile à quelqu'un, mais ils sont tous au même niveau. Résultat : le joueur ne voit rien.

## 3. Ce qui attire vraiment, et ce qu'on en fait

| Ce qu'on sait du cerveau | Donc, à l'écran |
| --- | --- |
| On lit les **visages, couleurs, logos et chiffres** avant les mots. Un texte n'est lu que si l'image a accroché. | Les **logos des équipes**, la **cote** et une pastille sont les seules « images ». Le texte vient en dernier recours. |
| Une **fréquence naturelle** (« 8 sur 10 ») se comprend sans calcul, contrairement à « 78,6 % » (Gigerenzer). Dix points dont huit pleins se comprennent sans lire. | La chance s'affiche « **8 sur 10** » avec **10 points**. Le pourcentage disparaît du premier niveau. |
| **La forme** (V V N D V) est un langage que tout fan de foot lit d'instinct. | Chaque produit a **sa forme** : ses 10 derniers jours en pastilles vertes et rouges. Les pertes sont montrées sans un mot, et c'est notre preuve. |
| **Effet de franchise** : celui qui montre ses erreurs paraît plus crédible que celui qui ne gagne jamais. | Le rouge des jours perdus est aussi visible que le vert, toujours au premier niveau. |
| **Psychanalyse** : le pronostiqueur Telegram se pose en « sujet supposé savoir ». Le joueur lui confie son désir de certitude, et la déception est programmée. | EVCore **refuse la place de l'oracle**. Il montre son travail et ses ratés, et la confiance passe de la croyance à la preuve. C'est le cœur de la marque, et ça se voit en une ligne de pastilles. |
| **Loi de Hick** : plus il y a de choix, plus on hésite et moins on agit. | **Un coupon héros par jour**, les autres en dessous, plus petits. |
| **Le ticket** est un objet aimé : on le garde, on le montre, on attend le résultat. | Le coupon ressemble à **un ticket net** : équipes, pari, cote, une action (« Suivre »). Pas à un rapport. |
| Le plaisir est dans **l'attente du résultat** autant que dans le gain. | On soigne **le moment du résultat** : le matin, « Hier ✓ » ou « ✗ » en grand. Jamais de compte à rebours ni de série récompensée (principe 5). |
| On veut se sentir **compétent**, pas assisté. | Un seul fait par sélection, au toucher (« Arsenal a marqué dans ses 12 derniers matchs à domicile »), pas un paragraphe. |

**La tension à assumer** : ce qui attire le plus (le gros gain, la certitude, l'urgence, la foule) est en partie ce que nos principes interdisent. On garde l'attraction du visuel, de la forme et du ticket, et on refuse le reste. Une seule zone grise reste à trancher : la preuve sociale réelle, par exemple « 312 joueurs suivent ce coupon ». C'est vrai et mesuré (`coupon_follow`), mais ça peut pousser à suivre.

## 4. Garder, cacher, fusionner, supprimer

**Premier niveau (visible sans toucher)**

- Le coupon du jour : équipes et logos, le pari, la cote 1xBet, « 8 sur 10 » avec ses points, la forme du produit.
- Les autres produits du jour, en lignes compactes.
- Hier : ✓ ou ✗ par produit, et le net de mes coupons s'il y en a.

**Au toucher (deuxième niveau)**

- Le pourquoi (un fait).
- La marge 1xBet, la pire série, la cote de référence, la clôture.
- L'historique détaillé, la calibration, la période et l'effectif (exigés quand un chiffre de performance est affiché, donc dans la page de détail).

**À fusionner**

- **Décisions, Avis IA et Matchs** deviennent un seul onglet **Matchs** : chaque match montre notre lecture et l'avis IA côte à côte.
- **Mesures historiques** devient **Résultats** : tous les produits, leur forme et leurs chiffres datés.
- **Formation et Glossaire** deviennent une aide contextuelle : le « ? » à côté d'un mot ouvre la fiche. Plus d'entrée de menu dédiée.

**À supprimer de l'écran**

- Les étiquettes de source (« Choisi sur les cotes », « Analyse IA ») : le joueur s'en moque.
- « Relevé en cours », les codes, les capitales espacées.
- Les cartes dans les cartes.
- Le solde dans l'en-tête : il est déclaratif et va dans Moi.

**Navigation : 4 onglets** — **Aujourd'hui · Matchs · Résultats · Moi**. Dans « Moi » : mes coupons, mon suivi de mise, messages, compte. En-tête : le logo, la cloche, rien d'autre.

## 5. Budget de texte (règle de la refonte)

- **Par écran** : un titre au plus, souvent aucun ; aucun paragraphe au premier niveau.
- **Par élément** : une ligne de 6 mots au plus, hors noms d'équipes.
- **Par carte** : 3 chiffres au plus (cote, fréquence, forme).
- **Les explications** : toujours derrière un toucher, jamais en dessous par défaut.
- **Les obligations légales** (18+, risque) restent, en une ligne discrète et fixe.

## 6. L'écran Aujourd'hui, en blocs

```
 EVCore                                🔔  (K)
────────────────────────────────────────────────
 Hier   Favori ✓   Combiné ✓   Cote 2 ✗
────────────────────────────────────────────────
 COUPON DU JOUR                      ● ● ● ● ● ● ● ● ○ ○
 [PSG]  PSG – Lens        19:00       8 sur 10
        Victoire du PSG               1,28
 Forme  ✓ ✓ ✗ ✓ ✓ ✓ ✓ ✗ ✓ ✓
                         [ Suivre ]
────────────────────────────────────────────────
 Combiné          2 matchs     1,45   6 sur 10  ›
 Coupon cote 2    2 matchs     2,08   1 sur 2   ›
 Chasseur Nul     Lazio–Torino 3,30   1 sur 3   ›
────────────────────────────────────────────────
  Aujourd'hui    Matchs    Résultats    Moi
```

## 7. L'admin, minimal aussi

- **Accueil admin** : trois voyants, **Données · Moteur · Joueurs** (vert, orange, rouge), puis une seule liste « Ce qui demande ton attention » (ingestion en retard, canal qui dérive, chasseur qui s'abstient trop).
- Les 11 entrées admin deviennent **4 sections** : Pilotage (moteur, ML, ETL, matchs), Joueurs (utilisateurs, fidélisation, support), Contenu (annonces, formation), Journal (audit, rapports). Le détail se trouve en descendant, jamais à plat.

## 8. La landing

Un seul écran :
- le coupon du jour en vrai, avec sa forme ;
- la phrase de marque ;
- un bouton.

On montre au lieu de dire. Pas de chiffre gonflé (« 300 000+ » est à recompter), et la mention 18+ / risque reste.

## 9. Ensuite seulement : l'apparence

Une fois cette hiérarchie validée, on choisit un langage visuel **moderne et minimal** à son service :
- une seule police ;
- un fond neutre et une couleur d'accent ;
- le vert et le rouge réservés aux résultats ;
- les logos et les chiffres comme seules images ;
- beaucoup d'air.

On le teste sur l'écran Aujourd'hui avant de l'étendre.
