# React Email — `@evcore/transactional`

Package dédié aux templates email HTML d'EVCore, construit sur `@react-email`. Séparé du backend pour permettre le dev server live, l'isolation des dépendances React, et la réutilisabilité en phase 3 (web app, multi-tenant).

Référence d'implémentation : `~/lab/coulby-studio/paideia/apps/api/src/mail/`
Doc officielle : https://react.email/docs/getting-started/monorepo-setup/pnpm

---

## Stack

| Couche           | Techno                          |
| ---------------- | ------------------------------- |
| Composants email | `@react-email/components`       |
| Rendu HTML/texte | `@react-email/render`           |
| Dev server live  | `react-email` (`email dev`)     |
| Transport        | Nodemailer (dans le backend)    |
| Dev SMTP         | Mailpit (:1025 SMTP / :8025 UI) |

---

## Structure

```
packages/transactional/
├── src/
│   ├── emails/
│   │   ├── layouts/
│   │   │   └── evcore-layout.tsx    ← layout commun (dark, monospace)
│   │   ├── roi-alert.tsx
│   │   ├── market-suspension.tsx
│   │   ├── brier-alert.tsx
│   │   ├── etl-failure.tsx
│   │   ├── weight-adjustment.tsx
│   │   └── weekly-report.tsx
│   ├── types.ts                     ← RenderedEmail + Props types
│   ├── render.ts                    ← renderEmail() wrapper interne
│   └── index.ts                     ← API publique (render* functions + types)
├── tsconfig.json
└── package.json
```

---

## Design — API publique

Le backend n'importe **jamais** React directement. Il appelle des fonctions render pré-wrappées :

```typescript
// Dans NotificationService
import { renderRoiAlert } from "@evcore/transactional";

const { html, text } = await renderRoiAlert({
  market: "ONE_X_TWO",
  roi: -0.14,
  betCount: 55,
});
await this.sendEmail(title, html, text);
```

**Pas de `createElement`, pas de JSX, pas de `react` dans le backend.**

Chaque fichier template exporte deux choses :

1. Le composant React (`RoiAlertEmail`) → utilisé par le dev server `email dev`
2. La fonction render wrappée (`renderRoiAlert`) → API publique

```typescript
// Pattern dans chaque template
export function RoiAlertEmail(props: RoiAlertProps) {
  /* JSX */
}

export const renderRoiAlert = (props: RoiAlertProps) =>
  renderEmail(createElement(RoiAlertEmail, props));
```

---

## Dev server (prévisualisation live)

```bash
pnpm --filter @evcore/transactional dev
# → http://localhost:3000 — tous les templates prévisualisables avec hot reload
```

Le dev server (`email dev --dir src/emails`) détecte automatiquement tous les fichiers `.tsx` dans `src/emails/` et affiche un aperçu rendu dans le navigateur.

---

## Build

```bash
pnpm --filter @evcore/transactional build
# Compile tsx → JS CommonJS dans dist/
# Génère les .d.ts pour le backend TypeScript
```

Turbo rebuilde automatiquement `@evcore/transactional` avant le backend grâce à `"dependsOn": ["^build"]`.

---

## Intégration backend — `NotificationService`

Modifier `sendEmail()` pour accepter `html` et `text` :

```typescript
private async sendEmail(subject: string, html: string, text: string): Promise<void> {
  // ...
  await this.transporter.sendMail({
    from: this.smtpFrom,
    to: this.smtpTo,
    subject: `[EVCore] ${subject}`,
    html,
    text,
  });
}
```

Remplacer chaque méthode alert. Exemple `sendRoiAlert` :

```typescript
import { renderRoiAlert } from '@evcore/transactional';

async sendRoiAlert(market: Market, roi: number, betCount: number): Promise<void> {
  const title = `ROI Alert — ${market}`;
  const body = `ROI ${(roi * 100).toFixed(2)}% over ${betCount} bets`;
  await this.save(NotificationType.ROI_ALERT, title, body, { market, roi, betCount });

  const { html, text } = await renderRoiAlert({ market: String(market), roi, betCount });
  await this.sendEmail(title, html, text);
}
```

> `market` est passé comme `string` (pas l'enum Prisma) — `@evcore/transactional` ne dépend pas de `@evcore/db`.

---

## Ajouter un nouveau template

1. Créer `src/emails/mon-template.tsx` avec le composant + `renderMonTemplate()`
2. Exporter depuis `src/index.ts`
3. Appeler depuis le backend : `import { renderMonTemplate } from '@evcore/transactional'`

---

## Configuration TypeScript

`packages/transactional/tsconfig.json` étend `@evcore/typescript-config/react-library.json` (déjà `jsx: "react-jsx"`).
Override `module: CommonJS` pour compatibilité avec le backend NestJS.

Le backend n'a **pas** besoin de `@types/react` — il ne voit que les types de `RenderedEmail` et des Props (plain objects).

---

## Pitfalls connus

| Problème                                  | Fix                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `render()` async depuis v1.x              | Toujours `await render(...)`                                                                     |
| Styles ignorés par certains clients email | CSS inline uniquement — jamais de classes                                                        |
| `noUncheckedIndexedAccess` strict         | Vérifier que les props optionnelles sont narrowed avant usage                                    |
| Catalog version mismatch                  | Vérifier `pnpm-workspace.yaml` → `@react-email/components`, `@react-email/render`, `react-email` |
