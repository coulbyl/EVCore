use skills: shadcn-ui, next, nestjs, playwright

# Plan P4 + P7

## P7 — Diagnostic fixture (2 items restants)

### P7.1 — Icônes par raison de rejet

**Où :** `apps/web/app/dashboard/fixtures/components/fixture-diagnostics.tsx`

La colonne "Statut" du tableau "Marchés analysés" affiche le motif de rejet sous forme de texte brut. Ajouter une icône devant chaque type de rejet pour scanner visuellement plus vite.

| Code rejet           | Icône Lucide   | Sens                         |
| -------------------- | -------------- | ---------------------------- |
| `ev_below_threshold` | `TrendingDown` | Valeur insuffisante          |
| `ev_above_hard_cap`  | `ShieldOff`    | Au-dessus du plafond dur     |
| `ev_above_soft_cap`  | `Shield`       | Au-dessus du plafond calibré |
| `market_suspended`   | `Lock`         | Marché suspendu              |
| `no_odds`            | `EyeOff`       | Cotes indisponibles          |
| `insufficient_data`  | `Database`     | Données insuffisantes        |
| Viable (`BET`)       | `CheckCircle`  | Sélection retenue            |

Livrable : composant `RejectionIcon` inline dans `fixture-diagnostics.tsx`, pas de nouvelle dépendance.

---

### P7.2 — Vue simplifiée pour les non-admins

**Où :** `fixture-diagnostics.tsx` + `apps/backend/src/modules/fixture/fixture.controller.ts`

Les données techniques (λ dom./ext., features brutes, qualityScore) sont utiles pour un admin mais opaque pour un user.

**Approche :**

1. Backend : exposer le rôle dans la session (`AuthSession.user.role`). Le champ `role` existe déjà sur le modèle `User` (`ADMIN | USER`).
2. Frontend : hook `useCurrentSession()` → `session.user.role`. Si `role !== "ADMIN"`, masquer :
   - Section lambda (buts attendus bruts)
   - Colonne `qualityScore` dans le tableau
   - Features brutes dans le JSON
3. Pas de nouveau endpoint — même API, filtrage client-side.

**Condition de livraison :** un admin voit tout ; un user voit "Analyse du match" (pick, EV, prob, facteurs lisibles) sans les lambda ni les scores internes.

---

## P4 — Gamification

### Ordre d'exécution recommandé

```
P4.1 Badge model (DB + backend)
  ↓
P4.2 Attribution automatique (backend job)
  ↓
P4.3 Affichage profil + leaderboard
  ↓
P4.4 Avatars
  ↓
P4.5 Weekly brief narratif
```

---

### P4.1 — Modèle de données badges

**Migration Prisma :**

```prisma
model Badge {
  id          String   @id @default(cuid())
  code        String   @unique
  name        String
  description String
  iconUrl     String?
  createdAt   DateTime @default(now())

  users UserBadge[]
}

model UserBadge {
  id         String   @id @default(cuid())
  userId     String
  badgeCode  String
  unlockedAt DateTime @default(now())

  user  User  @relation(fields: [userId], references: [id])
  badge Badge @relation(fields: [badgeCode], references: [code])

  @@unique([userId, badgeCode])
}
```

**Seed des 6 badges MVP :**

| Code       | Condition                                            |
| ---------- | ---------------------------------------------------- |
| `vol_50`   | 50 paris réglés                                      |
| `vol_150`  | 150 paris réglés                                     |
| `vol_300`  | 300 paris réglés                                     |
| `streak_5` | 5 prédictions Canal Confiance correctes consécutives |
| `patience` | Traverser un drawdown ≥ 10 % sans override manuel    |
| `calibre`  | Brier Score < 0,20 sur 50+ prédictions               |

---

### P4.2 — Service d'attribution (backend)

**Nouveau module :** `apps/backend/src/modules/gamification/`

- `gamification.service.ts` : méthode `checkAndAwardBadges(userId)` — appelée après chaque settle de bet ou calcul de Brier Score.
- Logique par badge : requête Prisma pour vérifier la condition → `upsert` sur `UserBadge` (idempotent).
- `gamification.controller.ts` : `GET /gamification/badges/me` (badges de l'utilisateur connecté).

**Intégration :** appeler `checkAndAwardBadges` depuis :

- `BettingEngineService` après settlement
- `RiskService.checkBrierScore` après calcul

---

### P4.3 — Affichage badges

**Profile / Account (`/dashboard/params/account`) :**

- Section "Mes badges" : grille de chips badge (icône + nom). Badges verrouillés affichés en grisé avec condition de déblocage au survol (Tooltip).

**Leaderboard (`/dashboard/performance`) :**

- Nouvelle colonne "Badges" dans `DataTable` : jusqu'à 3 icônes badge inline, `+N` si plus.
- Colonne "Évolution" : delta ROI vs semaine précédente (calculé côté backend via `GET /leaderboard` étendu avec `roiDelta`).

---

### P4.4 — Avatars

**Principe :** bibliothèque d'avatars SVG thématiques stockés dans `public/avatars/`. Deux catégories : disponibles dès le départ (6) + verrouillés (4, débloqués par badge).

**Mapping badge → avatar :**

| Badge      | Avatar débloqué         |
| ---------- | ----------------------- |
| `vol_50`   | `avatar-analyst.svg`    |
| `vol_150`  | `avatar-strategist.svg` |
| `streak_5` | `avatar-striker.svg`    |
| `calibre`  | `avatar-scientist.svg`  |

**Backend :** champ `User.avatarId String?` + `PATCH /auth/me` avec `{ avatarId }`.

**Frontend :**

- Sélecteur d'avatar dans `/dashboard/params/account` : grille 3×3, aperçu en temps réel, cadenas + tooltip sur les verrouillés.
- `UserAvatar` composant partagé (`apps/web/components/user-avatar.tsx`) : affiche l'avatar ou un fallback initiales.
- Leaderboard : `UserAvatar` à côté du username.

---

### P4.5 — Weekly brief narratif

**Backend :**

- Étendre `generateWeeklyReport()` dans `RiskService` pour produire une phrase narrative : `"Cette semaine : N picks · ROI +X% · meilleure compétition : [Y]"`.
- Stocker dans `Notification` (type `WEEKLY_REPORT`, champ `body`).

**Frontend :**

- Widget "Brief de la semaine" dans le dashboard homepage : affiché le lundi, li depuis `GET /notifications?type=WEEKLY_REPORT&limit=1`.
- Masqué les autres jours ou si aucun report disponible.

---

## Dépendances et ordre de livraison global

```
P7.1 (icônes rejet)      — 1 fichier, 1h
P7.2 (vue simplifiée)    — session role + filtrage client, 2h
P4.1 (migration DB)      — 1 migration Prisma, seed, 1h
P4.2 (service badges)    — NestJS module, 3h
P4.3 (affichage badges)  — 2 pages + DataTable, 3h
P4.4 (avatars)           — SVG assets + sélecteur + leaderboard, 4h
P4.5 (weekly brief)      — extension RiskService + widget, 2h
```

Total estimé : ~16h de développement.

met à jour le TODO-UI si tu finis
