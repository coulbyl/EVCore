# COMPONENTS — @evcore/ui

Référence de tous les composants du design system EVCore.
Mis à jour : 2026-04-26.

---

## Architecture

```
packages/ui/src/components/   ← @evcore/ui  primitifs + composites génériques
apps/web/components/          ← wrappers app-web (charts Recharts, AppShell…)
apps/web/app/dashboard/[f]/   ← composants feature-spécifiques
```

**Règle fondamentale** : les pages et composants feature ne doivent pas contenir de classes de design (couleurs, bordures, ombres, arrondis, espacements internes). Toute décision visuelle vit dans `@evcore/ui`. Les pages composent des composants, elles ne les stylent pas.

```tsx
// ✗ à éviter dans une page
<div className="rounded-2xl border border-border bg-white p-5 shadow-sm">...</div>

// ✓ correct
<TableCard title="...">...</TableCard>
```

---

## Ajouter un composant

### Primitif shadcn (recommandé en premier)

```bash
cd packages/ui
pnpm dlx shadcn@latest info --json   # vérifier le contexte projet
pnpm dlx shadcn@latest docs <nom>    # lire la doc avant de coder
pnpm dlx shadcn@latest add <nom>     # copie le composant dans src/components/
```

Ensuite :

1. Vérifier que les dépendances ajoutées utilisent `catalog:` dans `package.json`
2. Exporter depuis `src/index.ts`

### Composite manuel (non registré shadcn)

Créer directement dans `packages/ui/src/components/<nom>.tsx` :

- Utiliser uniquement des tokens CSS (`text-foreground`, `bg-panel`, `border-border`…)
- Pas de couleurs Tailwind hardcodées (`bg-white`, `text-slate-700`…)
- Exporter le type si nécessaire (ex : `export type FilterDef`)
- Ajouter l'export dans `src/index.ts`

---

## Tokens CSS disponibles

Définis dans `src/styles/theme.css`, disponibles en light et dark :

| Token                       | Usage                                       |
| --------------------------- | ------------------------------------------- |
| `bg-background`             | Fond principal de la page                   |
| `bg-panel`                  | Surfaces de premier niveau (cards, sidebar) |
| `bg-panel-strong`           | Surfaces renforcées (panels imbriqués)      |
| `bg-secondary`              | Fond d'input, zones alternatives            |
| `text-foreground`           | Texte principal                             |
| `text-muted-foreground`     | Labels, sous-titres, placeholders           |
| `border-border`             | Bordures standard                           |
| `text-accent` / `bg-accent` | Couleur d'accentuation EVCore (teal)        |

---

## Responsive review

Toute UI considérée terminée doit être relue à trois largeurs minimales :

- `375px` : mobile compact, navigation au pouce, aucun débordement horizontal
- `768px` : tablette, densité intermédiaire, headers/actions encore lisibles
- `1280px` : desktop, hiérarchie stable, pas d'étirement visuel excessif

Règles d'application :

- Les composants utilisent `gap-*`, jamais `space-x-*` ou `space-y-*`
- Les tables complexes doivent prévoir un fallback mobile via `DataTable.mobileCard`
- Les drawers/sheets mobiles servent à la consultation de détail ou aux filtres condensés, pas à réinventer tout le layout desktop
- Toute nouvelle variation responsive doit être absorbée dans `@evcore/ui` avant d'être copiée dans une feature

---

## Catalogue des composants

### Primitifs shadcn (ne pas modifier directement)

| Composant    | Fichier           | Usage                                                        |
| ------------ | ----------------- | ------------------------------------------------------------ |
| `Badge`      | `badge.tsx`       | Badge shadcn utilisé directement, avec variantes EVCore      |
| `Button`     | `button.tsx`      | Bouton shadcn utilisé directement                            |
| `Calendar`   | `calendar.tsx`    | Calendrier Radix (base de `DatePicker`)                      |
| `Card`       | `card.tsx`        | Card shadcn (préférer `TableCard` ou `StatCard`)             |
| `Checkbox`   | `checkbox.tsx`    | Case à cocher Radix                                          |
| `Command`    | `command.tsx`     | Palette de commande (base de `Combobox`)                     |
| `Dialog`     | `dialog.tsx`      | Modale Radix                                                 |
| `Empty`      | `empty.tsx`       | État vide shadcn composé (`EmptyHeader`, `EmptyTitle`, etc.) |
| `Input`      | `input.tsx`       | Champ texte                                                  |
| `Popover`    | `popover.tsx`     | Popover Radix (base de `DatePicker`, `Combobox`)             |
| `RadioGroup` | `radio-group.tsx` | Groupe de boutons radio Radix                                |
| `Select`     | `select.tsx`      | Dropdown Radix                                               |
| `Separator`  | `separator.tsx`   | Ligne de séparation                                          |
| `Sheet`      | `sheet.tsx`       | Drawer latéral Radix (utilisé dans `FilterBar` mobile)       |
| `Skeleton`   | `skeleton.tsx`    | Placeholder de chargement                                    |
| `Switch`     | `switch.tsx`      | Toggle Radix                                                 |
| `Table`      | `table.tsx`       | Table HTML stylée (base de `DataTable`)                      |
| `Tabs`       | `tabs.tsx`        | Onglets Radix                                                |
| `Tooltip`    | `tooltip.tsx`     | Info au survol Radix                                         |

---

### Composants EVCore

#### `Badge`

Badge shadcn avec variantes sémantiques EVCore.

```tsx
<Badge variant="success">Viable</Badge>
<Badge variant="destructive">Rejeté</Badge>
<Badge variant="warning">En attente</Badge>
<Badge variant="neutral">Inactif</Badge>
<Badge variant="accent">EV</Badge>
```

#### `Button`

Bouton shadcn avec variantes standard.

```tsx
<Button>Confirmer</Button>
<Button variant="secondary">Annuler</Button>
<Button variant="ghost">Voir tout</Button>
<Button size="xs">Mini</Button>
```

#### `Empty`

État vide shadcn composé.

```tsx
<Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
  <EmptyHeader>
    <EmptyTitle>Aucune fixture</EmptyTitle>
    <EmptyDescription>
      Aucun résultat ne correspond aux filtres sélectionnés.
    </EmptyDescription>
  </EmptyHeader>
</Empty>
```

---

### Composites génériques

#### `StatCard`

Carte de métrique avec label, valeur et ton coloré.

```tsx
<StatCard label="ROI net" value="+4.2%" tone="success" />
<StatCard label="Paris réglés" value="127" tone="accent" />
<StatCard label="Suspensions" value="2" tone="danger" />

// compact : taille réduite pour les headers de panels
<StatCard compact label="Misé" value="340 u" tone="neutral" />

// avec icône à gauche du label
<StatCard icon={<Wallet size={14} />} label="Solde" value="1 240 u" />

// avec delta (slot libre sous la valeur)
<StatCard label="ROI" value="+4.2%" delta={<span className="text-xs">vs semaine -1.1%</span>} />
```

**Tons** : `accent` · `success` · `warning` · `danger` · `neutral`

---

#### `StatList`

Liste verticale de paires clé/valeur.

```tsx
<StatList
  items={[
    { label: "Paris réglés", value: "127", tone: "positive" },
    { label: "Suspensions", value: "2", tone: "negative" },
    { label: "Propositions", value: "5" },
    { label: "Code", value: "FR_L1", mono: true },
  ]}
/>
```

**Tons valeur** : `positive` (vert) · `negative` (rouge) · `warning` (ambre) · `neutral` (défaut)
`mono: true` affiche le label en police monospace.

---

#### `ProgressBar`

Barre de progression avec résolution de ton automatique.

```tsx
// Ton fixe
<ProgressBar value={75} tone="success" />

// Ton auto via seuils (≥ success = vert, ≥ warning = ambre, sinon rouge)
<ProgressBar value={row.xgCoveragePct} thresholds={{ success: 80, warning: 50 }} />

// Avec label et valeur cachée
<ProgressBar value={62} label="xG" showValue={false} />

// Valeur sur max autre que 100
<ProgressBar value={34} max={50} thresholds={{ success: 40, warning: 25 }} />
```

---

#### `TableCard`

Container de section avec titre, sous-titre optionnel, et action.

```tsx
<TableCard
  title="Historique des mouvements"
  subtitle="Les 200 derniers mouvements avec le solde après chaque opération."
  action={<Button size="xs" variant="ghost">Exporter</Button>}
>
  <DataTable columns={COLUMNS} data={rows} />
</TableCard>

// Sans sous-titre
<TableCard title="Paris par statut">
  <div className="p-4"><StatList items={items} /></div>
</TableCard>
```

L'enfant est rendu dans un container avec `overflow-hidden rounded-[1.3rem] border`.

---

#### `DataTable`

Table basée sur TanStack Table v8 + primitif `Table` shadcn.

```tsx
const COLUMNS: ColumnDef<MyRow>[] = [
  {
    id: "name",
    header: "Nom",
    accessorKey: "name",
  },
  {
    id: "status",
    header: "Statut",
    cell: ({ row }) => <Badge variant="success">{row.original.status}</Badge>,
  },
]

<DataTable
  columns={COLUMNS}
  data={rows}
  isLoading={isLoading}
  loadingRows={5}
  emptyState={
    <Empty className="rounded-3xl border border-dashed border-border bg-panel/70 p-8">
      <EmptyHeader>
        <EmptyTitle>Vide</EmptyTitle>
        <EmptyDescription>Aucune donnée.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  }
  // Tri initial
  initialSorting={[{ id: "name", desc: false }]}
  // Masquage de colonnes
  columnVisibility={{ status: false }}
  // Lignes expandables
  getRowCanExpand={(row) => row.details !== null}
  renderSubRow={(row) => <FixtureDiagnostics row={row} />}
  // Clic sur ligne
  onRowClick={(row) => setSelected(row.id)}
  // Fallback mobile (rend des cards au lieu du tableau)
  mobileCard={(row, index) => <MyCard key={index} row={row} />}
/>
```

**Alignement de colonne** : passer `meta: { align: "right" }` sur la `ColumnDef` pour aligner header et cellule à droite.

---

#### `FilterBar`

Barre de filtres responsive (Sheet mobile / chips tablet / inline desktop).

```tsx
const FILTERS: FilterDef[] = [
  { key: "status", type: "select", label: "Statut", options: [
    { value: "ALL", label: "Tous" },
    { value: "BET", label: "BET" },
  ]},
  { key: "from", type: "date", label: "Du" },
  { key: "to", type: "date", label: "Au" },
  { key: "range", type: "daterange", label: "Période" },
  { key: "tags", type: "multiselect", label: "Tags", options: [...] },
  { key: "active", type: "toggle", label: "Actifs seulement" },
]

const [filters, setFilters] = useState<FilterState>({
  status: "ALL",
  from: "",
  to: todayIso(),
})

<FilterBar
  filters={FILTERS}
  value={filters}
  onChange={setFilters}
  onReset={() => setFilters({ status: "ALL", from: "", to: todayIso() })}
/>
```

**Types de filtre** : `select` · `multiselect` · `date` · `daterange` · `toggle`

---

#### `DatePicker` / `DateRangePicker`

Sélecteurs de date basés sur shadcn `Calendar`.

```tsx
<DatePicker
  value={date}
  onChange={setDate}
  placeholder="Choisir une date"
/>

<DateRangePicker
  value={{ from: dateFrom, to: dateTo }}
  onChange={({ from, to }) => { setFrom(from); setTo(to) }}
  placeholder="Sélectionner une période"
/>
```

---

#### `Combobox`

Select avec recherche (Command + Popover).

```tsx
<Combobox
  options={[
    { value: "fr_l1", label: "Ligue 1" },
    { value: "es_ll", label: "La Liga" },
  ]}
  value={selected}
  onChange={setSelected}
  placeholder="Choisir une ligue"
  searchPlaceholder="Rechercher..."
  emptyLabel="Aucune ligue trouvée"
/>
```

---

#### `ResponsiveGrid`

Grille responsive avec `cols` par breakpoint et `gap` sémantique.

```tsx
// cols fixe
<ResponsiveGrid cols={3} gap="md">
  <StatCard ... />
  <StatCard ... />
  <StatCard ... />
</ResponsiveGrid>

// cols par breakpoint
<ResponsiveGrid cols={{ base: 1, sm: 2, lg: 4 }} gap="sm">
  <StatCard compact ... />
</ResponsiveGrid>
```

**Valeurs `cols`** : `1` à `6` ou `{ base?, sm?, md?, lg?, xl? }`
**Valeurs `gap`** : `xs` · `sm` · `md` · `lg` · `xl`

---

### Composants de layout

#### `Page` / `PageHeader` / `PageContent`

Wrappers de mise en page des pages dashboard.

```tsx
export default function MyPage() {
  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        {/* contenu */}
      </PageContent>
    </Page>
  );
}
```

#### `PageShell`

Shell global avec sidebar nav + zone content. Utilisé dans le layout dashboard.

#### `TopNav`

Barre de navigation supérieure (titre, sous-titre, statut, date).

#### `SectionHeader`

Titre + sous-titre de section. Utilisé par `TableCard`.

#### `ThemeProvider`

Wrappeur `next-themes`. Placé dans le root layout via `Providers`.

```tsx
// providers.tsx
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
>
  {children}
</ThemeProvider>
```

---

## Ce qui n'appartient PAS à `@evcore/ui`

| Composant                      | Où il va                                       | Pourquoi                        |
| ------------------------------ | ---------------------------------------------- | ------------------------------- |
| `EvAreaChart`, `EvBarChart`    | `apps/web/components/charts/`                  | Dépend de Recharts, non partagé |
| `AppShell`, `NotificationBell` | `apps/web/components/`                         | Logique app-web, pas générique  |
| `FixtureDiagnostics`           | `apps/web/app/dashboard/fixtures/components/`  | Feature-spécifique              |
| `BetSlipCard`                  | `apps/web/app/dashboard/bet-slips/components/` | Feature-spécifique              |
| `DepositDialog`                | `apps/web/app/dashboard/bankroll/components/`  | Feature-spécifique              |
