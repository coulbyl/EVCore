# World Cup 2026 — Expérience Web EVCore

Habillage thématique complet de l'app du **11 juin au 19 juillet 2026**.
Tout se déclenche et s'éteint automatiquement via une fenêtre de dates — zéro config manuelle.

---

## Principe d'activation

```typescript
// lib/events/world-cup-2026.ts
export const WC2026 = {
  start: new Date("2026-06-11T00:00:00Z"),
  end: new Date("2026-07-19T23:59:59Z"),
  code: "WC26",
} as const;

export function isWC2026Active(): boolean {
  const now = new Date();
  return now >= WC2026.start && now <= WC2026.end;
}

export function isWC2026Countdown(): boolean {
  const now = new Date();
  const thirtyDaysBefore = new Date(WC2026.start.getTime() - 30 * 86_400_000);
  return now >= thirtyDaysBefore && now < WC2026.start;
}
```

Chaque composant thématique lit `isWC2026Active()` ou `isWC2026Countdown()` — pas de feature flag en base.

---

## 1. Splash Screen

le splash screen sera utile que sur mobile, de manniere  naturel, il y a e dejà un splash screen sur le pwa. il va juste falloir mettre pour le wc26


### Contenu visuel

- Fond sombre avec le trophée FIFA en silhouette (SVG inline)
- Les 3 drapeaux hôtes animés en séquence : 🇺🇸 🇨🇦 🇲🇽
- Texte : `"EVCore · Coupe du Monde 2026"` en grande typo
- Sous-titre : phase en cours (ex. `"Phase de groupes — Journée 2"`)
- Bouton `"Voir les picks"` pour skip

### Implémentation

```
apps/web/components/events/wc2026/
  WC2026Splash.tsx       ← composant splash
  WC2026Splash.css       ← animation keyframes
  trophy.svg             ← silhouette trophée FIFA
```

```typescript
// app/layout.tsx — monter le splash après hydration
<WC2026Splash />  // se rend null si !isWC2026Active() ou déjà vu (sessionStorage)
```

---

## 2. Bannière persistante (header)

**Quand :** pendant tout le tournoi, visible sur toutes les pages.

### Mode countdown (J-30 à J-1)

```
┌─────────────────────────────────────────────────────┐
│  🏆  Coupe du Monde 2026  ·  Dans 23 jours          │
└─────────────────────────────────────────────────────┘
```

### Mode actif (pendant le tournoi)

```
┌─────────────────────────────────────────────────────┐
│  🏆  Phase de groupes J2  ·  12 picks générés       │
│  Dernier résultat : France 2–1 Espagne  ·  Voir →   │
└─────────────────────────────────────────────────────┘
```

### Implémentation

```
apps/web/components/events/wc2026/
  WC2026Banner.tsx
```

```typescript
// app/dashboard/layout.tsx
{isWC2026Active() || isWC2026Countdown() ? <WC2026Banner /> : null}
```

---

## 3. Thème couleur

**Quand :** pendant le tournoi uniquement (pas pendant le countdown).

Swap des CSS tokens sur `:root` via un `data-event="wc2026"` posé sur `<html>`.

```css
/* app/globals.css */
[data-event="wc2026"] {
  --accent: #c9a84c; /* or FIFA */
  --accent-soft: #c9a84c22;
  --canal-ev: #e8b84b;
  --background: #0a0f1e; /* bleu nuit profond */
  --panel: #111827;
  --panel-strong: #1a2236;
}
```

```typescript
// app/layout.tsx
useEffect(() => {
  if (isWC2026Active()) {
    document.documentElement.setAttribute("data-event", "wc2026");
  } else {
    document.documentElement.removeAttribute("data-event");
  }
}, []);
```

---

## 4. Logo EVCore — badge WC26

Superposition d'un badge sur le logo existant pendant le tournoi.

```
 ╔══════════╗
 ║  EVCore  ║ ← logo normal
 ║       🏆 ║ ← badge WC26 en bas à droite (12×12px, pulsé)
 ╚══════════╝
```

```typescript
// components/Logo.tsx
{isWC2026Active() && (
  <span className="absolute -bottom-1 -right-1 animate-pulse text-[10px]">
    🏆
  </span>
)}
```

---

## 5. Section dédiée dans le dashboard

Page ou onglet `"/dashboard/wc2026"` accessible uniquement pendant le tournoi.

### Layout

```
┌─────────────────────────────────────────────┐
│  🏆 Coupe du Monde 2026                     │
│  Phase de groupes · Journée 2 · 18 matchs   │
├─────────────────────────────────────────────┤
│  Groupe A  Groupe B  Groupe C  ...          │  ← tabs groupes
├─────────────────────────────────────────────┤
│  Picks du jour                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ France   │ │ Brésil   │ │ Maroc    │    │
│  │ vs Esp.  │ │ vs All.  │ │ vs Port. │    │
│  │ SV ✓     │ │ EV       │ │ CONF     │    │
│  └──────────┘ └──────────┘ └──────────┘    │
├─────────────────────────────────────────────┤
│  Coupons WC26 générés aujourd'hui           │
│  Coupon #1 · Cote 4.2 · Signal 0.71        │
└─────────────────────────────────────────────┘
```

### Route

```
apps/web/app/dashboard/wc2026/
  page.tsx          ← redirect si !isWC2026Active()
  layout.tsx
  components/
    WC2026Dashboard.tsx
    GroupStageGrid.tsx
    WC2026CouponCard.tsx
```

---

## 6. Confetti — célébration coupon gagné

**Quand :** un coupon `WC26` passe en `result: WIN` pendant le tournoi.

Utiliser `canvas-confetti` (déjà présent dans beaucoup de projets Next.js, 2 Ko gzippé).

```typescript
// hooks/use-wc2026-celebration.ts
import confetti from "canvas-confetti";

export function celebrateWC2026Win() {
  if (!isWC2026Active()) return;
  confetti({
    particleCount: 120,
    spread: 80,
    colors: ["#c9a84c", "#ffffff", "#1a2236"],
    origin: { y: 0.6 },
  });
}
```

Déclenché dans le composant qui affiche le résultat du coupon, au `useEffect` sur `result === 'WIN'`.

---

## 7. Notification in-app — avant chaque match WC26

**Quand :** 30 minutes avant le coup d'envoi d'un fixture `WC26`.

```
🏆  Coupe du Monde  ·  Dans 30 min
    France vs Espagne — Pick EVCore : SV (1X2 · France)
    Cote 2.10  ·  Signal 0.74
```

S'appuie sur le système de notification existant (`/notification`) en ajoutant un type `WC2026_KICKOFF`.

---

## Structure de fichiers cible

```
apps/web/
  lib/
    events/
      world-cup-2026.ts          ← isWC2026Active(), isWC2026Countdown(), WC2026 const
  components/
    events/
      wc2026/
        WC2026Splash.tsx
        WC2026Banner.tsx
        WC2026Badge.tsx           ← badge sur logo
        WC2026CouponCard.tsx
        trophy.svg
  app/
    dashboard/
      wc2026/
        page.tsx
        layout.tsx
        components/
          WC2026Dashboard.tsx
          GroupStageGrid.tsx
  hooks/
    use-wc2026-celebration.ts
```

---

## Checklist d'implémentation

- [ ] `lib/events/world-cup-2026.ts` — helpers de date
- [ ] CSS tokens `[data-event="wc2026"]` dans `globals.css`
- [ ] `WC2026Splash` — splash sessionStorage + animations
- [ ] `WC2026Banner` — countdown puis bannière live
- [ ] Logo badge pulsé
- [ ] Page `/dashboard/wc2026` avec picks et coupons filtrés
- [ ] `canvas-confetti` sur WIN coupon WC26
- [ ] Notification type `WC2026_KICKOFF` (backend + frontend)
- [ ] Tests : vérifier que tout est `null` hors fenêtre de dates

---

## Assets à préparer (design)

| Asset                                         | Format      | Usage                     |
| --------------------------------------------- | ----------- | ------------------------- |
| `trophy.svg`                                  | SVG inline  | Splash screen, bannière   |
| `wc2026-banner-bg.webp`                       | 1440×120 px | Fond bannière             |
| `flag-us.svg` / `flag-ca.svg` / `flag-mx.svg` | SVG         | Splash animation          |
| `wc2026-og.png`                               | 1200×630 px | Open Graph partage social |

Les drapeaux sont disponibles via `flagcdn.com` (CDN gratuit, pas besoin de les stocker localement).

---

## Priorité de livraison

| Sprint                | Livrable                                       |
| --------------------- | ---------------------------------------------- |
| S-1 (avant juin 2026) | helpers date + CSS tokens + bannière countdown |
| S-2 (J-7)             | splash screen + logo badge + page WC26         |
| S-3 (J0+)             | confetti + notification kickoff                |
