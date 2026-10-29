# Refonte UI — 12. L'admin, à l'essentiel

_29/10/2026, réécrit le soir même : la première version gardait cinq sections et quinze onglets, l'utilisateur a tranché « l'admin actuel est un fourre-tout, il faut aller à l'essentiel ». Ce qui suit est l'admin ramené à ce qu'un exploitant fait vraiment, pour l'ordinateur, avec les mots techniques que le joueur ne voit jamais._

## 0. L'essentiel, c'est trois questions

Chaque matin : **est-ce que tout tourne ?**, **est-ce que le moteur tient ce qu'il annonce ?**, **est-ce que les joueurs viennent ?** Trois écrans, un par question, plus une petite page de réglages. Rien d'autre.

```
 Aujourd'hui · Matchs · Résultats · Moi      ← l'admin est aussi joueur
 ─────────
 Accueil admin      tout tourne ?
 Moteur             tient-il ce qu'il annonce ?
 Joueurs            viennent-ils ?
 ⚙ Réglages
```

**Ce qui disparaît** de l'admin actuel : Audit (vue des paris), Rapports, Documentation technique, Glossaire, Formation, Moteur ML, la page Performance et ses outils de backtest et de tuning, la liste Matchs admin, Avis IA admin, Annonces comme page, Suivi de mise. Ce qu'ils contenaient est soit dans un des trois écrans, soit dans le dépôt (rapports, documentation, scripts de backtest : on les lit et on les lance là où ils vivent, pas dans une page), soit retiré.

## 1. Accueil admin — tout tourne ?

```
 Admin                                          mardi 29/10 · 09:12
──────────────────────────────────────────────────────────────────
 ● Données   ● Moteur   ● Joueurs
──────────────────────────────────────────────────────────────────
 À faire
 ⚠ DOUBLE_CHANCE sur BL1 : 0,78 réalisé/annoncé, 62 jambes          ›
 ⚠ Chasseur Corners absent 4 jours sur 7                             ›
 ⚠ 2 messages sans réponse depuis plus de 24 h                       ›
──────────────────────────────────────────────────────────────────
 Les passes d'aujourd'hui
 04:00 Stats de match        ✓ 04:02 · 412 matchs
 06:00 Cotes                 ✓ 06:01
 08:00 Matinée               ✓ envoyée à 41 joueurs
 17:00 Coupons de demain     ✓ 17:03 · Favori, Combiné, Cote 2, 3 chasseurs
 17:45 Combiné IA            en attente
 19:00 Cotes                 en attente
 21:00 Analyse               en attente                          [Relancer]
──────────────────────────────────────────────────────────────────
 Aujourd'hui   Favori ✓ 1,24 · Combiné ✓ 1,41 · Cote 2 ✗ · IA ✓ 1,56
               12 joueurs actifs hier · 3 suivis · 1 inscrit
```

- **Trois voyants**, une règle chacun, écrite une fois :

| Voyant | Rouge si | Orange si |
| --- | --- | --- |
| **Données** | pas de cotes depuis 24 h, une passe en échec, ou le quota API-Football au seuil d'alerte | un relevé manqué, ou des stats de match en retard de plus de 3 jours sur un championnat fiable |
| **Moteur** | aucun coupon de demain composé après 17 h 30, ou la passe d'analyse arrêtée | un produit absent, un canal × compétition sous 0,85 avec perte établie, un marché suspendu, l'IA sans publication |
| **Joueurs** | zéro connexion depuis 48 h, ou une inscription en échec | un message sans réponse depuis plus de 24 h |

- **À faire** : les lignes viennent des règles du système (calibration, suspension, abstention répétée, stats manquantes, passe en échec, message sans réponse). Chaque ligne a son chiffre et mène à l'endroit où l'on agit. Elle disparaît quand la cause disparaît ; rien à « marquer comme lu ». Quand il n'y a rien : « Rien à faire ».
- **Les passes d'aujourd'hui**, dans l'ordre de la journée, avec l'heure prévue (celle du code), le dernier passage et son résultat ; **Relancer** sur une passe en échec ou en attente (tranché le 29/10). Une passe en cours grise le bouton et dit « en cours depuis 4 min ». Les actions lourdes (rattrapage de stats par saison, règlement forcé) ne sont pas des boutons : ce sont des commandes, documentées dans le dépôt.
- **Aujourd'hui** : les coupons du jour avec leur résultat du soir, trois chiffres joueurs. Rien d'autre sur l'accueil : pas de KPI, pas de carte de performance, pas de classement, pas de point de la semaine.
- **Un voyant qui passe au rouge envoie un e-mail** à l'adresse d'exploitation, une fois par passage, en plus de l'écran (tranché le 29/10). Jamais dans la cloche d'un joueur.
- **Passes coupées** (réglage d'incident, § 4) : bandeau rouge en haut de l'accueil, « coupées depuis le 29/10 21:40 par Fannan », tant que c'est coupé.

## 2. Moteur — tient-il ce qu'il annonce ?

Un écran, trois blocs l'un sous l'autre, une bascule 30 j · 90 j · Tout, une recherche de compétition.

```
 Moteur                                   30 j   ● 90 j   Tout     🔍
──────────────────────────────────────────────────────────────────
 Produits
 Favori      14 j  11 gagnés  annoncé 82 % réalisé 79 %  CLV +0,3  marge 6 %
 Combiné     15 j  11         72 % / 73 %                 −0,1      9 %
 Cote 2       1 j  trop tôt
 Avis IA    207 avis 136      64 % / 66 %                 −0,4      8 %
 Coupon long (retiré le 29/10)  10 j  4   34 % / 40 %
──────────────────────────────────────────────────────────────────
 Canaux × compétition                      ○ seulement les alertes
 DOUBLE_CHANCE  BL1   62 j.  0,78 [0,66–0,90]  ⚠ alerte           ›
 DOMINANT       PL    118 j. 0,97 [0,89–1,05]  conforme           ›
 …
──────────────────────────────────────────────────────────────────
 Marchés suspendus
 HALF_TIME_FULL_TIME   depuis le 18/10   −19 % sur 212 jambes   [Réactiver]
```

- **Produits** : la table de Résultats ([08](08-resultats.md)) avec ce que le joueur ne voit pas (annoncé, réalisé, CLV, marge 1xBet payée, jambes), **produits retirés compris** : ils gardent leur histoire ici. L'Avis IA est une ligne comme les autres ; le bilan par version de configuration s'ouvre au toucher de sa ligne.
- **Canaux × compétition** : 90 jours glissants, ratio réalisé/annoncé avec son intervalle, le mot (conforme, optimiste, pas assez de recul, alerte), la suspension. Une seule bascule : « seulement les alertes ». C'est la source des lignes « À faire ».
- **Marchés suspendus** : le marché, depuis quand, la mesure qui a suspendu, **Réactiver** (décision humaine, confirmation, motif, journalisé). Jamais de réactivation automatique.
- **La fiche de diagnostic d'un match** (λ, facteurs, picks évalués et motifs de rejet, cotes des books, CLV) **n'a plus de liste à elle** : un admin l'ouvre depuis l'onglet Matchs du joueur, par une icône sur la fiche joueur. Elle ne trie rien ([project_fiche_diagnostic_only]).
- **Les outils** (backtest, tuning, calibration modèle, rapports par segment) sortent de l'interface : ce sont des scripts du dépôt, avec leurs rapports dans `docs/audits/`. Une page qui lance un backtest n'a jamais servi à autre chose qu'à le relancer.

## 3. Joueurs — viennent-ils ?

Un écran, trois blocs.

```
 Joueurs                                                           🔍
──────────────────────────────────────────────────────────────────
 Ce mois   8 inscrits · 3 activés · 12 actifs sur 7 j · matinée ouverte 61 %
──────────────────────────────────────────────────────────────────
 Messages sans réponse                                       2  ›
──────────────────────────────────────────────────────────────────
 Comptes
 Kouassi    kouassi@…   joueur   créé le 13/10   3 suivis   en pause → 5/11  ›
 Aya        aya@…       joueur   créé le 28/10   0 suivi                    ›
 …
──────────────────────────────────────────────────────────────────
 Écrire une annonce                                            ›
```

- **Ce mois**, quatre chiffres : inscrits, activés (un suivi dans les 14 jours), actifs sur 7 jours, taux d'ouverture de la matinée. C'est toute la fidélisation ; la bascule du mois précédent au toucher. Pas de classement, pas de « meilleur parieur ».
- **Messages** : le support, un fil par joueur, les sans-réponse d'abord, pièces jointes, « marquer traité ». Un seul fil par joueur ([09](09-moi.md) § 2).
- **Comptes** : recherche (prénom, e-mail), et sur chaque ligne : rôle, créé le, suivis, **pause** ou **suspendu** visible. Une fiche par joueur : ses coupons suivis, son fil, et les actions (changer le rôle, suspendre, réactiver, lien de réinitialisation, supprimer). Pas de solde ni de mise.
- **Écrire une annonce** : un formulaire (titre, texte, aperçu de la notification telle que le joueur la verra), la règle rappelée « une par semaine au plus, jamais le soir » ([10](10-transverse.md) § 3), et la liste des annonces passées en dessous. Ce n'est pas une section : c'est une action de l'écran Joueurs.

## 4. Réglages

Décidé le 29/10 ([ENV-PROD](../audits/2026-10-29/ENV-PROD.md) § 6). Une page courte derrière l'icône ⚙.

```
 Réglages
──────────────────────────────────────────────────────────────────
 Fournisseur LLM          cerebras   secours : groq, together
 Recherche web            activée · tavily · 12 championnats
 Seuil d'alerte quota     80 %
 Réserve du rattrapage    300 appels / jour
 Passes planifiées        ● actives            incident seulement
──────────────────────────────────────────────────────────────────
 Journal
 28/10 21:40  Fannan   Fournisseur LLM        together → cerebras
 18/10 09:05  Fannan   HALF_TIME_FULL_TIME    réactivé · « relecture 90 j »
 03/10 14:12  Fannan   Rôle de aya@…          joueur → opérateur
```

- **Cinq réglages, pas plus** : ceux qu'un exploitant doit pouvoir changer le soir même sans déploiement. Tout le reste est en code (horaires, seuils, modèles, frontières de phase) ou dans le `.env` (secrets, adresses). Les fiches d'Aide sont dans le code, modifiées par PR (tranché le 29/10).
- **Chaque ligne** : la valeur, la valeur par défaut au toucher, et « pris en compte à la prochaine passe » à l'enregistrement. **Aucun secret** affiché ni saisi ; un fournisseur sans clé dans l'environnement est grisé, « pas de clé ».
- **Le journal**, sous les réglages, est le seul journal d'audit de l'admin : réglages changés, marchés réactivés, rôles, suspensions et suppressions de comptes, annonces publiées. Qui, quand, avant, après. Filtrable par personne. L'ancienne page Audit (vue des paris) disparaît.
- **Passes planifiées** : confirmation à la coupure, et le bandeau rouge sur l'accueil tant que c'est coupé.

## 5. Les états

| État | Ce qu'on montre |
| --- | --- |
| **Rien à faire** | Trois voyants verts, « Rien à faire », les passes de la journée. |
| **Passe en cours** | « en cours depuis 4 min », Relancer grisé. |
| **Passe en échec** | Ligne rouge dans les passes **et** ligne « À faire » ; Relancer actif ; le motif au toucher (le message de la file d'attente, pas plus). |
| **Voyant rouge** | La ligne « À faire » en tête, l'e-mail parti, l'heure du passage au rouge. |
| **Marché suspendu** | Ligne « À faire » tant qu'il l'est ; Réactiver demande confirmation et motif. |
| **Réglage sans clé** | Valeur grisée, « pas de clé dans l'environnement ». |
| **Aucun joueur ce mois** | Les quatre chiffres à 0, sans commentaire. |

## 6. Ce qu'il faut construire

- **Les règles des trois voyants** et la liste **À faire**, un seul point d'entrée qui agrège les alertes existantes (calibration, suspension, abstentions, stats manquantes, passes, support) ; aujourd'hui elles sont réparties entre trois cartes.
- **Les passes de la journée** avec le dernier passage par passe et **Relancer** (les tentatives existent dans `coupon_generation_attempt` et les files BullMQ ; il manque la vue par passe).
- **L'e-mail d'exploitation** au passage au rouge, une adresse dans le `.env`, une fois par passage.
- **Moteur › Produits** avec CLV et marge, produits retirés compris ; l'icône de diagnostic sur la fiche joueur pour les admins.
- **Joueurs** : les quatre chiffres du mois (le lot 4 les calcule déjà), la pause sur la ligne, la fiche avec suivis et fil, l'annonce comme action.
- **Réglages** : la table `app_setting`, le rechargement à chaud (lot config), et le journal unique des actions humaines (une partie existe : rôles ; à compléter).
- **Les suppressions** : pages Audit, Rapports, Documentation, Glossaire, Formation, ML, Performance, Matchs admin, Avis IA admin, Annonces, Suivi de mise, et leur code ; redirections des anciennes adresses vers l'écran le plus proche.

## 7. Tranché le 29/10

1. **Relancer** une passe depuis l'écran : oui.
2. **Les fiches d'Aide** : dans le code, par PR.
3. **L'e-mail d'exploitation** au passage au rouge : oui, en plus de l'écran.
4. **L'admin à l'essentiel** : trois écrans (Accueil, Moteur, Joueurs) et une page Réglages ; les outils et les rapports vivent dans le dépôt.
