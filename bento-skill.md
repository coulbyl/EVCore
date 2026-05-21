---
name: bento
description: Modular grid layout with card-like blocks, clear hierarchy, soft spacing, and subtle visual contrast for organized, scannable interfaces.
license: MIT
metadata:
  author: typeui.sh
---

<!-- TYPEUI_SH_MANAGED_START -->

# Bento Design System Skill (Universal)

## Mission

You are an expert design-system guideline author for Bento.
Create practical, implementation-ready guidance that can be directly used by engineers and designers.

## Brand

The bento box style is an innovative design approach that uses a CSS Grid layout to present content in visually appealing cells of varying sizes. Inspired by Japanese bento boxes — each compartment is self-contained, purposeful, and contributes to a coherent whole. The result is strict, geometric, and hierarchical — not masonry, not free-flow.

---

## Style Foundations

### Typography

| Scale token | Size | Use                         |
| ----------- | ---- | --------------------------- |
| `text-xs`   | 12px | Labels, badges, captions    |
| `text-sm`   | 14px | Secondary body, helper text |
| `text-base` | 16px | Body copy                   |
| `text-lg`   | 20px | Card titles, subheadings    |
| `text-xl`   | 24px | Section headings            |
| `text-2xl`  | 32px | Hero stats, display numbers |

- Primary font: `Inter` (all weights 100–900)
- Mono font: `JetBrains Mono` (code, live data values)
- Line height: `1.4` for body, `1.1` for display numbers
- Letter spacing: `-0.02em` on headings ≥ `text-xl`

### Color Tokens

All tokens are CSS custom properties defined in `packages/ui/src/styles/theme.css` and exposed via Tailwind v4 `@theme inline`. Light/dark switching is handled automatically via the `.dark` class.

| CSS variable           | Tailwind class            | Use                              |
| ---------------------- | ------------------------- | -------------------------------- |
| `--card`               | `bg-card`                 | Default cell background          |
| `--panel`              | `bg-panel`                | Page-level surface, subtle cells |
| `--panel-strong`       | `bg-panel-strong`         | Elevated card surface            |
| `--sidebar`            | `bg-sidebar`              | Inverted / dark accent cells     |
| `--foreground`         | `text-foreground`         | Default body text                |
| `--muted-foreground`   | `text-muted-foreground`   | Secondary text, captions         |
| `--sidebar-foreground` | `text-sidebar-foreground` | Text on inverted cells           |
| `--border`             | `border-border`           | Cell borders                     |
| `--ring`               | `ring-ring`               | Keyboard focus rings             |
| `--accent`             | `bg-accent`               | Primary accent fill (teal)       |
| `--accent-soft`        | `bg-accent-soft`          | Subtle accent background         |
| `--success`            | `text-success`            | Positive deltas, confirmations   |
| `--warning`            | `text-warning`            | Alerts, degraded states          |
| `--danger`             | `text-danger`             | Errors, negative deltas          |
| `--skeleton`           | `bg-skeleton`             | Skeleton shimmer base            |

Canal identity tokens for sport prediction cells:
`--canal-ev`, `--canal-sv`, `--canal-conf`, `--canal-draw`, `--canal-btts` — each with a `-soft` variant for backgrounds.

Dark mode is applied automatically when the `html` element has the `.dark` class — no separate override needed.

### Spacing Scale

`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64` (px)

- Base unit: 4px
- Gap between cells: **12px default** — never below 8px, never above 20px
- Internal cell padding: `16px` (compact) / `24px` (default) / `32px` (spacious)
- Section vertical rhythm: multiples of 32px

### Elevation & Shadow Tokens

Defined in `theme.css` as `--shadow-bento-*`, exposed as Tailwind utilities.

| CSS variable           | Tailwind class       | Use                   |
| ---------------------- | -------------------- | --------------------- |
| `--shadow-bento-rest`  | `shadow-bento-rest`  | Default resting cell  |
| `--shadow-bento-hover` | `shadow-bento-hover` | Hover / focused cell  |
| `--shadow-bento-drag`  | `shadow-bento-drag`  | Dragged or modal cell |

Dark mode values are stronger (higher opacity) and defined separately in `.dark` in `theme.css`. Never stack more than one elevation per cell.

### Border Radius

The single bento cell radius is `--radius-bento: 12px`, applied via the `bento-cell` or `bento-cell-interactive` utility class. Inner elements (badges, chips) use `rounded-sm` (8px). All cells in a grid share the same radius — never mix.

---

## Grid System

### Core Structure

Bento grids use **CSS Grid** exclusively. Do not use Flexbox for the outer grid.

```css
.bento-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 12px; /* var(--gap-bento, 12px) */
}
```

### Column Span Vocabulary

| Span class    | Columns | Label      |
| ------------- | ------- | ---------- |
| `col-span-3`  | 3/12    | Quarter    |
| `col-span-4`  | 4/12    | Third      |
| `col-span-6`  | 6/12    | Half       |
| `col-span-8`  | 8/12    | Two-thirds |
| `col-span-12` | 12/12   | Full       |

### Row Span Vocabulary

| Span class   | Rows    | Label    |
| ------------ | ------- | -------- |
| `row-span-1` | 1 unit  | Compact  |
| `row-span-2` | 2 units | Standard |
| `row-span-3` | 3 units | Tall     |

Row height unit: `minmax(120px, auto)` — cells grow with content, never collapse below 120px.

### Named Span Patterns

| Pattern | Columns × Rows  | Typical Use             |
| ------- | --------------- | ----------------------- |
| `1×1`   | 3 col × 1 row   | Stat counter, badge     |
| `2×1`   | 6 col × 1 row   | Metric with sparkline   |
| `1×2`   | 3 col × 2 rows  | Vertical list, timeline |
| `2×2`   | 6 col × 2 rows  | Chart, map, feature     |
| `3×2`   | 9 col × 2 rows  | Hero card, editorial    |
| `4×2`   | 12 col × 2 rows | Full-width banner       |

A single grid must contain at least one `2×2` or larger cell — a grid of only `1×1` cells is not a bento grid.

### Information Hierarchy via Size

- **Primary content** → largest cell (`3×2` or `4×2`), top-left or top-center
- **Supporting metrics** → `2×1` or `2×2`
- **Secondary info** → `1×1` or `1×2`

Never place primary content in a `1×1` cell.

### Responsive Breakpoints

| Breakpoint            | Columns    | Gap  |
| --------------------- | ---------- | ---- |
| `< 640px` (mobile)    | 2 columns  | 8px  |
| `640–1024px` (tablet) | 6 columns  | 10px |
| `≥ 1024px` (desktop)  | 12 columns | 12px |

At mobile, all cells collapse to `col-span-2` (full-width) or `col-span-1` (half-width) — never maintain desktop spans below 640px.

---

## Cell Anatomy

Every bento cell is composed of up to 4 zones:

```
┌─────────────────────────────────┐
│ [Header Zone]  label / eyebrow  │  ← optional
│─────────────────────────────────│
│                                 │
│ [Body Zone]    primary content  │  ← required
│                                 │
│─────────────────────────────────│
│ [Media Zone]   image / chart    │  ← optional
│─────────────────────────────────│
│ [Footer Zone]  action / meta    │  ← optional
└─────────────────────────────────┘
```

- **Header Zone**: `text-xs` label (`text-muted`), icon, or category badge — max 1 line
- **Body Zone**: primary text or data — may be a stat, paragraph, or interactive element
- **Media Zone**: image, chart, illustration — always `overflow: hidden` with `border-radius` inherited from cell
- **Footer Zone**: CTA link, timestamp, avatar, or secondary action — `text-sm`, pinned to bottom with `margin-top: auto`

### Cell Variants by Content Type

#### Stat Cell (`1×1` or `2×1`)

- Body: large number in `text-2xl`, `font-weight: 700`
- Header: metric label in `text-xs`, `text-muted`
- Footer: delta indicator (▲ / ▼) with `success` or `danger` token

#### Media Cell (`2×2` or `3×2`)

- Media Zone fills the lower 60% of the cell
- Header floats above image with semi-transparent background overlay
- Overlay: `background: linear-gradient(to bottom, transparent, rgba(17,24,39,0.6))`

#### Text/Editorial Cell (`2×1` or `2×2`)

- Body: `text-base` body copy, max 3 lines before truncation
- Footer: read-more link or author attribution

#### Chart Cell (`2×2` or `3×2`)

- Media Zone: chart rendered with `overflow: hidden`, no internal padding
- Header: chart title + optional time-range toggle
- Footer: legend (max 3 items inline)

#### Action Cell (`1×1` or `2×1`)

- Body: single CTA button, centered
- Background: `primary` or `surface-inverted` token for visual contrast
- Text: `text-inverted`

#### Empty State Cell

- Body: centered icon (`32px`) + short message (`text-sm`, `text-muted`)
- Border: `1px dashed border` token
- No shadow

---

## Interaction States

All interactive cells must define these states explicitly:

| State           | Visual change                                                                    |
| --------------- | -------------------------------------------------------------------------------- |
| `default`       | `shadow-sm`, `border: 1px solid border`                                          |
| `hover`         | `shadow-md`, border-color → `secondary`, `transform: translateY(-1px)`           |
| `focus-visible` | `outline: 2px solid border-focus`, `outline-offset: 2px` — never `outline: none` |
| `active`        | `transform: translateY(0)`, `shadow-sm`                                          |
| `disabled`      | `opacity: 0.4`, `pointer-events: none`, `cursor: not-allowed`                    |
| `loading`       | Skeleton shimmer replaces body zone content                                      |
| `error`         | Left border `4px solid danger`, body replaced with error message                 |
| `selected`      | `background: primary` at 20% opacity, border → `primary`                         |

Hover and active transitions: `transition: all 150ms ease-out`.

### Loading Skeleton

- Shimmer animation: `background: linear-gradient(90deg, surface-subtle 25%, surface-raised 50%, surface-subtle 75%)`
- Animation: `shimmer 1.5s infinite`
- Skeleton lines must match the approximate height/width of the content they replace
- Never show a skeleton for less than 300ms — debounce to avoid flash

---

## Motion & Animation

- Cell entrance: `opacity 0 → 1` + `translateY(8px → 0)` — `200ms ease-out`
- Stagger delay for multi-cell entrance: `30ms` per cell, left-to-right, top-to-bottom
- Hover lift: `translateY(-1px)` — `150ms ease-out`
- Value change (stat cells): number morphs with `tabular-nums` — no animation required, but use `transition: opacity 100ms`
- Respect `prefers-reduced-motion`: all transforms and opacity transitions must be disabled when active

---

## Accessibility Requirements

- WCAG 2.2 AA minimum — aim for AAA on text contrast
- All interactive cells must be keyboard-navigable with Tab and activatable with Enter/Space
- `focus-visible` must never be hidden — `outline: none` is prohibited
- Media cells with decorative images: `alt=""`. Meaningful images: descriptive `alt` text required
- Screen readers: each cell must have a meaningful accessible name via `aria-label` or visible heading
- Stat cells: announce delta changes with `aria-live="polite"` if value updates in place
- Color must never be the **only** differentiator — pair color tokens with icons, labels, or patterns
- Minimum touch target on interactive cells: `44×44px`

### Testable Acceptance Criteria

- [ ] Tab order follows DOM order (left-to-right, top-to-bottom)
- [ ] No cell receives focus that is not interactive
- [ ] Focus ring visible at 200% zoom
- [ ] Color contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text (≥ 18px bold or ≥ 24px)
- [ ] Screen reader announces cell heading before body content
- [ ] `prefers-reduced-motion` disables all transforms

---

## Content & Tone Standards

- Cell headings: sentence case, ≤ 4 words — `"Active bets"` not `"Currently Active Betting Positions"`
- Stat labels: noun phrases, no verbs — `"Win rate"` not `"Showing win rate"`
- Delta labels: explicit sign and unit — `"+2.4%"` not `"up"`
- Empty state messages: action-oriented — `"No data yet — run a simulation"` not `"Empty"`
- Error messages: describe cause + next step — `"Could not load odds — retry"` not `"Error"`
- CTAs: verb + object — `"View report"` not `"Click here"`
- Truncate long content with `…` — never hide overflow without a tooltip or expand affordance

---

## Anti-Patterns & Prohibited Implementations

| Anti-pattern                                                   | Why prohibited                                        | Correct alternative                               |
| -------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| `display: flex; flex-wrap: wrap` for the grid                  | No explicit control over cell placement               | `display: grid` with named spans                  |
| Mixing `radius-md` and `radius-lg` in the same grid            | Breaks visual rhythm                                  | Standardize to one radius level per grid instance |
| All cells `1×1`                                                | Not a bento — it's a uniform tile grid                | Include at least one `2×2`+ cell                  |
| Shadow level > `shadow-md` on resting card                     | Over-elevation, competes with modal/overlay hierarchy | Use `shadow-sm` at rest, `shadow-md` on hover     |
| `outline: none` on focused cell                                | WCAG failure                                          | Replace with `outline: 2px solid border-focus`    |
| Hard-coded pixel values for gaps                               | Breaks at non-standard densities                      | Use `var(--gap-bento)` token                      |
| Stacking a chart + text + action in a `1×1` cell               | Content overflow, unreadable                          | Use `2×2` minimum for compound content            |
| Animating layout properties (`width`, `height`, `grid-column`) | Causes reflow/jank                                    | Animate `transform` and `opacity` only            |
| Static placeholder text in empty cells (`"N/A"`)               | Ambiguous                                             | Use structured empty state with icon + message    |
| Removing borders and shadows simultaneously                    | Cell loses its containment edge                       | Always keep at least one visual boundary          |

---

## Guideline Authoring Workflow

1. Restate the design intent in one sentence before proposing rules.
2. Define tokens and foundational constraints before component-level guidance.
3. Specify component anatomy, states, variants, and interaction behavior.
4. Include accessibility acceptance criteria and content-writing expectations.
5. Add anti-patterns and migration notes for existing inconsistent UI.
6. End with a QA checklist that can be executed in code review.

---

## Required Output Structure

When generating design-system guidance, use this structure:

- Context and goals
- Design tokens and foundations
- Grid system (columns, gaps, spans, breakpoints)
- Component-level rules (anatomy, variants, states, responsive behavior)
- Accessibility requirements and testable acceptance criteria
- Content and tone standards with examples
- Anti-patterns and prohibited implementations
- QA checklist

---

## Component Rule Expectations

- Define required states: `default`, `hover`, `focus-visible`, `active`, `disabled`, `loading`, `error`, `selected` (as relevant).
- Describe interaction behavior for keyboard, pointer, and touch.
- State spacing, typography, and color-token usage explicitly.
- Include responsive behavior and edge cases (long labels, empty states, overflow, single-item grid).

---

## Quality Gates

- No rule should depend on ambiguous adjectives alone — anchor each rule to a token, threshold, or example.
- Every accessibility statement must be testable in implementation.
- Prefer system consistency over one-off local optimizations.
- Flag conflicts between aesthetics and accessibility, then prioritize accessibility.

---

## Example Constraint Language

- Use "must" for non-negotiable rules and "should" for recommendations.
- Pair every do-rule with at least one concrete don't-example.
- If introducing a new pattern, include migration guidance for existing components.

---

## Usage concret dans un composant

Les utilitaires `bento-grid`, `bento-rows`, `bento-cell`, `bento-cell-interactive` et `bento-skeleton` sont définis dans `globals.css` et disponibles comme n'importe quelle classe Tailwind. La `Card` shadcn sert de primitive de cellule.

```tsx
<div className="bento-grid bento-rows">
  {/* Stat 2×1 */}
  <Card className="col-span-6 row-span-1 bento-cell-interactive">
    <CardHeader>
      <CardTitle className="text-xs text-muted-foreground">EV moyen</CardTitle>
    </CardHeader>
    <CardContent>
      <span className="text-2xl font-bold tabular-nums">+12.4%</span>
    </CardContent>
  </Card>

  {/* Feature 2×2 */}
  <Card className="col-span-6 row-span-2 bento-cell-interactive">
    <CardHeader>
      <CardTitle>Performances</CardTitle>
    </CardHeader>
    <CardContent>{/* chart */}</CardContent>
  </Card>

  {/* Stat 1×1 — loading */}
  <div className="col-span-3 row-span-1 bento-cell bento-skeleton" />

  {/* Action cell — inverted */}
  <Card className="col-span-3 row-span-1 bento-cell-interactive bg-sidebar text-sidebar-foreground">
    <CardContent className="flex items-center justify-center h-full">
      <Button variant="ghost">Lancer simulation</Button>
    </CardContent>
  </Card>
</div>
```

---

## QA Checklist (Code Review)

### Grid

- [ ] Outer container uses `display: grid`, not Flexbox
- [ ] `gap` uses `var(--gap-bento)` token, not hardcoded px
- [ ] At least one cell spans `≥ 2 columns × 2 rows`
- [ ] All cells collapse to full-width or half-width below 640px

### Cells

- [ ] All cells use `bento-cell` or `bento-cell-interactive` — no hand-rolled border-radius or shadow
- [ ] Interactive cells use `bento-cell-interactive`, static cells use `bento-cell`
- [ ] `transition` is `150ms ease-out` for hover, `200ms ease-out` for entrance
- [ ] No cell mixes more than 3 zones (header + body + one of media or footer)

### Tokens

- [ ] No raw hex values — all colors reference a `--variable` or Tailwind semantic class
- [ ] No raw `px` gaps — gap uses `var(--gap-bento)` via the `bento-grid` utility
- [ ] Dark mode handled by `html.dark` — no manual dark: overrides needed for bento tokens

### Accessibility

- [ ] Every interactive cell has a visible `focus-visible` ring
- [ ] No `outline: none` in stylesheets
- [ ] Stat delta values announced via `aria-live`
- [ ] Color contrast verified programmatically (Axe, Storybook a11y)
- [ ] All transforms disabled under `prefers-reduced-motion`

### Content

- [ ] No cell heading exceeds 4 words
- [ ] Empty states include icon + action-oriented message
- [ ] Error states include cause + recovery step
- [ ] No truncated content without a tooltip or expand affordance

<!-- TYPEUI_SH_MANAGED_END -->
