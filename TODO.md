# EVCore — TODO

## Idée générale

Le socle principal est en place :

- auth web branchée sur les sessions backend
- dashboard, fixtures, audit, tickets et détail ticket livrés
- vocabulaire `coupon` retiré du produit courant
- backend auth / fixture / audit / bet-slip opérationnel
- analyse quotidienne auto branchée côté backend

La suite consiste surtout à finir le polish produit et verrouiller les derniers détails UX.

## À faire

- [ ] vérifier finement les parcours mobile-first sur auth, fixtures, drawer et tickets
- [ ] revoir le détail fixture / bet pour extraire des primitives réutilisables
- [ ] confirmer ou introduire `BetSlipStake` si ce type apporte une vraie valeur
- [ ] éviter toute réintroduction de logique de combiné dans l’UX

## Retours de test

### Fixtures

- [x] sur mobile, garder `Marché` et `Prob` visibles dans le tableau de diagnostic, avec `Cote` encore visible sur desktop
- [x] garder un header fixe sur la table fixtures pour ne pas perdre les repères pendant le scroll vertical
- [x] remplacer `Marché / Pick` par `Marché` dans le diagnostic
- [x] retirer l’id de fixture et l’action de copie, jugés inutiles
- [x] afficher le score dès qu’un score existe, quel que soit le statut du match
- [x] conserver les valeurs actuelles de `Entrée modèle`, mais les réorganiser en `grid-cols-4` compact sur mobile
- [x] revoir le header mobile du détail fixture sur 2 lignes :
      ligne 1 = équipes + badge de statut
      ligne 2 = marché + score si disponible
- [x] améliorer la présentation du fixture item sur mobile
- [x] ne pas rendre `Déclarer le résultat` pour les non-admin

- [x] garder le concept actuel de panier, mais revoir le wording et l’UX pour se rapprocher d’un ticket plus naturel
- [x] aligner le langage des marchés et des picks dans toute l’UI sur le diagnostic, qui devient la référence fiable
- [x] renommer `Ajouter panier` en `Placer`
- [x] empêcher `Placer` sur une fixture déjà présente dans n’importe quel ticket de l’utilisateur connecté
- [ ] permettre à l’utilisateur de placer n’importe quel pick évalué (pas seulement la décision modèle) depuis le diagnostic

  **Contexte** : le modèle sélectionne un pick `BET` mais évalue plusieurs picks. Un utilisateur peut vouloir placer un pick rejeté (ex : `Moins de 3.5` rejeté pour cote trop basse). Ce pick devient une décision propre à l’utilisateur, invisible des autres.

  **Migration Prisma requise (manuelle)** — ajouter sur `Bet` :
  ```prisma
  source BetSource @default(MODEL)   // MODEL | USER
  userId String?                     // null pour les bets modèle, id de l’auteur pour les bets utilisateur
  user   User? @relation(...)
  ```

  **Backend** :
  - Endpoint `POST /bets/from-evaluated-pick` — reçoit `{ modelRunId, market, pick }`, vérifie que le pick existe dans `evaluatedPicks` du `ModelRun`, crée le `Bet` avec `source: USER, userId`
  - Settlement local des bets `USER` : déclenché lors du settlement de la fixture (score déjà disponible sur `Fixture.homeScore / awayScore`), sans appel API Football — logique symétrique au settlement modèle

  **Frontend** :
  - Bouton "Placer" sur chaque ligne de la table "Sélections évaluées" dans le diagnostic
  - Désactivé si la fixture est déjà dans un ticket de l’utilisateur (garde existante)
  - Même flux drawer que le pick modèle

### Dashboard

- [ ] afficher le scoring du jour et les matchs avec cotes uniquement pour l’admin sur le dashboard d’accueil
- [ ] afficher un classement par compétitions actives
- [ ] afficher un top 10 des utilisateurs selon leurs tickets, métrique exacte à définir (`ROI`, gain net, autre)

### Mes tickets (NB: utiliser le langage de pick universelle)

- [x] afficher le gain ou la perte d’un ticket, avec une valeur provisoire tant que tout n’est pas settlé
- [x] dans le détail ticket, afficher le score et le statut de chaque pick

### Langage produit

- [x] retirer le vocabulaire trop technique au profit de mots simples et clairs
- [x] garder les mots métier simples et connus de tous comme `cote`, `ticket` et `mise`
- [x] garder une rédaction en français correct avec accentuation

## Hors scope

- permissions
- RBAC

## Règles importantes

- ne jamais créer de migration Prisma
- les migrations Prisma sont créées manuellement par l’utilisateur
- l’agent peut utiliser uniquement `db:generate` pour rester aligné avec Prisma
- l’authentification reste centralisée dans `apps/backend` avec sessions opaques serveur
- tous les filtres web restent server-side
- `page.tsx` sert à l’assemblage, pas à la logique métier lourde
- toute UI doit rester pensée mobile-first
- pas de hover-only interactions
- pas de tooltips desktop-only
- table fixtures sur mobile = cards empilées
- détail fixture = drawer mobile / side panel desktop
- touch targets minimum `44px`

## Rappels de structure

- `apps/web/constants/` pour les constantes partagées
- `constants/` dans un domaine pour les constantes spécifiques
- `lib/date.ts` comme point de passage unique pour la logique de date
- un composant = un fichier
