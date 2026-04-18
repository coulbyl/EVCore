# TODO-UI — EVCore Web

## ✅ BANKROLL-1 — Modèle de données (Backend)

**Nouvelle table Prisma `BankrollTransaction`**

```prisma
model BankrollTransaction {
  id            String                  @id @default(uuid())
  userId        String
  type          BankrollTransactionType
  amount        Decimal                 @db.Decimal(14, 2)
  betSlipItemId String?                 // null pour DEPOSIT
  note          String?                 // optionnel, ex. "Recharge #3"
  createdAt     DateTime                @default(now())

  user        User         @relation(fields: [userId], references: [id])
  betSlipItem BetSlipItem? @relation(fields: [betSlipItemId], references: [...])

  @@index([userId, createdAt])
}

enum BankrollTransactionType {
  DEPOSIT
  BET_PLACED
  BET_WON
  BET_VOID
}
```

- Balance courante = `SUM(amount)` par userId
- Append-only — jamais de UPDATE/DELETE sur cette table
- Migration : `pnpm --filter @evcore/db db:migrate -- --name add_bankroll_transaction`

---

## ✅ BANKROLL-2 — Module backend `bankroll/`

Structure : `bankroll.module.ts` → `bankroll.service.ts` → `bankroll.repository.ts` → `bankroll.controller.ts`

**Repository — méthodes :**

- `getBalance(userId): Promise<Decimal>` — SUM(amount) WHERE userId
- `getTransactions(userId, from?, to?, limit?, cursor?): Promise<BankrollTransaction[]>`
- `deposit(userId, amount, note?): Promise<BankrollTransaction>` — insère DEPOSIT
- `recordBetPlaced(userId, betSlipItemId, amount): Promise<BankrollTransaction>`
- `recordBetWon(userId, betSlipItemId, amount): Promise<BankrollTransaction>`
- `recordBetVoid(userId, betSlipItemId, amount): Promise<BankrollTransaction>`

**Service :**

- `getBalance(userId)` → repository.getBalance
- `getTransactions(userId, filters)` → repository.getTransactions
- `deposit(userId, amount, note?)` — valider amount > 0
- `recordBetPlaced` / `recordBetWon` / `recordBetVoid` — appelés en interne (pas exposés HTTP)

**Controller — endpoints :**

- `GET /bankroll/balance` → `{ balance: string, currency: "units" }`
- `GET /bankroll/transactions?from&to&limit&cursor` → liste paginée
- `POST /bankroll/deposit` body: `{ amount: number, note?: string }` → `{ balance: string }`

---

## BANKROLL-3 — Hooks dans les modules existants

### BetSlipService.create()

Après la transaction Prisma (création du slip + items), insérer une `BET_PLACED` par item :

```
amount = -(item.stakeOverride ?? unitStake)
betSlipItemId = item.id
```

Si balance résultante < 0 → rejeter avec `BadRequestException("Bankroll insuffisante")`

### BettingEngineService.settleOpenBets()

Après mise à jour du statut de chaque bet :

- `WON` → `BET_WON`, amount = `+(effectiveStake × oddsSnapshot)`
- `VOID` → `BET_VOID`, amount = `+effectiveStake`
- `LOST` → rien

> Les deux hooks passent via `BankrollService` (injecté), jamais direct Prisma.

---

## BANKROLL-4 — Page portefeuille `/dashboard/bankroll`

### Header — carte bilan

```
┌─────────────────────────────────────────────────────┐
│  Bankroll actuelle          Total déposé    ROI net  │
│  48 320 u                   50 000 u        -3.36%   │
│                                                      │
│  [+ Recharger]                                       │
└─────────────────────────────────────────────────────┘
```

- **Bankroll actuelle** = `GET /bankroll/balance`
- **Total déposé** = SUM des DEPOSIT
- **ROI net** = `(balance - totalDeposited) / totalDeposited × 100`

### Graphe d'évolution

- Courbe de la balance dans le temps (une valeur par jour)
- Calculé côté frontend à partir des transactions (running sum)
- Librairie : Recharts (déjà dans le projet ?)

### Historique des transactions

Tableau/liste :

```
Date       Type         Montant     Fixture / Note          Balance après
18/04/26   BET_PLACED   -4 000      PSG vs Arsenal (1X2)    46 000
17/04/26   BET_WON      +9 200      Chelsea vs City         50 000
17/04/26   BET_PLACED   -4 000      Chelsea vs City         44 800
15/04/26   DEPOSIT      +50 000     Bankroll initiale       48 800
```

Filtres : date range, type (DEPOSIT / BET_PLACED / BET_WON / BET_VOID)

### Modal dépôt

- Input montant (min 1)
- Input note optionnel
- Bouton confirmer → `POST /bankroll/deposit`
- Rafraîchit balance + transactions

---

## BANKROLL-5 — Intégration dans le BetSlipDrawer

- Afficher la balance courante en haut du drawer : `Bankroll : 48 320 u`
- Total engagé pour le slip courant (somme des stakes du draft)
- Avertissement si `totalStake > balance` (désactiver le bouton submit)

---

## BANKROLL-6 — Widget balance dans la sidebar/header

- Petit affichage persistant : `48 320 u` avec une icône portefeuille
- Lien vers `/dashboard/bankroll`
- Rafraîchissement après chaque soumission de slip

---

## Ordre d'implémentation

- [x] `BANKROLL-1` — migration Prisma (schema + generate)
- [x] `BANKROLL-2` — module backend complet (repository, service, controller, 9 tests)
- [x] `BANKROLL-3` — hooks BetSlip + Settlement
- [x] `BANKROLL-4` — page portefeuille (UI)
- [x] `BANKROLL-5` — intégration drawer
- [x] `BANKROLL-6` — widget sidebar
