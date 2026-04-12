# EVCore — TODO

## Règle migrations DB

- L'agent ne doit **pas** créer de migration Prisma
- Les migrations sont créées manuellement par l'utilisateur
- Pour travailler sans erreurs de types Prisma, l'agent peut utiliser uniquement `db:generate`

---

## État actuel

### Terminé

- Fondations web `fixtures` + filtres + helpers date
- Page `/dashboard/fixtures` responsive
- Refactor dashboard / audit vers architecture domain-based
- Nettoyage du vocabulaire `coupon` côté web et glossaire
- Backend `fixture`, `audit`, `bet-slip`, `auth`
- Data model `User` / `Session` / `BetSlip` / `BetSlipItem`
- Hard delete du domaine coupon côté backend
- Draft panier localStorage + drawer + ajout depuis fixtures
- Auth web branchée sur les sessions backend
- Pages `Mes slips` + détail de slip
- Service worker ajusté pour ne pas polluer le cache en dev

### À faire maintenant

- homogénéisation finale des fetchers web
- vérification fine des parcours mobile

---

## Phase A — Auth web + proxy (priorité)

Le backend d'auth existe déjà. Il faut maintenant brancher correctement le web Next.js sur ce backend, en reprenant le pattern de `fne-flash-ci`, **sans permissions ni RBAC**.

### Cible

- session stockée uniquement en cookie `httpOnly`
- backend NestJS = autorité unique d'auth
- web Next.js = lecture de session via `/auth/me`
- routes `/dashboard/*` protégées
- routes `/auth/*` publiques
- aucune logique de permissions / rôles avancés côté web

### Structure cible

```text
apps/web/
  app/
    (public)/
      auth/
        login/
        register/
        components/
    dashboard/
      ...
  domains/
    auth/
      types/
      use-cases/
      context/   // seulement si nécessaire
  proxy.ts
```

### Livré

- [x] domaine `domains/auth/`
  - [x] `types/`
  - [x] `use-cases/`
  - [ ] `context/` non nécessaire en V1
- [x] `domains/auth/use-cases/get-current-session.ts`
  - [x] lecture des cookies côté serveur
  - [x] forward vers `GET /auth/me`
- [x] `domains/auth/use-cases/auth-request.ts`
  - [x] helper client avec `credentials: "include"`
  - [x] gestion homogène des erreurs backend
- [x] `apps/web/proxy.ts`
  - [x] redirection `/dashboard/*` vers `/auth/login` si pas de session
  - [x] redirection hors de `/auth/login` si session active
- [x] routes / pages auth
  - [x] `app/(public)/auth/login/page.tsx`
  - [x] `app/(public)/auth/register/page.tsx`
  - [x] `app/(public)/auth/components/*`
  - [x] logout côté web
- [x] intégration session dans le shell dashboard
  - [x] affichage de l'utilisateur courant
  - [x] action logout

---

## Phase B — Bet slips web

Le panier draft existe déjà. Il faut terminer le flux utilisateur autour des slips créés.

### Déjà fait

- [x] domaine `domains/bet-slip/` créé (`types`, `use-cases`, `context`)
- [x] draft de panier côté web
- [x] persistance du draft en `localStorage`
- [x] ajout / retrait d'un bet depuis `fixtures`
- [x] drawer panier
- [x] mise unitaire
- [x] overrides de mise
- [x] total du panier
- [x] soumission du draft vers `POST /bet-slips`
- [x] lien de navigation `Mes slips`

### Reste à faire

- [x] geler clairement la composition et les mises après création du `BetSlip`
- [ ] introduire / confirmer le type `BetSlipStake` si utile
- [x] page `mes bet-slips`
- [x] page détail `bet-slips/[id]`
- [x] permettre la gestion explicite de plusieurs slips utilisateur

---

## Phase C — Nettoyage final du vocabulaire coupon

EVCore ne doit plus réintroduire le concept produit de `coupon`.

- [x] supprimer le vocabulaire `coupon` restant dans l'UI et les labels
- [x] nettoyer le glossaire si nécessaire
- [x] retirer les textes shell encore orientés `coupon`
- [ ] éviter toute réintroduction de logique de combiné dans l'UX

---

## Phase D — Polish produit

- [ ] revoir le détail fixture / bet pour extraire des primitives réutilisables
- [ ] homogénéiser les fetchers web vers le backend protégé
- [ ] vérifier les parcours mobile-first sur auth + fixtures + drawer + slips
- [x] vocabulaire : Fixtures → Matchs, Slips → Tickets (labels UI uniquement)
- [x] drawer panier : bouton suppression visible sur mobile + mise unitaire appliquée à la frappe
- [x] card opérateur : ROI global du modèle (bets système `decision=BET`, pondéré par `stakePct`, filtre date)

---

## Phase E — Dashboard opérateur

Remplacer la carte "Performance Globale" (données système globales) par un résumé
personnel pour les utilisateurs non-admin.

### Backend

- [x] `GET /bet-slips/summary` — agrégat par userId : slips créés, bets WON/LOST/PENDING, winRate
- [x] Endpoint protégé par `AuthSessionGuard`, userId déduit de la session
- [x] Filtre optionnel `?date=` sur `fixture.scheduledAt`

### Web

- [x] `domains/bet-slip/use-cases/get-operator-summary.ts`
- [x] `app/dashboard/components/operator-performance-card.tsx`
- [x] `DashboardPageClient` : `isAdmin` → `PerformanceCard`, sinon → `OperatorPerformanceCard`
- [x] Filtre par date sur `OperatorPerformanceCard` (même UX que l'admin)

---

## Backend — statut

### Terminé

- [x] module `auth/`
- [x] login / logout / session courante
- [x] sessions en base
- [x] cookie `httpOnly`
- [x] guards / décorateurs backend
- [x] modèle `User`
- [x] modèle `Session`
- [x] modèle `BetSlip`
- [x] modèle `BetSlipItem`
- [x] hard delete du domaine coupon
- [x] nettoyage dashboard / audit / notifications / scripts liés aux coupons

### Hors scope pour ce projet actuel

- [ ] permissions
- [ ] RBAC

> Note: ces deux sujets sont volontairement hors scope tant que le besoin produit n'existe pas.

---

## Ordre d'exécution

```text
Phase A — Auth web + proxy
→ Phase B — Bet slips web
→ Phase C — Nettoyage final coupon
→ Phase D — Polish produit
```

---

## Notes

- Tous les filtres sont server-side (`searchParams` Next.js, pas de `useState` pour les filtres)
- Un composant = un fichier
- `page.tsx` = assemblage uniquement, pas de logique métier lourde
- `apps/web/constants/` pour les constantes partagées entre domaines
- `constants/` dans chaque domaine si constantes spécifiques au domaine
- La route `(public)` est conservée pour la future landing page
- `packages/ui` est conservé tel quel
- **Jamais de helpers date inline** dans les composants ou use-cases → toujours passer par `lib/date.ts`
- `GET /fixture` → page fixtures
- `GET /audit/fixtures` → page audit
- L'authentification doit être centralisée dans `apps/backend` avec sessions opaques serveur

### PWA / Mobile-first

- L'app est une **PWA installable**
- Toute UI doit être pensée mobile en premier
- Pas de hover-only interactions
- Pas de tooltips desktop-only
- Les filtres fixtures doivent rester accessibles sur petit écran
- La table fixtures sur mobile = cards empilées
- Le détail fixture = drawer mobile / side panel desktop
- Touch targets minimum 44px
