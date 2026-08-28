# Abonnements (Subscriptions) — mise virtuelle automatique et suivi de discipline

Statut : conception, pas encore implémenté. Ce document sert de base à l'implémentation à venir.

## Contexte

Les leçons Formation (`apps/web/content/formation/articles/unite-de-mise.md`, `variance-et-patience.md`, `allocation-et-timing.md`) répondent à "combien miser" et "quand miser". Il manque un outil pour vérifier, sans risquer de vrai argent ni composer quoi que ce soit à la main, si une discipline précise (un montant fixe, sur une source précise, certains jours) aurait été rentable. C'est l'idée du fondateur : un **abonnement** = une règle figée que le moteur applique tout seul, jour après jour, et dont il accumule le résultat.

Point clé : **ceci n'a rien à voir avec le portefeuille réel** (`BankrollTransaction`, dépôts, bet-slips — voir `apps/backend/src/modules/bankroll/`). C'est un système de suivi de performance indépendant, purement simulé, sans aucune action de l'utilisateur une fois l'abonnement créé.

Use case de référence (donné par l'utilisateur) : _"je m'abonne au Coupon, je mise 2000 sur chaque coupon les vendredi/samedi/dimanche et les jours où les grands championnats européens jouent, du [date début] au [date fin], et je veux voir si j'aurais été rentable."_

Contrainte explicite sur les **sources** (Coupon/canaux) : **pas de composition libre**. Ce qu'un abonnement peut cibler comme source vient d'un catalogue fermé et pré-construit dans le code — même esprit que `VIRTUAL_COUPON_RULES` (`apps/backend/src/modules/coupon/coupon.constants.ts:164-247`), pas une logique métier inventée par l'utilisateur. Le choix des **ligues** suit une règle différente (voir point 6) : ce n'est pas de la logique métier à inventer, juste une donnée réelle et finie (la table `Competition`) — l'utilisateur y choisit librement, sans que ça ouvre la porte à une composition arbitraire.

## Décisions de conception (tranchées, pour ne pas bloquer sur des questions ouvertes)

1. **Sources V1 : Coupon + tous les canaux réellement mis en production** (VALUE, SAFE, DOMINANT, DRAW, BTTS, TEAM_TOTAL) — pas seulement Coupon. GOALS est explicitement exclu du catalogue : on sait déjà qu'il perd de l'argent (leçon `goals-channel.md`), l'offrir comme cible d'abonnement contredirait toute la discipline qu'on vient de documenter.
2. **Un canal produit jusqu'à `topN` événements par jour, avec trois façons de choisir lesquels — laissées au choix de l'utilisateur** (`channelPickMode` + `topN`) :
   - **`INVESTIR`** (recommandé par défaut) : réutilise `InvestmentService.listChannelPicks({ date, channel })` — la liste complète du canal, classée par probabilité calibrée et passée par les mêmes garde-fous que la page Investir — et prend les `topN` premiers. Zéro nouvelle logique de classement à inventer ou à backtester.

     `listChannelPicks` et non `listPicks` : un abonné a souscrit à un **canal nommé**, pas à la partition assumé/observation d'Investir, qui se recalcule à chaque mesure et peut basculer d'un jour à l'autre.

     ⚠️ Réécrit le 2026-08-22 : avant, chaque canal avait son propre tri et son propre plafond `topN` (`MODE_RANKING` — edge pour DRAW/VALUE/TEAM_TOTAL, probabilité pour les autres). Testés en apparié, **aucun de ces plafonds n'était significatif** et les deux plus proches du seuil étaient négatifs ; `MODE_RANKING` a été supprimé et le tri est désormais unique (probabilité calibrée). Voir docs/audit-canaux-investir-2026-08-22.md §4.2.

   - **`DECISIONS_FIRST`** / **`DECISIONS_LAST`** : aucun classement proba/edge/calibration — on liste chaque décision `SELECTED` du canal ce jour-là, triée par heure de coup d'envoi (`ChannelDecisionRepository.findByDate`, ordre déjà utilisé par la page Decisions), et on retient soit les `topN` **premiers** (kickoff le plus tôt) soit les `topN` **derniers** (kickoff le plus tard) de cette liste.

     Un backtest day-by-day (`db:backtest:decisions-ranking`, 2026-07-29, pool identique — SELECTED, rank=1, odds non nulle, sans calibration/AVOID/EV-gate) montre que "derniers" bat ou égale "premiers" sur les 6 canaux CHANNEL\_\*, parfois nettement (TEAM_TOTAL top3 : -13.00% → +21.15% ; BTTS top3 : -3.28% → +1.39%), mais qu'aucune des deux variantes ne domine partout à tous les topN (ex. DRAW top5 : premiers +9.13% > derniers +8.11%) — pas assez tranché pour figer un seul comportement, donc les deux variantes sont proposées plutôt qu'une seule imposée.

   **`topN` est obligatoire pour toute source `CHANNEL_*`**, choisi dans un catalogue fermé de valeurs (`DEFAULT_CHANNEL_TOPN_OPTIONS = [1, 3, 5]`) — pas un entier libre. 1 seul événement/jour n'a statistiquement pas de sens pour juger une discipline. C'est un **curseur d'exposition laissé à l'abonné**, pas une règle de sélection calibrée : les valeurs par canal qui existaient ici (VALUE `[1, 5]`, TEAM_TOTAL 3) s'appuyaient sur `db:backtest:invest-ranking`, invalidé le 2026-08-22, et ont été unifiées. Chaque événement retenu porte la mise pleine `stakePerEvent` (même convention que `COUPON_ALL` — pas de mise divisée entre les `topN` picks du jour).

   Ce n'est pas un doublon : ce sont des disciplines réellement différentes à tester ("suivre les `topN` matchs les plus tôt/tard du jour, sans curation" vs "suivre les `topN` meilleurs picks du jour, curés et calibrés") — exactement la question posée par la leçon `channels-overview.md` ("le classement compte plus que le canal"), que l'abonnement permet maintenant de vérifier soi-même plutôt que de la lire seulement. Un canal peut produire beaucoup plus de décisions que `topN` le même jour (ex. 246 décisions TEAM_TOTAL en une journée observées le 2026-07-26) — les trois modes tranchent cette abondance différemment, mais toujours vers au plus `topN` événements par jour (moins si le canal a produit moins de décisions que `topN` ce jour-là).

3. **Deux façons de souscrire au Coupon** : `COUPON_BEST` (le coupon classé n°1 du jour uniquement — celui dont on a mesuré le meilleur ROI, +45.3% vs +28.4%/+12.0% pour rank 2/3, formation `allocation-et-timing.md`) et `COUPON_ALL` (chaque coupon généré ce jour-là, rank 1 à `maxCoupons`, mise pleine sur chacun — pour l'utilisateur qui veut suivre la production complète du jour plutôt que se limiter au meilleur).
4. **Condition de jour = union (OR), pas intersection.** "Vendredi/samedi/dimanche ET les jours de championnats européens" élargit les jours éligibles, il ne les restreint pas — un abonnement est éligible un jour donné si CE jour correspond à l'un OU l'autre des filtres actifs.
5. **Annulable à tout moment.** L'utilisateur peut arrêter un abonnement avant sa date de fin (statut `CANCELLED`) ; l'historique déjà accumulé reste visible, aucun nouvel événement n'est créé après l'arrêt. Cohérent avec le reste du produit (rollback d'`AdjustmentProposal`, jamais de mécanisme irréversible sans raison).
6. **Choix des ligues entièrement libre, pas un groupe figé.** Pas de `TOP5_EUROPE` imposé comme seule option — l'utilisateur sélectionne, dans un multi-select, n'importe quelle combinaison de compétitions parmi celles qui existent réellement (`Competition.isActive = true`). "Les jours où les grands championnats européens jouent" devient alors : l'utilisateur coche lui-même PL/BL1/SA/LL/L1 (ou tout autre sous-ensemble) dans la liste complète des ligues suivies par EVCore. Toujours "fermé" au sens où c'est validé contre les vraies compétitions en base (jamais du texte libre), mais pas limité à un seul bundle pré-nommé. Deux presets restent proposés dans l'UI comme raccourcis (`SUBSCRIPTION_LEAGUE_PRESETS`) : "Grands championnats européens" (PL/BL1/SA/LL/L1) et "Coupes européennes (UEFA)" (Ligue des Champions UCL, Europa League UEL, Conference League UECL) — chacun pré-coche son sous-ensemble en un clic, un simple confort de saisie, pas une restriction : l'utilisateur peut ensuite décocher/ajouter librement, y compris mélanger les deux presets ou n'en garder qu'une partie.

## Modèle de données (Prisma, `packages/db/prisma/schema.prisma`, schema `public`)

Suit exactement les conventions déjà en place (`CouponProposal`/`CouponProposalLeg`, `BankrollTransaction`, `UserContentProgress`) : `id` via `uuidv7()`, `Decimal` pour l'argent, `@@map` snake_case, index sur les patterns de requête réels.

```prisma
enum SubscriptionSourceType {
  COUPON_BEST      // CouponProposal, rank = 1 uniquement
  COUPON_ALL       // Chaque CouponProposal généré ce jour-là (rank 1..maxCoupons), mise pleine sur chacun
  CHANNEL_VALUE
  CHANNEL_SAFE
  CHANNEL_DOMINANT
  CHANNEL_DRAW
  CHANNEL_BTTS
  CHANNEL_TEAM_TOTAL

  @@map("subscription_source_type")
  @@schema("public")
}

enum SubscriptionStatus {
  ACTIVE
  ENDED       // endDate dépassée, terminé naturellement
  CANCELLED   // arrêté par l'utilisateur avant endDate

  @@map("subscription_status")
  @@schema("public")
}

// Uniquement pertinent quand sourceType est un CHANNEL_* (ignoré/null pour
// COUPON_BEST/COUPON_ALL, validé côté API — voir §Décisions de conception, point 2).
enum SubscriptionChannelPickMode {
  INVESTIR         // picks du canal classés par probabilité calibrée, comme la page Investir
  DECISIONS_FIRST  // premier(s) match(s) du jour par heure de coup d'envoi, non classé
  DECISIONS_LAST   // dernier(s) match(s) du jour par heure de coup d'envoi, non classé

  @@map("subscription_channel_pick_mode")
  @@schema("public")
}

model Subscription {
  id              String                 @id @default(dbgenerated("uuidv7()")) @db.Uuid
  userId          String                 @db.Uuid
  user            User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  sourceType      SubscriptionSourceType
  // Dénormalisé au moment de la création — si le catalogue change de libellé
  // plus tard, l'historique affiché reste celui vu par l'utilisateur au moment
  // de l'abonnement, pas une réécriture rétroactive.
  sourceLabel     String
  // Obligatoire si sourceType est un CHANNEL_*, doit être null pour
  // COUPON_BEST/COUPON_ALL (validé côté API, pas de contrainte DB — Prisma ne
  // fait pas de check conditionnel inter-colonnes).
  channelPickMode SubscriptionChannelPickMode?
  // Idem : obligatoire si sourceType est un CHANNEL_* (valeur du catalogue
  // SUBSCRIPTION_TOPN_OPTIONS, 1/3/5), null pour COUPON_BEST (toujours 1 par
  // définition) et COUPON_ALL (toujours "tous", pas de notion de topN).
  topN            Int?
  stakePerEvent   Decimal                @db.Decimal(14, 2)
  // Jours de semaine éligibles, 0=dimanche..6=samedi ; vide si seule la
  // condition ligue est utilisée.
  daysOfWeek      Int[]
  // Codes de compétition choisis librement par l'utilisateur (ex. ['PL','BL1']),
  // validés à la création contre Competition.code (Competition.isActive = true) —
  // vide si aucune condition de championnat n'est utilisée. Combiné à daysOfWeek
  // par OR. Pas de FK Prisma directe vers Competition (tableau de codes, pas de
  // relation many-to-many) — même choix que les codes en dur dans
  // BTTS_STAKED_LEAGUES/LAMBDA_SCALE_MAP ailleurs dans le code.
  competitionCodes String[]
  startDate       DateTime               @db.Date
  endDate         DateTime               @db.Date
  status          SubscriptionStatus     @default(ACTIVE)
  cancelledAt     DateTime?
  // Compteurs incrémentés à chaque règlement d'un SubscriptionEvent — évite de
  // resommer l'historique complet à chaque affichage.
  totalEvents     Int                    @default(0)
  settledEvents   Int                    @default(0)
  wonEvents       Int                    @default(0)
  totalStaked     Decimal                @default(0) @db.Decimal(14, 2)
  netPnl          Decimal                @default(0) @db.Decimal(14, 2)
  events          SubscriptionEvent[]
  createdAt       DateTime               @default(now())
  updatedAt       DateTime               @updatedAt

  @@index([userId, status])
  @@index([status, endDate])
  @@map("subscription")
  @@schema("public")
}

// Un événement par occurrence de la source, un jour où la condition de
// l'abonnement était remplie. Pour COUPON_BEST/CHANNEL_*, exactement un
// événement par jour (un seul coupon rank=1, ou un seul pick #1 de canal).
// Pour COUPON_ALL, un événement par CouponProposal généré ce jour-là (jusqu'à
// COUPON_PARAMS.maxCoupons, donc jusqu'à 3/jour) — chacun avec sa propre mise
// pleine, sa propre cote, son propre résultat. PENDING tant que le résultat
// réel n'est pas connu.
model SubscriptionEvent {
  id                 String            @id @default(dbgenerated("uuidv7()")) @db.Uuid
  subscriptionId     String            @db.Uuid
  subscription       Subscription      @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  date               DateTime          @db.Date
  // Exactement un des deux est renseigné, selon subscription.sourceType.
  couponProposalId   String?           @db.Uuid
  couponProposal     CouponProposal?   @relation(fields: [couponProposalId], references: [id])
  channelSelectionId String?           @db.Uuid
  channelSelection   ChannelSelection? @relation(fields: [channelSelectionId], references: [id])
  // Copié depuis Subscription.stakePerEvent à la création — modifier la mise
  // d'un abonnement en cours (si jamais permis plus tard) ne doit jamais
  // réécrire l'historique déjà simulé.
  stake              Decimal           @db.Decimal(14, 2)
  odds               Decimal?          @db.Decimal(6, 3)
  result             BetStatus?        // null = en attente
  pnl                Decimal?          @db.Decimal(14, 2)
  settledAt          DateTime?
  createdAt          DateTime          @default(now())

  // Pas juste (subscriptionId, date) : COUPON_ALL (plusieurs coupons/jour) et
  // CHANNEL_* avec topN > 1 (plusieurs picks/jour) produisent chacun plusieurs
  // événements le même jour, différenciés par couponProposalId/channelSelectionId
  // respectivement. Pour COUPON_BEST (toujours 1) et CHANNEL_* à topN=1, cette
  // contrainte se comporte comme (subscriptionId, date) — même garantie
  // d'idempotence, juste exprimée plus largement pour couvrir tous les cas.
  @@unique([subscriptionId, date, couponProposalId, channelSelectionId])
  @@index([subscriptionId])
  @@index([result, date])
  @@map("subscription_event")
  @@schema("public")
}
```

Ajouts nécessaires ailleurs dans le schéma : `subscriptions Subscription[]` sur `User` (près de `bankrollTransactions`, ligne ~491) ; relations inverses `subscriptionEvents SubscriptionEvent[]` sur `CouponProposal` et `ChannelSelection`.

**Important (règle déjà établie dans ce projet) : le schéma Prisma peut être édité, mais `prisma generate`/`db build`/`migrate` ne doivent jamais être lancés par l'agent — c'est l'utilisateur qui gère la migration via son propre CLI.**

## Catalogue pré-construit (backend, code, pas en base)

Nouveau fichier `apps/backend/src/modules/subscriptions/subscription.constants.ts`, même style que `VIRTUAL_COUPON_RULES` :

```typescript
export type SubscriptionSourceDef = {
  id: SubscriptionSourceType;
  label: string; // affiché dans l'UI de création
  kind: 'COUPON' | 'CHANNEL';
  channel?: StrategyChannel; // si kind === 'CHANNEL'
};

// Catalogue séparé des sources : uniquement proposé/affiché quand kind === 'CHANNEL'.
// Le formulaire de création force ce choix pour un canal, et le masque/ignore pour
// COUPON_BEST/COUPON_ALL.
export const SUBSCRIPTION_CHANNEL_PICK_MODES = [
  { id: 'INVESTIR', label: 'Picks Investir (classés et calibrés)' },
  {
    id: 'DECISIONS_FIRST',
    label: 'Premiers matchs du jour (Decisions, non classé)',
  },
  {
    id: 'DECISIONS_LAST',
    label: 'Derniers matchs du jour (Decisions, non classé)',
  },
] as const;

// Catalogue fermé, pas un entier libre — 1 seul événement/jour n'a pas de
// sens statistique pour juger une discipline ; 3 et 5 sont repris tels quels
// curseur d'exposition, identique pour tous les canaux (voir point 2).
export const SUBSCRIPTION_TOPN_OPTIONS = [1, 3, 5] as const;

export const SUBSCRIPTION_SOURCES: readonly SubscriptionSourceDef[] = [
  { id: 'COUPON_BEST', label: 'Coupon (meilleur du jour)', kind: 'COUPON' },
  { id: 'COUPON_ALL', label: 'Coupon (chaque coupon généré)', kind: 'COUPON' },
  {
    id: 'CHANNEL_VALUE',
    label: 'VALUE (Valeur)',
    kind: 'CHANNEL',
    channel: 'VALUE',
  },
  {
    id: 'CHANNEL_SAFE',
    label: 'SAFE (Sécurité)',
    kind: 'CHANNEL',
    channel: 'SAFE',
  },
  {
    id: 'CHANNEL_DOMINANT',
    label: 'DOMINANT (Victoire)',
    kind: 'CHANNEL',
    channel: 'DOMINANT',
  },
  {
    id: 'CHANNEL_DRAW',
    label: 'DRAW (Nul)',
    kind: 'CHANNEL',
    channel: 'DRAW',
  },
  {
    id: 'CHANNEL_BTTS',
    label: 'BTTS (Les deux marquent)',
    kind: 'CHANNEL',
    channel: 'BTTS',
  },
  {
    id: 'CHANNEL_TEAM_TOTAL',
    label: 'TEAM_TOTAL',
    kind: 'CHANNEL',
    channel: 'TEAM_TOTAL',
  },
] as const;

// Raccourci de saisie UI uniquement — pré-coche ces 5 codes dans le multi-select
// de compétitions, ne restreint rien côté serveur. L'utilisateur peut ensuite
// décocher/ajouter librement n'importe quelle compétition active.
export const SUBSCRIPTION_LEAGUE_PRESETS = [
  {
    id: 'TOP5_EUROPE',
    label: 'Grands championnats européens',
    // PL/BL1/SA/LL/L1 — codes confirmés packages/db/src/seed.ts
    competitionCodes: ['PL', 'BL1', 'SA', 'LL', 'L1'],
  },
  {
    id: 'UEFA_CUPS',
    label: 'Coupes européennes (UEFA)',
    // UCL/UEL/UECL — codes confirmés packages/db/src/seed.ts (leagueId 2/3/848)
    competitionCodes: ['UCL', 'UEL', 'UECL'],
  },
] as const;

export const SUBSCRIPTION_WEEKDAYS = [
  { value: 0, label: 'Dimanche' },
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
] as const;
```

`GET /subscriptions/catalog` renvoie `SUBSCRIPTION_SOURCES`, `SUBSCRIPTION_CHANNEL_PICK_MODES`, `SUBSCRIPTION_LEAGUE_PRESETS` et `SUBSCRIPTION_WEEKDAYS`, **plus** la liste complète des compétitions actives (réutiliser le repository déjà utilisé pour peupler les filtres de compétition ailleurs dans l'app, ex. `apps/backend/src/modules/fixture/` — pas besoin d'un nouvel endpoint compétitions dédié si un existe déjà) pour alimenter le multi-select libre du point 6.

## Pipeline quotidien

### 1. Matching (créer les `SubscriptionEvent` du jour)

Nouveau job BullMQ, module `etl` (même convention que `PENDING_BETS_SETTLEMENT` — `BULLMQ_QUEUES`/`ETL_CRON_SCHEDULES`/`ETL_SCHEDULER_KEYS` dans `apps/backend/src/config/etl.constants.ts`, worker dans `apps/backend/src/modules/etl/workers/`). Cron horaire (`0 * * * *`) — assez fréquent pour capter un coupon/pick généré en cours de journée, sans surcharge : les coupons/décisions ne sont générés qu'une poignée de fois par jour.

Pour chaque `Subscription` avec `status = ACTIVE` et `today` ∈ `[startDate, endDate]` :

1. Vérifier l'éligibilité du jour : `dayOfWeek(today) ∈ daysOfWeek` OU (`competitionCodes` non vide ET au moins une `Fixture` aujourd'hui dont `season.competition.code ∈ competitionCodes`).
2. Si non éligible, ou si un `SubscriptionEvent` existe déjà pour `(subscriptionId, today)` (`repository.hasEventForDate` — pas la contrainte `@@unique`, inefficace ici car `couponProposalId`/`channelSelectionId` sont mutuellement exclusifs et Postgres ne déduplique pas des colonnes NULL), ne rien faire.
3. Si éligible : chercher le ou les événements source du jour —
   - `COUPON_BEST` → `CouponProposal.findFirst({ where: { forDate: today, rank: 1 } })` — un seul événement.
   - `COUPON_ALL` → `CouponProposal.findMany({ where: { forDate: today } })` — un événement par proposition trouvée (jusqu'à `COUPON_PARAMS.maxCoupons`, donc jusqu'à 3 le même jour), chacun avec la mise pleine `stakePerEvent` (pas divisée entre eux).
   - `CHANNEL_*` avec `channelPickMode = 'INVESTIR'` → réutiliser `InvestmentService.listChannelPicks({ date: today, channel: source.channel })` puis retenir les `topN` premiers, un événement par pick retenu (moins s'il y a moins de picks éligibles ce jour-là) ; résoudre la `ChannelSelection` sous-jacente pour lier chacun.
   - `CHANNEL_*` avec `channelPickMode = 'DECISIONS_FIRST'` ou `'DECISIONS_LAST'` → réutiliser `ChannelDecisionService.listByChannel({ date: today, channel, status: SELECTED })` (même appel que la page Decisions, déjà trié par heure de coup d'envoi croissante), prendre les `topN` premières (`DECISIONS_FIRST`) ou dernières (`DECISIONS_LAST`, liste inversée) décisions (leur sélection `rank = 1`) — sans calibration ni classement par edge/probabilité, juste les `topN` matchs qui commencent le plus tôt ou le plus tard.
4. Si la source n'existe pas encore ce jour-là (rien généré), ne rien créer — retenté au prochain passage horaire, jusqu'à `endDate`. Si le jour se termine sans qu'aucune source n'ait existé (ex. aucun match ce jour dans l'univers suivi), le jour reste simplement sans événement — pas une erreur, juste un jour sans pari, cohérent avec la discipline documentée dans `variance-et-patience.md` ("l'absence de pick fait partie de la discipline").
5. Créer un `SubscriptionEvent` par événement source trouvé (`stake` = `subscription.stakePerEvent`, `odds` copiée de la source, `result = null`), incrémenter `Subscription.totalEvents` et `totalStaked` d'autant (donc +3×`stakePerEvent` un jour où `COUPON_ALL` trouve 3 coupons, ou où un `CHANNEL_*` à `topN=3` trouve 3 picks éligibles).
6. Une fois `today > endDate`, passer `status` à `ENDED` (vérifié à chaque tick du job, sur les abonnements encore `ACTIVE`).

### 2. Règlement (piggyback sur le tick existant, pas un nouveau job)

Ajouter un appel `subscriptionSettlement.settleReadyEvents()` dans `PendingBetsSettlementWorker.process()` (`apps/backend/src/modules/etl/workers/pending-bets-settlement.worker.ts:162`), juste après `couponSettlement.settleReadyProposals()` — même déclencheur, même cadence (30 min), aucune nouvelle infrastructure. Pour chaque `SubscriptionEvent` encore `result = null` dont la source (`CouponProposal.result` ou `ChannelSelection.result`) est maintenant non-nulle :

- Copier le résultat, calculer `pnl` (`stake * (odds − 1)` si WON, `−stake` si LOST, `0` si VOID).
- Incrémenter `Subscription.settledEvents`, `wonEvents` (si WON), `netPnl` — écriture atomique (`increment`), pas de recalcul complet.

**Push notification (2026-07-29)** : après avoir réglé tous les événements du run, un seul `PushService.sendToUser()` par abonnement touché (pas un par événement — évite de spammer un abonnement `topN=5` qui règle ses 5 picks dans le même passage), avec un résumé agrégé ("3 gagné(s), 1 perdu(s) · +1 234 F"). Réutilise l'infra `push_subscription` déjà en place pour l'inbox (`SupportNotifierService.notifyUser`) — aucune nouvelle brique, même pattern `sendToUser(userId, { title, body, url })`.

## API (`apps/backend/src/modules/subscriptions/`)

Suit exactement le pattern `apps/backend/src/modules/bankroll/` (controller/service/repository, DTO avec `class-validator`) :

- `GET /subscriptions/catalog` — sources, modes de sélection canal (Investir/Decisions), ensembles de ligues, jours de semaine.
- `POST /subscriptions` — DTO : `sourceType`, `channelPickMode?`, `topN?`, `stakePerEvent`, `daysOfWeek: number[]`, `competitionCodes: string[]`, `startDate`, `endDate`. Validation serveur : au moins une des deux conditions de jour non vide (`daysOfWeek` ou `competitionCodes`) ; `endDate > startDate` ; `startDate >= today` (pas d'abonnement rétroactif) ; `sourceType` doit exister dans le catalogue ; **chaque** code de `competitionCodes` doit correspondre à une `Competition.code` existante et `isActive` (jamais faire confiance à une valeur arbitraire du client, même si elle "ressemble" à un code valide) ; `channelPickMode` **et** `topN` **obligatoires** (topN ∈ `SUBSCRIPTION_TOPN_OPTIONS`) si `sourceType` est un `CHANNEL_*`, et **rejetés** (400) si `sourceType` est `COUPON_BEST`/`COUPON_ALL` — pas de valeur par défaut silencieuse dans un sens ou l'autre.
- `GET /subscriptions` — liste de l'utilisateur courant, avec compteurs dénormalisés (pas de jointure lourde pour l'affichage liste).
- `GET /subscriptions/:id` — détail + historique paginé des `SubscriptionEvent`.
- `POST /subscriptions/:id/cancel` — passe `status` à `CANCELLED`, `cancelledAt = now()` ; no-op si déjà `ENDED`/`CANCELLED`.

## Frontend (`apps/web/app/dashboard/subscriptions/`)

Même structure à trois couches que `bankroll` (`page.tsx` fin, `components/subscriptions-page-client.tsx`, hooks `apps/web/domains/subscriptions/{types,use-cases}`) :

- Liste des abonnements (`StatCard`/`DataTable` comme `bankroll-page-client.tsx`) : source, mise/événement, période, statut, ROI courant (`netPnl / totalStaked`), taux de réussite.
- Dialogue de création : select source (catalogue) ; si la source choisie est un canal (`kind === 'CHANNEL'`), deux selects supplémentaires apparaissent — `channelPickMode` (Investir/Decisions) et `topN` (1/3/5, `SUBSCRIPTION_TOPN_OPTIONS`) — masqués et non envoyés pour les sources Coupon ; multi-select de compétitions (recherche/coche libre parmi toutes les compétitions actives, avec les boutons de preset `SUBSCRIPTION_LEAGUE_PRESETS` en raccourci) ; checkboxes jours de semaine ; montant ; date début/fin. Source, mode canal et topN restent verrouillés au catalogue (aucune saisie libre) ; les compétitions sont un choix libre parmi des données réelles, pas une saisie de texte.
- Page détail `subscriptions/[id]/page.tsx` : historique complet des `SubscriptionEvent` (date, source, mise, cote, résultat, pnl), graphique cumulé du pnl dans le temps (même idée que la projection 30 jours du Portefeuille, mais purement rétrospective ici).
- Entrée nav dans `apps/web/components/app-shell.tsx` (`navGroupTracking`, à côté de `betSlips`).

## Ce que ce plan laisse volontairement de côté (à traiter si besoin, pas maintenant)

- Pas de fuseau horaire configurable : "le jour" se définit sur le fuseau serveur (UTC), comme le reste du pipeline ETL — cohérent avec `forDate`/`scheduledAt` déjà en UTC partout ailleurs.
- Pas de modification de `stakePerEvent`/dates après création — un abonnement est une règle figée par design ("discipline testée jusqu'au bout" est l'esprit du produit) ; seule l'annulation anticipée est permise.
- Pas de notification push/email par événement réglé dans ce plan — le module `notification` existe déjà et pourrait s'y brancher plus tard, hors scope ici.
- GOALS et les canaux encore en observation (CLEAN_SHEET, WIN_EITHER_HALF, CORRECT_SCORE) restent absents du catalogue tant qu'ils ne sont pas promus, comme documenté dans la Formation.

## Vérification (au moment de l'implémentation)

- Après que l'utilisateur ait lancé sa migration Prisma (`prisma generate`/`migrate` — jamais l'agent) : `pnpm --filter backend typecheck` + `pnpm --filter backend lint` + `pnpm --filter backend test` (nouveaux tests unitaires pour l'évaluation d'éligibilité de jour — cas OR entre `daysOfWeek` et `competitionCodes`, validation des codes contre `Competition` — et pour le calcul de `pnl`).
- `pnpm --filter web typecheck` + `pnpm --filter web lint`.
- End-to-end manuel : créer un abonnement `COUPON_BEST` avec `daysOfWeek` couvrant aujourd'hui, déclencher manuellement le nouveau worker de matching, vérifier qu'un `SubscriptionEvent` `PENDING` apparaît lié au `CouponProposal` rank 1 du jour ; une fois ce coupon réglé (ou via `settleRange` en rejouant une date passée), vérifier que `PendingBetsSettlementWorker` règle bien l'événement et incrémente les compteurs de l'abonnement.
