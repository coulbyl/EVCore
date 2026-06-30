# Analyse exhaustive du système Bet Slip — EVCore

> Document de référence pour implémenter un slip interactif type BetCliq.
> Rédigé après revue complète des deux apps (backend + web), juin 2026.

---

## 1. État actuel du système — ce qui existe

### 1.1 Modèle de données (Prisma)

#### `Bet` — le paris atomique

```prisma
model Bet {
  id                String         -- UUIDv7
  modelRunId        String         -- ModelRun source
  fixtureId         String         -- Fixture liée
  market            Market         -- ONE_X_TWO | OVER_UNDER | BTTS | etc.
  pick              String         -- HOME | DRAW | AWAY | OVER | YES | etc.
  pickKey           String         -- clé canonique "<market>|<pick>|<comboMarket?>|<comboPick?>"
  probEstimated     Decimal(5,4)
  oddsSnapshot      Decimal(6,3)?  -- null si cote indisponible
  ev                Decimal(6,4)   -- EV = probEstimated × oddsSnapshot − 1
  qualityScore      Decimal(6,4)?
  stakePct          Decimal(5,4)   -- % bankroll (ex: 0.01 = 1%)
  status            BetStatus      -- PENDING | WON | LOST | VOID
  comboMarket       Market?        -- champ secondaire pour les combos même-match
  comboPick         String?
  source            BetSource      -- MODEL | USER
  userId            String?        -- null pour les bets MODEL pur moteur
  channelSelectionId String?       -- lien vers la sélection du moteur

  @@unique([fixtureId, pickKey, userId])
}
```

**Points importants :**

- Un `Bet` est **atomique** — il représente un seul pick (ou un combo bivarié même-match).
- Les bets `source=MODEL` sont créés automatiquement par le moteur pour les canaux VALUE et SAFE.
- Les bets `source=USER` sont créés à la volée lors de la soumission d'un BetSlip (pour les picks manuels des canaux DRAW/BTTS/DOMINANT qui n'ont pas de `Bet` MODEL).
- Le champ `pickKey` garantit l'unicité : `<market>|<pick>|<comboMarket|->|<comboPick|->`.

#### `BetSlip` — l'enveloppe du coupon soumis

```prisma
model BetSlip {
  id        String      -- UUIDv7
  userId    String      -- propriétaire
  unitStake Decimal(12,2) -- mise unitaire (en monnaie locale)
  type      BetSlipType -- SIMPLE | COMBO
  items     BetSlipItem[]
  createdAt DateTime
}
```

#### `BetSlipItem` — une ligne du coupon

```prisma
model BetSlipItem {
  betSlipId     String
  userId        String
  betId         String           -- bet atomique inclus
  fixtureId     String
  stakeOverride Decimal(12,2)?  -- mise personnalisée pour ce pari (SIMPLE seulement)
  createdAt     DateTime

  @@id([betSlipId, betId])
  @@unique([betSlipId, fixtureId])  -- ← UN SEUL BET PAR FIXTURE PAR COUPON
}
```

**Contrainte critique :** `@@unique([betSlipId, fixtureId])` — un coupon ne peut pas contenir deux bets sur le même match. C'est une règle métier forte.

#### `CouponProposal` / `CouponProposalLeg` — coupons générés par le moteur

Entité **distincte** du BetSlip utilisateur. C'est le coupon algorithmique composé et ranké par le moteur chaque jour (signal-window, EV, profils SAFE/BALANCED/AGGRESSIVE). Il n'est pas lié à un `BetSlip`.

```prisma
model CouponProposal {
  combinedOdds     Decimal(8,3)
  jointProbability Decimal(5,4)
  signalScore      Decimal(5,4)
  status           CouponProposalStatus  -- PENDING | ACCEPTED | REJECTED | EXPIRED
  result           CouponResult?         -- WON | LOST | PARTIAL
  reasoning        Json?
  rank             Int
  legs             CouponProposalLeg[]
}

model CouponProposalLeg {
  fixtureId    String
  canal        StrategyChannel
  market       Market
  pick         String
  comboMarket  Market?   -- combo même-match (Étape 6)
  comboPick    String?
  probability  Decimal(5,4)
  oddsSnapshot Decimal(6,3)?
  signalScore  Decimal(5,4)
  featureSnapshot Json
  isCorrect    Boolean?
}
```

---

### 1.2 Architecture backend du slip

**Module `bet-slip/`** (complet, fonctionnel) :

| Fichier                      | Responsabilité                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `bet-slip.controller.ts`     | 4 endpoints : `GET /bet-slips/summary`, `GET /bet-slips`, `GET /bet-slips/:id`, `POST /bet-slips` |
| `bet-slip.service.ts`        | Logique de création (transaction Prisma), calcul PnL, mapping vers la vue                         |
| `bet-slip.repository.ts`     | Requêtes Prisma : liste, détail, summary (WON/LOST/PENDING), stats ROI global                     |
| `bet-slip.types.ts`          | Types TypeScript : `BetSlipView`, `BetSlipItemView`, `BetSlipSummaryView`                         |
| `dto/create-bet-slip.dto.ts` | DTO de création avec `class-validator`                                                            |

**Module `bet/`** :

Le service `BetService` est un placeholder vide. La création des `Bet` USER est entièrement dans `BetSlipService.create()`.

**Module `coupon/`** (coupon algorithmique) :

Entité et logique séparées du slip utilisateur. Le module orchestre la composition automatique des coupons du moteur (signal-window, scoring, profils). Il n'interagit pas avec `BetSlip`.

---

### 1.3 Flux de création d'un BetSlip (backend)

```
POST /bet-slips { type, unitStake, items[] }
         │
         ├── items avec betId → Bet MODEL existant (VALUE/SAFE)
         └── items avec modelRunId + market + pick → Pick USER
                    │
                    └── Cherche dans ModelRun.features.evaluatedPicks
                        pour valider pick + récupérer probability/odds/ev
                        ↓
                        Crée Bet (source=USER) si inexistant [@@unique]
         │
         └── Vérifie unicité fixtureId dans le slip
                    ↓
             $transaction {
               BetSlip.create
               BetSlipItem.createMany
               bankroll.recordBetPlacedBatch (déduit les mises)
             }
```

---

### 1.4 Frontend — état actuel

**Store de draft** : `apps/web/domains/bet-slip/`

| Fichier                             | Rôle                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------- |
| `types/bet-slip.ts`                 | Types `BetSlipDraftItem`, `BetSlipDraft`, `BetSlipView`, `draftItemKey()` |
| `use-cases/use-bet-slip-draft.ts`   | Hook `useBetSlipDraft()` — état localStorage + sync multi-onglets         |
| `context/bet-slip-provider.tsx`     | Provider React wrappant le draft + état `isOpen`                          |
| `context/bet-slip-context.tsx`      | Contexte React + hook `useBetSlip()`                                      |
| `use-cases/create-bet-slip.ts`      | Appel API `POST /bet-slips`                                               |
| `use-cases/get-bet-slips.ts`        | Requête TanStack Query `GET /bet-slips`                                   |
| `use-cases/get-operator-summary.ts` | Résumé global (`GET /bet-slips/summary`)                                  |

**Composants slip** :

| Fichier                             | Rôle                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `components/bet-slip-button.tsx`    | Bouton topbar + FAB mobile — ouvre le drawer                                |
| `components/bet-slip-drawer.tsx`    | Drawer complet : liste des picks, mode SIMPLE/COMBO, mise, soumission       |
| `components/add-to-slip-inline.tsx` | **Entièrement commenté** — ancienne implémentation du bouton d'ajout inline |
| `app/dashboard/bet-slips/`          | Page historique des coupons soumis (liste + panneau détail)                 |

**Page historique** :

- `bet-slip-list-page-client.tsx` : liste avec filtres (type, période), StatCards, drawer mobile
- `bet-slip-detail-panel.tsx` : panneau détail d'un coupon (legs, statuts, PnL, cote combo)

**État du draft** (localStorage `evcore:bet-slip-draft`) :

```typescript
type BetSlipDraft = {
  items: BetSlipDraftItem[];
  unitStake: number;
  type: "SIMPLE" | "COMBO";
};

type BetSlipDraftItem = {
  betId?: string; // Bet MODEL → référence directe
  modelRunId?: string; // Pick USER → créé en base à la soumission
  fixtureId: string;
  fixture: string; // "PSG vs Lyon"
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string;
  scheduledAt: string;
  market: string; // "ONE_X_TWO"
  pick: string; // "HOME"
  comboMarket?: string; // combo même-match
  comboPick?: string;
  odds: string | null;
  ev: string | null;
  stakeOverride: number | null;
};
```

---

## 2. Ce qui manque pour un slip type BetCliq

### 2.1 Bouton d'ajout au slip sur la page Décisions

**État actuel :** `add-to-slip-inline.tsx` est **entièrement commenté**. Les composants `MatchCard` et `ChannelRow` n'ont aucun bouton pour ajouter au slip.

**Ce qui manque :**

- Un bouton `+` / `✓` sur chaque `ChannelRow` pour les décisions SELECTED
- Logique différenciée selon le canal :
  - VALUE / SAFE : le `betId` est sur la `ChannelSelection` → `addItem({ betId })`
  - DRAW / BTTS / DOMINANT : pas de `betId`, utiliser `modelRunId` + `market` + `pick`
- Feedback visuel (état "dans le slip" vs "non ajouté") par canal
- Accès au `betId` et `modelRunId` depuis les données de décision

**Données manquantes dans les DTOs du frontend :** Les types `ChannelDecisionMatchDto` et `ChannelDecisionDto` ne semblent pas exposer `betId` ni `modelRunId`. Il faut vérifier si le endpoint `/channel-decisions` retourne ces champs.

### 2.2 Vue slip enrichie (style BetCliq)

**Ce qui existe :** Le drawer actuel est fonctionnel mais basique.

**Ce qui manque :**

- Affichage du canal coloré par pick dans le drawer
- Indicateur d'EV total du coupon (somme ou EV joint calibré)
- Alerte de compatibilité (deux picks incompatibles sur le même match si la contrainte `@@unique([betSlipId, fixtureId])` n'est pas visible clairement pour l'utilisateur)
- Suggestion de "compléter le coupon" depuis les propositions du moteur (`CouponProposal`)
- EV breakdown par leg dans le footer du drawer

### 2.3 Compatibilité inter-canaux non exposée côté client

La contrainte `@@unique([betSlipId, fixtureId])` est appliquée en base de données, mais **le client ne sait pas, avant soumission, si deux picks sont combinables**. L'erreur ne remonte qu'après l'appel API.

Il manque une validation préemptive côté client qui bloque l'ajout d'un deuxième bet du même fixture.

### 2.4 Canal `DRAW`, `BTTS`, `DOMINANT` — accès aux données de création de pick

**Problème :** Pour créer un `Bet USER` en backend, il faut `modelRunId + market + pick`. Ces données doivent être présentes dans le DTO de décision côté frontend. Si elles ne le sont pas, il faut enrichir le DTO `ChannelDecisionDto`.

### 2.5 Pas de mode "ajouter le coupon moteur au slip"

Le moteur génère des `CouponProposal` qui sont de bons coupons calibrés. Il n'existe pas de bouton "Copier ce coupon dans mon slip" sur la page Coupons. C'est un flux BetCliq typique.

---

## 3. Règles de combinabilité des picks

### 3.1 Règle fondamentale — un seul bet par fixture

```
@@unique([betSlipId, fixtureId])
```

**Un coupon ne peut pas contenir deux paris sur le même match.** C'est enforced en base. Le client doit prévenir avant la soumission.

### 3.2 Incompatibilités logiques (même fixture, même marché)

Ces picks sont **mutuellement exclusifs** — les combiner dans deux slips séparés est possible, mais les combiner en un seul pari interne n'a aucun sens :

| Marché `ONE_X_TWO` | Picks incompatibles entre eux |
| ------------------ | ----------------------------- |
| `HOME` + `DRAW`    | impossible simultanément      |
| `HOME` + `AWAY`    | impossible simultanément      |
| `DRAW` + `AWAY`    | impossible simultanément      |

| Marché `OVER_UNDER`          | Picks incompatibles    |
| ---------------------------- | ---------------------- |
| `OVER` + `UNDER` (ligne 2.5) | mutuellement exclusifs |
| `OVER_1_5` + `UNDER_1_5`     | mutuellement exclusifs |
| etc.                         |

| Marché `BTTS` | Picks incompatibles    |
| ------------- | ---------------------- |
| `YES` + `NO`  | mutuellement exclusifs |

**Ces incompatibilités ne s'appliquent que pour les combos même-match** (feature `comboMarket/comboPick`). Dans un slip COMBO multi-match, chaque fixture est indépendante et n'a qu'un seul bet autorisé.

### 3.3 Picks combinables même-match (`COMBO_WHITELIST`)

Le moteur dispose d'une `COMBO_WHITELIST` dans `betting-engine.utils.ts` définissant les paires de marchés validées statistiquement pour un combo bivarié Poisson. Ces combos sont des **legs uniques** couvrant deux marchés corrélés. Exemples typiques :

- `ONE_X_TWO/HOME` + `OVER_UNDER/OVER` (victoire domicile + buts)
- `BTTS/YES` + `OVER_UNDER/OVER`

Ces combos ne violent pas la contrainte `@@unique([betSlipId, fixtureId])` car ils sont encodés dans **un seul** `Bet` (avec `comboMarket`/`comboPick`).

### 3.4 Canaux et leurs picks dans la logique de slip

| Canal     | Source du pick                | Bet en base               | Peut entrer dans un slip                                              |
| --------- | ----------------------------- | ------------------------- | --------------------------------------------------------------------- |
| VALUE     | `Bet` MODEL (moteur)          | Oui, créé par le moteur   | Oui — via `betId`                                                     |
| SAFE      | `Bet` MODEL (moteur)          | Oui, créé par le moteur   | Oui — via `betId`                                                     |
| DRAW      | `ChannelSelection` uniquement | Non (pas de Bet MODEL)    | Oui — via `modelRunId + market + pick` → créé en base à la soumission |
| BTTS      | `ChannelSelection` uniquement | Non (pas de Bet MODEL)    | Oui — via `modelRunId + market + pick` → créé en base à la soumission |
| DOMINANT  | `ChannelSelection` uniquement | Non (pas de Bet MODEL)    | Oui mais ROI −2.1% — à décourager UI                                  |
| AVOID     | Décision de rejet             | —                         | Non — AVOID = signal de danger                                        |
| CONSENSUS | Décision composite            | Dépend des canaux sources | Via les canaux sources (VALUE, SAFE)                                  |

---

## 4. Schéma de données — pas de modification requise

Le schéma Prisma actuel est complet pour implémenter le slip type BetCliq. **Aucune migration n'est nécessaire** pour les fonctionnalités core.

Les colonnes suivantes supportent déjà tous les cas d'usage BetCliq :

```
BetSlip.type = SIMPLE | COMBO
BetSlipItem.stakeOverride (mise personnalisée par leg en mode SIMPLE)
Bet.comboMarket / Bet.comboPick (combo même-match dans un seul leg)
Bet.source = MODEL | USER (distinction entre pick moteur et pick manuel)
Bet.channelSelectionId (traçabilité vers le canal source)
```

**Optionnel — si on veut un nom de coupon :** Le DTO `CreateBetSlipDto` a déjà un champ `name?: string` non persisté. Si on veut persister le nom, il faut ajouter `name String?` à `BetSlip` (migration mineure).

---

## 5. Endpoints API nécessaires

### Endpoints existants (déjà fonctionnels)

```
POST   /bet-slips               ← créer un coupon
GET    /bet-slips               ← lister ses coupons (filtre from/to)
GET    /bet-slips/:id           ← détail d'un coupon
GET    /bet-slips/summary       ← KPIs (slipCount, wonBets, winRate, ROI global)
```

### Endpoint manquant — vérification de compatibilité

```
POST /bet-slips/check-compatibility
Body: { items: { betId?: string, fixtureId: string, market: string, pick: string }[] }
Response: { compatible: boolean, conflicts: { fixtureId, message }[] }
```

Ce endpoint évite une soumission vouée à l'échec. Il peut être remplacé par une validation purement côté client si on vérifie `fixtureId` dans le draft avant d'ajouter un item.

### Endpoint manquant — copier un CouponProposal en BetSlip

```
POST /bet-slips/from-coupon
Body: { couponProposalId: string, unitStake: number }
Response: BetSlipView
```

Ce flux crée un `BetSlip` à partir d'une `CouponProposal` générée par le moteur. Le service résout les `betId` depuis les `CouponProposalLeg` (via `Bet MODEL` ou `ModelRun`).

---

## 6. Architecture frontend proposée

### 6.1 Store (pas de changement requis)

Le store actuel (`useBetSlipDraft`) est correct et complet. Il gère :

- localStorage avec hydration post-mount (SSR-safe)
- Sync multi-onglets via `StorageEvent`
- Mise unitaire depuis `unitMode` utilisateur (FIXED ou PCT du solde)
- `isInSlip(key)` pour le feedback visuel des boutons

**Un seul ajout utile :** exposer une méthode `canAdd(fixtureId): boolean` pour bloquer l'ajout avant même d'appuyer sur le bouton.

```typescript
const canAdd = useCallback(
  (fixtureId: string) => !draft.items.some((i) => i.fixtureId === fixtureId),
  [draft.items],
);
```

### 6.2 Composant `SlipPickButton` — à créer

Remplacement du fichier commenté `add-to-slip-inline.tsx`. Un seul composant générique :

```
apps/web/components/slip-pick-button.tsx
```

Props :

```typescript
type SlipPickButtonProps = {
  fixtureId: string;
  betId?: string; // pour VALUE / SAFE
  modelRunId?: string; // pour DRAW / BTTS / DOMINANT
  market: string;
  pick: string;
  comboMarket?: string;
  comboPick?: string;
  odds: string | null;
  ev: string | null;
  canal: "VALUE" | "SAFE" | "DRAW" | "BTTS" | "DOMINANT";
  // contexte d'affichage pour le drawer
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string;
  scheduledAt: string;
};
```

Comportement :

1. `isInSlip(betId ?? draftItemKey({ fixtureId, market, pick }))` → affiche ✓ vert si déjà dans le slip
2. `!canAdd(fixtureId)` + pas déjà dans le slip → bouton désactivé avec tooltip "Un pari par match"
3. Click → `addItem(item)` puis ouvre le drawer si c'est le premier item

### 6.3 Intégration dans `ChannelRow`

Le composant `ChannelRow` doit recevoir les données nécessaires à la création du `SlipPickButton`. Il faut enrichir le type `ChannelDecisionMatchDecisionDto` avec :

```typescript
// À ajouter dans le DTO backend ChannelDecisionDto / ChannelDecisionMatchDecisionDto
betId?: string;        // non null pour VALUE et SAFE si le Bet MODEL existe
modelRunId?: string;   // ID du ModelRun pour DRAW/BTTS/DOMINANT
```

Emplacement dans `ChannelRow` : à droite du `ResultBadge`, dans le `div.flex.items-center.gap-1.5`.

### 6.4 Dessin de flux UX BetCliq

```
Page Décisions
    │
    ├── MatchCard [PSG vs Lyon 15:00]
    │       ├── ChannelRow VALUE: "HOME" @1.85 EV+12%   [+] ← SlipPickButton
    │       ├── ChannelRow SAFE:  "OVER" @1.42 EV+4%    [+] ← SlipPickButton
    │       └── ChannelRow DRAW:  "DRAW" @3.80           [+] ← SlipPickButton (modelRunId)
    │
    └── BetSlipButton (topbar) → BetSlipDrawer
                │
                ├── Tab "Simples" | Tab "Combiné"
                ├── Liste des picks (avec logo équipe, cote, EV, canal badge)
                ├── [Supprimer] par pick
                ├── Mise globale + mise par leg (mode Simples)
                ├── Cote totale + EV coupon (mode Combiné)
                ├── Solde / avertissement solde insuffisant
                └── [Valider le coupon]
```

### 6.5 Page Coupons moteur — bouton "Copier dans mon slip"

Sur `apps/web/app/dashboard/coupons/` :

```
CouponCard [Coupon #1 — 3 legs — cote 4.20]
    ├── leg 1: PSG vs Lyon / VALUE HOME @1.85
    ├── leg 2: Dortmund vs Bayern / SAFE OVER @1.42
    └── leg 3: Arsenal vs Chelsea / DRAW @3.80
    └── [Utiliser ce coupon] → POST /bet-slips/from-coupon → ouvre drawer pré-rempli
```

---

## 7. Résumé des chantiers à implémenter

### Priorité 1 — Rétablir le bouton d'ajout inline (1 à 2 jours)

1. **Enrichir le DTO** `ChannelDecisionDto` avec `betId?` et `modelRunId?` dans le backend (`channel-decision.service.ts`, `channel-decision.repository.ts`)
2. **Créer** `apps/web/components/slip-pick-button.tsx` (remplace le code commenté dans `add-to-slip-inline.tsx`)
3. **Ajouter `canAdd`** dans `useBetSlipDraft` et l'exposer via le contexte
4. **Intégrer** `SlipPickButton` dans `ChannelRow` (une ligne pour VALUE/SAFE, une pour DRAW/BTTS/DOMINANT)

### Priorité 2 — Améliorer le drawer (0.5 jour)

5. Ajouter `CanalBadge` par pick dans `DraftItemRow` (le composant existe déjà : `components/canal-badge.tsx`)
6. Afficher l'EV total du coupon en mode COMBO dans le footer (calcul déjà présent pour la cote totale, même pattern)
7. Alerte préemptive si deux picks du même match tentent d'être ajoutés

### Priorité 3 — Copier un coupon moteur (1 jour)

8. **Backend :** `POST /bet-slips/from-coupon` dans `BetSlipController`/`BetSlipService`
9. **Frontend :** Bouton "Utiliser ce coupon" dans `CouponCard` → appelle le nouveau endpoint → ouvre le drawer

### Optionnel — Validation de compatibilité serveur

10. `POST /bet-slips/check-compatibility` (à ne faire que si la validation client seule est insuffisante)

---

## 8. Contraintes et règles à respecter

- **Jamais deux bets sur le même fixture dans un slip** — `@@unique([betSlipId, fixtureId])` est l'autorité finale. Le client doit prévenir, le backend rejette.
- **BTTS/DRAW en USER picks** — Ces canaux n'ont pas de `Bet MODEL`. La création du `Bet USER` se fait dans `BetSlipService.create()` via `modelRunId + market + pick`. Il faut que le `ModelRun` ait des `evaluatedPicks` avec ces marchés dans ses `features`.
- **Cote obligatoire pour un combo** — `BetSlipService.create()` ne requiert pas de cote pour créer le `Bet USER`, mais un combo sans cote n'a pas d'EV calculable. Le drawer doit afficher `@—` et ne pas calculer de gain potentiel.
- **Mode COMBO** — `stakeOverride` est ignoré en mode COMBO (une seule mise unitaire pour tout le coupon). C'est enforced dans `BetSlipService.create()`.
- **Bankroll** — La déduction de bankroll est faite dans la transaction de création. Le solde affiché dans le drawer est en temps réel via `useBankrollBalance`.
- **DOMINANT ROI négatif** — Le canal DOMINANT a un ROI −2.1% prouvé (DESIGN.md B-ROI). L'UX devrait le signaler (badge "prédiction" plutôt que bouton d'ajout standard, ou tooltip d'avertissement).
