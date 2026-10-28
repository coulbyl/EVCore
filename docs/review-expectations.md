# Attentes de revue : ce qu'un changement doit tenir avant d'aller sur main

_Créé le 28/10/2026 après la revue de code de la PR #275 (`feat/produit-ux`). Chaque règle vient d'une erreur réellement écrite puis corrigée ; le commit de correction est cité pour qu'on puisse relire le cas. Document vivant : une nouvelle erreur de revue qui pourrait se répéter s'ajoute ici._

Ces règles complètent `CLAUDE.md`, elles ne le remplacent pas. Elles s'appliquent aux humains comme aux agents (Claude, Codex, Copilot, Gemini).

## Avant d'ouvrir une PR vers main

1. Lancer `/code-review` sur la branche. Effort `high` dès que le changement touche l'argent, le règlement ou un job planifié.
2. Corriger tous les constats de correction (`correctness`) avant la fusion. Un constat de nettoyage peut attendre, à condition de le dire dans la PR.
3. Relire la liste ci-dessous pour chaque fichier touché.

## 1. Argent : chaque écriture au solde doit pouvoir être rejouée

Une ligne `bankroll_transaction` n'a pas de clé d'unicité `(betId, type)`. Le règlement repasse sur les paris à chaque passage (correction VAR, worker de reconstruction, `settleAndCheck` manuel). Toute écriture au solde doit donc répondre à deux questions :

- **Que se passe-t-il si ce code tourne deux fois ?** Rien ne doit être écrit la seconde fois.
- **Que se passe-t-il si un statut change après le paiement ?** Par exemple, une jambe gagnée qui devient remboursée après une correction de score.

On crédite sur une **transition** vers « réglé », jamais sur un état. Pour un combiné, la transition se lit sur l'issue de ses jambes **avant** le passage (`combineLegs` appliqué aux statuts précédents).

_Cas réel : le combiné à jambe remboursée (cote 1) était recalculé et payé une seconde fois quand une jambe passait de gagnée à remboursée. Corrigé par `55dfbc97`._

**Tests attendus** pour tout changement de règlement :

- un second passage sans changement de statut ;
- une correction après paiement (gagné → remboursé, perdu → gagné).

## 2. Un nombre et les montants à côté parlent des mêmes objets

« 3 coupons réglés, misé 4 000 F, rendu 4 198 F » : les 4 000 F doivent venir de ces 3 coupons-là, et seulement d'eux. Si un coupon est encore en attente, sa mise va entièrement dans « encore en jeu », même si une de ses jambes est déjà perdue. Le solde, lui, la compte déjà.

L'agrégation se fait à un seul endroit par côté : `sumSlipMoney` (backend) et `sumSlipResults` (web, qui la reproduit). On n'additionne pas des montants à la main dans un composant ou un service.

_Cas réel : le compte ne prenait que les coupons réglés, alors que les montants ajoutaient les jambes réglées des coupons en attente. Corrigé par `90f0a276`._

## 3. Inconnu n'est pas zéro

Une valeur qu'on ne sait pas calculer est **exclue et comptée à part**. Elle n'est jamais affichée comme 0, et encore moins comme une perte. Exemple : un pari gagné dont la cote n'a jamais été enregistrée.

La même règle vaut dans tous les calculateurs du même domaine : `fixedStakeOutcome` et `slipMoney` disent la même chose. Quand une règle de ce type existe déjà dans un fichier, toute nouvelle fonction du fichier la suit.

_Cas réel : un combiné gagné sans cote affichait « Gagné » avec un gain net de −mise. Corrigé par `90f0a276`._

## 4. Un job daté doit prévoir ce qui arrive en retard

Un job qui rend compte de « la veille » rate tout ce qui se règle après son passage : match tardif, fournisseur lent, match reporté. On s'appuie sur « pas encore annoncé » et non sur la seule fenêtre de dates :

- enregistrer ce qui a été annoncé (ici, les identifiants des coupons dans le payload de la notification) ;
- relire une fenêtre glissante (`SLIP_DIGEST.LOOKBACK_DAYS`).

_Cas réel : un coupon en attente à 8 h UTC n'apparaissait jamais dans un résumé une fois réglé. Corrigé par `d09e47bc`._

**Test attendu** : un objet réglé après le passage est annoncé au passage suivant, et une seule fois.

## 5. Cotes et probabilités en `decimal.js`, produits compris

La règle de `CLAUDE.md` vaut aussi pour :

- un produit de cotes qui sert à une comparaison (fenêtre 2–3, bande de cote) ;
- tout ce qui est stocké : cote combinée, retour attendu, probabilité jointe.

On ne convertit en `number` qu'à la frontière : écriture Prisma, réponse d'API ou affichage.

_Cas réel : le coupon cote 2 multipliait ses cotes en `number`. Corrigé par `6ea998ef`. Le surcoût mesuré est de +27 % sur un vivier réaliste (398 → 505 ms, une fois par jour) : la performance n'est pas une raison de s'en passer à cette échelle._

## 6. Une valeur dérivée voyage avec sa source

Quand on emprunte une valeur à un autre enregistrement, on emprunte au **même** enregistrement toutes les valeurs qui en dérivent. Exemple : la cote d'une lecture sœur quand l'avis IA n'en a pas, et la fréquence du marché qui en découle. On ne mélange pas la cote de l'un et la fréquence de l'autre.

_Cas réel : l'avis IA affichait la cote empruntée, mais pas de fréquence. Corrigé par `cb86cf80`._

## 7. Pas de nouvel appel Prisma dans un service, même s'il en a déjà

La règle « Direct Prisma calls outside of repository files » s'applique aussi à un service qui en contenait déjà avant ton changement. Quand tu touches un tel service, déplace ses requêtes dans un repository plutôt que d'en ajouter. Le spec peut garder son client Prisma simulé en passant par le vrai repository : `new Service(new Repository(prisma))`.

_Cas réel : `NotificationService` avait gagné cinq appels directs. Toutes ses requêtes sont passées dans `NotificationRepository` avec `3cb9c00d`._

## 8. Types de retour explicites sur les repositories

Une méthode publique de repository déclare son type de retour : on définit un type de ligne (`PlayedSlipRow`, `DigestSlip`) plutôt que de laisser Prisma l'inférer. Sinon, un `select` modifié change en silence ce que lisent les appelants.

_Corrigé par `df701ed1` et `d09e47bc`._

## 9. `max-params` : la seule exception est le constructeur d'injection Nest

Un constructeur NestJS ne peut pas prendre un objet d'options : au-delà de trois dépendances, on écrit `// eslint-disable-next-line max-params -- <raison>`, comme une quinzaine de services du dépôt. Partout ailleurs, au-delà de trois paramètres, on les regroupe dans un objet. Un `eslint-disable` sur une fonction ordinaire n'est pas acceptable.

## 10. Un mock porte la forme réelle de la donnée

Un objet simulé doit avoir tous les champs que la vraie ligne a toujours. Par exemple, un pari a toujours un `status`. Un champ manquant cache une précondition et casse dès que le code commence à le lire.

_Cas réel : un spec de règlement simulait un pari sans statut. Le spec a cassé dès que le règlement a lu le statut précédent. Corrigé par `3b3643a3`._

## Constats laissés ouverts par la revue du 28/10

Ils ne sont pas bloquants, mais ils sont à traiter avant qu'ils ne coûtent :

- **Pause par garde ajouté route par route.** Chaque nouvelle route qui propose un pari doit porter `@UseGuards(PausedGuard)`. À terme : un garde au niveau du contrôleur des suggestions, ou un garde global avec une liste d'exceptions.
- **Mise en forme des montants en trois exemplaires.** On la trouve dans `bankroll.service`, `slip-digest.compose` et le `helpers/number.ts` du web : à unifier avant d'ajouter une devise.
- **Recherche de paires en O(n²)** dans `composeDouble` : environ 0,5 s par jour aujourd'hui, à revoir si le vivier dépasse environ 2 000 jambes.
