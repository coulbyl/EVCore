"use client"

import * as React from "react"
import { XIcon, SlidersHorizontalIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@evcore/ui/lib/utils"
import { Button } from "@evcore/ui/components/button"
import { Badge } from "@evcore/ui/components/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@evcore/ui/components/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@evcore/ui/components/select"
import { DatePicker, DateRangePicker } from "@evcore/ui/components/date-picker"
import { Combobox, type ComboboxOption } from "@evcore/ui/components/combobox"
import { Separator } from "@evcore/ui/components/separator"

// ── Types ──────────────────────────────────────────────────────────────────

type SelectFilterDef = {
  key: string
  label: string
  type: "select"
  options: { value: string; label: string }[]
}

type MultiSelectFilterDef = {
  key: string
  label: string
  type: "multiselect"
  options: ComboboxOption[]
}

type DateFilterDef = {
  key: string
  label: string
  type: "date"
}

type DateRangeFilterDef = {
  key: string
  label: string
  type: "daterange"
}

type ToggleFilterDef = {
  key: string
  label: string
  type: "toggle"
}

export type FilterDef =
  | SelectFilterDef
  | MultiSelectFilterDef
  | DateFilterDef
  | DateRangeFilterDef
  | ToggleFilterDef

export type FilterState = Record<string, string | string[] | DateRange | boolean | undefined>

// ── Helpers ────────────────────────────────────────────────────────────────

function isActive(def: FilterDef, value: FilterState[string]): boolean {
  if (value === undefined || value === null) return false
  if (def.type === "toggle") return value === true
  if (def.type === "multiselect") return Array.isArray(value) && value.length > 0
  if (def.type === "daterange") {
    const r = value as DateRange | undefined
    return !!(r?.from)
  }
  if (def.type === "date") return typeof value === "string" && value !== ""
  if (def.type === "select") return typeof value === "string" && value !== "" && value !== (def as SelectFilterDef).options[0]?.value
  return false
}

function countActive(filters: FilterDef[], state: FilterState): number {
  return filters.filter((f) => isActive(f, state[f.key])).length
}

function formatChipLabel(def: FilterDef, value: FilterState[string]): string {
  if (def.type === "select") {
    const opt = (def as SelectFilterDef).options.find((o) => o.value === value)
    return opt ? `${def.label}: ${opt.label}` : def.label
  }
  if (def.type === "multiselect") {
    const vals = value as string[]
    return `${def.label} (${vals.length})`
  }
  if (def.type === "date") return `${def.label}: ${value as string}`
  if (def.type === "daterange") {
    const r = value as DateRange
    return r?.to ? `${def.label}: …` : `${def.label}: à partir du…`
  }
  return def.label
}

// ── Single filter control ──────────────────────────────────────────────────

function FilterControl({
  def,
  value,
  onChange,
}: {
  def: FilterDef
  value: FilterState[string]
  onChange: (v: FilterState[string]) => void
}) {
  if (def.type === "select") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{def.label}</span>
        <Select value={value as string} onValueChange={onChange}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {def.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  if (def.type === "multiselect") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{def.label}</span>
        <Combobox
          options={def.options}
          value={Array.isArray(value) ? value[0] : undefined}
          onChange={(v) => onChange(v ? [v] : [])}
          placeholder={`Tous (${def.label})`}
        />
      </div>
    )
  }

  if (def.type === "date") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{def.label}</span>
        <DatePicker
          value={value ? new Date(value as string) : undefined}
          onChange={(d) => onChange(d ? d.toISOString().slice(0, 10) : undefined)}
        />
      </div>
    )
  }

  if (def.type === "daterange") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{def.label}</span>
        <DateRangePicker
          value={value as DateRange | undefined}
          onChange={onChange}
        />
      </div>
    )
  }

  if (def.type === "toggle") {
    return (
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={cn(
          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
          value
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-foreground hover:bg-secondary"
        )}
      >
        {def.label}
      </button>
    )
  }

  return null
}

// ── Main FilterBar ─────────────────────────────────────────────────────────

type FilterBarProps = {
  filters: FilterDef[]
  value: FilterState
  onChange: (state: FilterState) => void
  onReset?: () => void
  className?: string
}

function FilterBar({ filters, value, onChange, onReset, className }: FilterBarProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const activeCount = countActive(filters, value)

  function handleChange(key: string, v: FilterState[string]) {
    onChange({ ...value, [key]: v })
  }

  function handleReset(key: string) {
    const next = { ...value }
    delete next[key]
    onChange(next)
  }

  function handleResetAll() {
    onReset ? onReset() : onChange({})
  }

  return (
    <>
      {/* Mobile: bouton "Filtres (N)" → Sheet */}
      <div className="flex items-center gap-2 sm:hidden">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setMobileOpen(true)}
        >
          <SlidersHorizontalIcon className="size-3.5" />
          Filtres{activeCount > 0 && <Badge variant="secondary">{activeCount}</Badge>}
        </Button>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={handleResetAll}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Tablet: chips scrollables horizontalement */}
      <div className={cn("hidden sm:flex lg:hidden items-center gap-2 overflow-x-auto pb-1", className)}>
        {filters.map((def) => {
          const active = isActive(def, value[def.key])
          if (!active) return null
          return (
            <span
              key={def.key}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium"
            >
              {formatChipLabel(def, value[def.key])}
              <button type="button" onClick={() => handleReset(def.key)} aria-label="Retirer ce filtre">
                <XIcon className="size-3" />
              </button>
            </span>
          )
        })}
        {filters.map((def) => {
          const active = isActive(def, value[def.key])
          if (active) return null
          return (
            <FilterControl
              key={def.key}
              def={def}
              value={value[def.key]}
              onChange={(v) => handleChange(def.key, v)}
            />
          )
        })}
        {activeCount > 0 && (
          <button type="button" onClick={handleResetAll} className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
            Tout réinitialiser
          </button>
        )}
      </div>

      {/* Desktop: barre inline complète */}
      <div className={cn("hidden lg:flex items-end gap-3 flex-wrap", className)}>
        {filters.map((def) => (
          <div key={def.key} className="min-w-[140px]">
            <FilterControl
              def={def}
              value={value[def.key]}
              onChange={(v) => handleChange(def.key, v)}
            />
          </div>
        ))}
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleResetAll} className="self-end text-muted-foreground">
            <XIcon className="mr-1 size-3" />
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Mobile Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-[1.5rem]">
          <SheetHeader>
            <SheetTitle>Filtres</SheetTitle>
          </SheetHeader>
          <Separator className="my-4" />
          <div className="flex flex-col gap-4 overflow-y-auto">
            {filters.map((def) => (
              <FilterControl
                key={def.key}
                def={def}
                value={value[def.key]}
                onChange={(v) => handleChange(def.key, v)}
              />
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleResetAll}>
              Réinitialiser
            </Button>
            <Button className="flex-1" onClick={() => setMobileOpen(false)}>
              Appliquer
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

export { FilterBar }
