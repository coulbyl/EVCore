# Unit Staking — Feature Spec

## Contexte et décision de design

EVCore est un outil d'analyse, pas un bookmaker. La bankroll enregistrée dans l'app peut ne pas refléter la bankroll réelle de l'utilisateur. On ne peut pas l'imposer.

Le principe retenu : **l'utilisateur décide**. Il peut configurer son unité une fois dans ses préférences, et l'app pré-remplit le coupon automatiquement. S'il ne configure rien, le coupon reste fonctionnel (valeur par défaut).

Deux modes sont supportés :

| Mode    | Description                                  | Exemple (bankroll 200 000 FCFA) |
| ------- | -------------------------------------------- | ------------------------------- |
| `fixed` | Montant fixe en unité monétaire              | Unité = 2 000 FCFA              |
| `pct`   | Pourcentage de la bankroll suivie dans l'app | 1% → 2 000 FCFA (dynamique)     |

Le mode `pct` est dynamique : si la bankroll de l'app évolue, l'unité calculée change à chaque ouverture du coupon. Le mode `fixed` ne bouge pas.

L'utilisateur peut toujours modifier la mise manuellement dans le coupon — la valeur pré-remplie est une suggestion, jamais une contrainte.

---

## 1. Prisma — migration User

**Fichier :** `packages/db/prisma/schema.prisma`

Ajouter trois champs au modèle `User` après `currency` :

```prisma
// avant
currency             String?

// après
currency             String?
unitMode             String?    // "fixed" | "pct" — null = pas de préférence configurée
unitAmount           Decimal?   @db.Decimal(12, 2)  // montant fixe (mode "fixed")
unitPercent          Decimal?   @db.Decimal(5, 4)   // fraction [0, 1] (mode "pct", ex : 0.01 = 1%)
```

Migration à générer :

```bash
pnpm --filter @evcore/db exec prisma migrate dev --name add_user_unit_staking
```

---

## 2. Backend — DTO

**Fichier :** `apps/backend/src/modules/auth/dto/update-me.dto.ts`

Ajouter après `avatarUrl` :

```typescript
@IsOptional()
@IsIn(['fixed', 'pct'])
unitMode?: string;

@IsOptional()
@IsNumber()
@Min(0)
unitAmount?: number;

@IsOptional()
@IsNumber()
@Min(0)
@Max(1)
unitPercent?: number;
```

---

## 3. Backend — AuthSessionUser

**Fichier :** `apps/backend/src/modules/auth/auth.types.ts`

Ajouter après `currency` :

```typescript
unitMode: string | null;
unitAmount: string | null; // Decimal sérialisé en string depuis Prisma
unitPercent: string | null;
```

---

## 4. Backend — AuthService

**Fichier :** `apps/backend/src/modules/auth/auth.service.ts`

### 4a. Méthode `updateMe` — spread conditionnel

Ajouter dans le bloc `data` de `prisma.user.update` :

```typescript
...(dto.unitMode !== undefined && { unitMode: dto.unitMode }),
...(dto.unitAmount !== undefined && { unitAmount: new Decimal(dto.unitAmount) }),
...(dto.unitPercent !== undefined && { unitPercent: new Decimal(dto.unitPercent) }),
```

### 4b. Tous les blocs `select` sur `user`

Dans chaque objet `select` qui liste `currency`, ajouter :

```typescript
unitMode: true,
unitAmount: true,
unitPercent: true,
```

Cela concerne les quatre occurrences de select dans `getSession`, `updateMe`, et les helpers internes.

---

## 5. Frontend — Session utilisateur

**Fichier :** `apps/web/types/auth.ts` (ou l'équivalent qui type la session côté web)

Ajouter après `currency` dans le type `SessionUser` (ou `AuthSessionUser` côté web) :

```typescript
unitMode: string | null;
unitAmount: string | null;
unitPercent: string | null;
```

---

## 6. Frontend — Section préférences

**Fichier :** `apps/web/app/dashboard/params/account/components/bankroll-preferences-section.tsx`

Ajouter une section "Mise par unité" sous la section devise. La section affiche :

1. Un sélecteur de mode : deux boutons radio — **Montant fixe** / **% de la bankroll**
2. Selon le mode :
   - `fixed` → un champ numérique pour saisir le montant (ex : 2 000)
   - `pct` → un sélecteur ou champ pour la fraction (ex : 1%)

**Shape des labels passés en props :**

```typescript
labels: {
  // ...existant (currency)...
  unitStake: string; // "Mise par unité"
  unitModeFixed: string; // "Montant fixe"
  unitModePct: string; // "% de la bankroll"
  unitAmountPlaceholder: string; // "ex. 2 000"
  unitPctPlaceholder: string; // "ex. 1"
  unitPctSuffix: string; // "%"
}
```

**Comportement :**

- On mount : lire `session.user.unitMode`, `unitAmount`, `unitPercent` pour initialiser le state local.
- Sur changement : `PATCH /auth/me` avec les champs mis à jour.
- Si `unitMode` est `null` (pas encore configuré) : ne pas pré-sélectionner de mode, afficher un état vide avec un prompt "Configurer une unité (optionnel)".

---

## 7. Frontend — BetSlipDrawer

**Fichier :** `apps/web/domains/bet-slip/use-cases/use-bet-slip-draft.ts`

Actuellement : `DEFAULT_UNIT_STAKE = 4000` hardcodé.

**Objectif :** remplacer cette valeur par la préférence utilisateur au premier chargement du draft.

```typescript
// Logique de résolution de l'unité initiale
function resolveInitialUnit(
  session: SessionUser | null,
  currentBalance: number | null,
): number {
  if (!session?.unitMode) return DEFAULT_UNIT_STAKE;
  if (session.unitMode === "fixed" && session.unitAmount) {
    return Number(session.unitAmount);
  }
  if (
    session.unitMode === "pct" &&
    session.unitPercent &&
    currentBalance !== null
  ) {
    return Math.round(currentBalance * Number(session.unitPercent));
  }
  return DEFAULT_UNIT_STAKE;
}
```

Ce hook reçoit déjà la session via les providers existants. `currentBalance` est disponible depuis le store/query bankroll si le mode `pct` est actif — charger la valeur uniquement si `unitMode === 'pct'`.

**Note :** ne pas supprimer `DEFAULT_UNIT_STAKE = 4000` — il sert de fallback quand aucune préférence n'est configurée.

---

## 8. i18n

Ajouter dans `apps/web/messages/fr.json` sous `accountPage` :

```json
"unitStake": "Mise par unité",
"unitModeFixed": "Montant fixe",
"unitModePct": "% de la bankroll",
"unitAmountPlaceholder": "ex. 2 000",
"unitPctPlaceholder": "ex. 1",
"unitPctSuffix": "%",
"unitOptionalHint": "Optionnel — pré-remplit le coupon à chaque ouverture"
```

Même structure dans `en.json`.

---

## 9. Fichiers à modifier — récapitulatif

| Fichier                                                     | Changement                                                            |
| ----------------------------------------------------------- | --------------------------------------------------------------------- |
| `packages/db/prisma/schema.prisma`                          | +3 champs `unitMode`, `unitAmount`, `unitPercent` sur `User`          |
| `apps/backend/src/modules/auth/auth.types.ts`               | +3 champs sur `AuthSessionUser`                                       |
| `apps/backend/src/modules/auth/dto/update-me.dto.ts`        | +3 décorateurs `@IsOptional`                                          |
| `apps/backend/src/modules/auth/auth.service.ts`             | spread conditionnel dans `updateMe`, +3 champs dans tous les `select` |
| `apps/web/.../bankroll-preferences-section.tsx`             | Nouvelle section UI "Mise par unité"                                  |
| `apps/web/domains/bet-slip/use-cases/use-bet-slip-draft.ts` | `resolveInitialUnit()` remplace le hardcode                           |
| `apps/web/messages/fr.json` + `en.json`                     | Nouvelles clés i18n                                                   |

---

## 10. Ce qui ne change pas

- `BetSlip.unitStake` (Decimal 12,2) existe déjà en base — aucune migration besoin côté `BetSlip`.
- `BetSlipItem.stakeOverride` (Decimal 12,2) reste intact — override par item non affecté.
- `netUnits` dans la page Performance (`overview-section.tsx`) est déjà calculé côté backend à partir des `BetSlip.unitStake` enregistrés — aucun changement nécessaire.
- Le coupon reste entièrement éditable manuellement — la pré-saisie n'est qu'une suggestion.
