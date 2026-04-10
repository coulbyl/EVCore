# EVCore — TODO

## Web responsive + PWA mobile-like

### Objectif

Transformer la console web actuelle en expérience mobile crédible sans dupliquer l'application:

- corriger le shell desktop-first actuel
- rendre les écrans dashboard utilisables sur téléphone
- ajouter ensuite une couche PWA installable

### Principes

- ne pas commencer par le manifest PWA seul
- traiter d'abord la responsivité structurelle
- conserver une seule base UI avec variantes desktop/mobile
- privilégier une sensation app native: navigation simple, surfaces compactes, drawers plein écran mobile

### Phase 1 — Audit responsive

- cartographier les composants bloquants côté mobile
- identifier les largeurs minimales, zones scrollables et `overflow-hidden` problématiques
- lister les composants desktop-only dans `packages/ui` et `apps/web`
- définir les breakpoints cibles:
  - mobile: `< 768px`
  - tablet: `768px - 1023px`
  - desktop: `>= 1024px`

### Phase 2 — Shell responsive

- refondre `packages/ui/src/components/page-shell.tsx`
- conserver la sidebar actuelle sur desktop
- remplacer la sidebar par une navigation mobile:
  - top bar compacte
  - bottom navigation fixe
- supprimer les blocages liés à `h-screen` + `overflow-hidden` quand ils cassent le scroll mobile
- garantir le respect des safe areas iOS
- rendre le `main` scrollable correctement sur mobile et desktop

### Phase 3 — Fondations UI partagées

- ajouter le hook `useIsMobile` de shadcn dans `apps/web`
- centraliser la détection mobile dans ce hook plutôt que dupliquer les conditions de viewport
- utiliser `useIsMobile` pour piloter:
  - shell mobile vs desktop
  - variantes cards vs table
  - drawers full-screen / side panel
  - densité du header et des actions
- adapter `packages/ui/src/components/page.tsx`
- adapter `apps/web/components/app-page-header.tsx`
- réduire les paddings, rayons et hauteurs sur petits écrans
- revoir les grilles trop denses en variantes `grid-cols-1` ou `grid-cols-2`
- vérifier les états sticky et backdrop sur mobile

### Phase 4 — Dashboard mobile

- rendre la page dashboard lisible sans zoom sur téléphone
- convertir les tableaux critiques en cartes ou listes empilées sur mobile
- afficher les KPI en 1 colonne sur mobile, 2 colonnes sur tablet, grille dense sur desktop
- transformer les panneaux secondaires en sections collapsibles ou drawers
- préserver les actions clés:
  - refresh
  - sélection d'un match
  - lecture des alertes
  - consultation des coupons

### Phase 5 — Composants métier à adapter

- `apps/web/components/opportunities-table.tsx`
  - vue table sur desktop
  - vue cards sur mobile
- `apps/web/components/recent-coupons-card.tsx`
  - améliorer la liste mobile
  - faire passer le drawer en plein écran ou bottom sheet sur mobile
- `apps/web/components/fixture-detail-panel.tsx`
  - revoir la densité d'information et la hiérarchie mobile
- `apps/web/components/activity-feed.tsx`
  - vérifier le wrapping, les badges et les timestamps

### Phase 6 — Polish mobile-like

- ajouter une bottom nav avec état actif clair
- harmoniser les hauteurs tactiles
- améliorer les zones d'appui et le spacing vertical
- stabiliser les interactions drawer/sheet
- éviter les tables horizontales scrollables comme solution par défaut

### Phase 7 — PWA ✅

- ~~ajouter un `manifest.webmanifest`~~ → `app/manifest.ts` (Next.js MetadataRoute)
- ~~déclarer nom, icônes, `theme_color`, `background_color`, `display: standalone`~~
- ~~ajouter les meta tags PWA dans le layout Next~~ → `viewport` export + `appleWebApp`
- ~~générer les icônes nécessaires~~ → SVG source + 4 PNG (192, 512, maskable-512, apple-touch-icon 180)
- vérifier le comportement "Add to Home Screen" — à tester sur device
- ~~prévoir un cache minimal des assets statiques~~ → `public/sw.js` cache-first `/_next/static/` + icônes
- ~~ne pas introduire d'offline métier complexe dans la première version~~

### Phase 8 — Validation

- tester sur tailles:
  - iPhone SE / 375px
  - iPhone standard / 390px
  - Android ~412px
  - tablet / 768px
  - desktop / 1280px+
- vérifier:
  - navigation
  - scroll vertical
  - drawers
  - tableaux/listes
  - boutons d'action
  - lisibilité des KPI
- lancer `pnpm lint`
- lancer `pnpm typecheck`

### Ordre d'implémentation recommandé

1. shell responsive
2. header et primitives de page
3. dashboard principal
4. composants métier les plus denses
5. polish mobile-like
6. couche PWA
7. validation multi-device

### V1 cible

- une seule app web
- dashboard entièrement utilisable sur mobile
- navigation mobile claire
- coupons et opportunités consultables sans friction
- app installable sur écran d'accueil
