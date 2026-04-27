# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: responsive.spec.ts >> account — pas de scroll horizontal @responsive
- Location: e2e/responsive.spec.ts:22:3

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/dashboard\/params\/account.*/
Received string:  "http://localhost:3000/auth/login"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    9 × unexpected value "http://localhost:3000/auth/login"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]:
          - paragraph [ref=e7]: EVCore
          - heading "Retrouvez vos matchs, vos sélections et vos coupons au même endroit." [level=1] [ref=e8]
          - paragraph [ref=e9]: Un point d'entrée sobre pour revenir à l'analyse, consulter vos coupons et poursuivre votre journée sans détour.
        - generic [ref=e10]:
          - generic [ref=e11]: Coupons suivis
          - generic [ref=e12]: Matchs du jour
        - paragraph [ref=e14]: Un accès simple pour se connecter, retrouver ses coupons et reprendre la journée sans détour.
      - generic [ref=e16]:
        - paragraph [ref=e17]: Authentification
        - heading "Connexion" [level=2] [ref=e18]
        - paragraph [ref=e19]: Connectez-vous pour retrouver votre espace et vos coupons.
        - generic [ref=e21]:
          - generic [ref=e22]:
            - generic [ref=e23]: Email ou username
            - textbox "Email ou username" [ref=e24]:
              - /placeholder: amine ou amine@evcore.app
          - generic [ref=e25]:
            - generic [ref=e26]: Mot de passe
            - textbox "Mot de passe" [ref=e27]:
              - /placeholder: ••••••••
          - button "Se connecter" [ref=e28]
          - paragraph [ref=e29]:
            - text: Pas encore de compte ?
            - link "Créer un compte" [ref=e30] [cursor=pointer]:
              - /url: /auth/register
  - button "Open Next.js Dev Tools" [ref=e36] [cursor=pointer]:
    - img [ref=e37]
  - alert [ref=e40]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | /**
  4  |  * Viewport smoke tests — run on three projects (375 / 768 / 1280).
  5  |  * Each test checks:
  6  |  *  1. Auth cookie is accepted → no redirect to /auth/login
  7  |  *  2. Main content area renders
  8  |  *  3. No horizontal overflow
  9  |  */
  10 | 
  11 | const PAGES = [
  12 |   { name: "dashboard", path: "/dashboard" },
  13 |   { name: "fixtures", path: "/dashboard/fixtures" },
  14 |   { name: "bankroll", path: "/dashboard/bankroll" },
  15 |   { name: "bet-slips", path: "/dashboard/bet-slips" },
  16 |   { name: "picks", path: "/dashboard/picks" },
  17 |   { name: "account", path: "/dashboard/params/account" },
  18 |   { name: "audit", path: "/dashboard/audit" },
  19 | ] as const;
  20 | 
  21 | for (const { name, path } of PAGES) {
  22 |   test(`${name} — pas de scroll horizontal @responsive`, async ({ page }) => {
  23 |     await page.goto(path);
  24 | 
  25 |     // Confirm auth worked — no redirect to login
> 26 |     await expect(page).toHaveURL(new RegExp(path.replace("/", "\\/") + ".*"));
     |                        ^ Error: expect(page).toHaveURL(expected) failed
  27 | 
  28 |     // Main content must be visible (not a blank screen)
  29 |     await expect(page.locator("main").first()).toBeVisible();
  30 | 
  31 |     // No horizontal overflow
  32 |     const overflows = await page.evaluate(() => ({
  33 |       bodyScrollWidth: document.body.scrollWidth,
  34 |       windowInnerWidth: window.innerWidth,
  35 |     }));
  36 |     expect(overflows.bodyScrollWidth).toBeLessThanOrEqual(
  37 |       overflows.windowInnerWidth,
  38 |     );
  39 |   });
  40 | }
  41 | 
```