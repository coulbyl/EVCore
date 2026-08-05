"use client";

import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";

import { cn } from "@evcore/ui/lib/utils";
import { Badge } from "@evcore/ui/components/badge";
import { Button } from "@evcore/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@evcore/ui/components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@evcore/ui/components/popover";

type ComboboxOption = { value: string; label: string };

type ComboboxProps = {
  options: ComboboxOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
};

function Combobox({
  options,
  value,
  onChange,
  placeholder = "Sélectionner...",
  searchPlaceholder = "Rechercher...",
  emptyLabel = "Aucun résultat.",
  className,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          {selected ? selected.label : placeholder}
          <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  onSelect={(v) => {
                    onChange?.(v === value ? "" : v);
                    setOpen(false);
                  }}
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 size-4",
                      value === opt.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type MultiComboboxOption = { value: string; label: string };

type MultiComboboxProps = {
  options: MultiComboboxOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
  /** Removable chips listing every selection below the trigger. Off by
   * default once a handful of options are picked it turns into a wall of
   * badges — the trigger's "N sélectionné(s)" count plus the popover's own
   * checkmarks already cover both feedback and removal. */
  showSelectedTags?: boolean;
};

// Passé ce nombre de puces affichées, on replie derrière un "+N" plutôt que
// de laisser la sélection s'étaler sur plusieurs lignes — l'utilisateur doit
// toujours voir ce qu'il a choisi, juste pas d'un coup si c'est beaucoup.
const COLLAPSED_TAG_COUNT = 4;

// Même socle (Popover + Command) que Combobox ci-dessus, en sélection multiple
// avec puces retirables — pas de nouvelle dépendance, même stack Radix/cmdk
// déjà utilisée partout ailleurs dans le design system.
function MultiCombobox({
  options,
  value,
  onChange,
  placeholder = "Sélectionner...",
  searchPlaceholder = "Rechercher...",
  emptyLabel = "Aucun résultat.",
  className,
  disabled,
  showSelectedTags = true,
}: MultiComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [tagsExpanded, setTagsExpanded] = React.useState(false);
  const selectedOptions = options.filter((opt) => value.includes(opt.value));
  const hasOverflow = selectedOptions.length > COLLAPSED_TAG_COUNT;
  const visibleOptions =
    hasOverflow && !tagsExpanded
      ? selectedOptions.slice(0, COLLAPSED_TAG_COUNT)
      : selectedOptions;

  function toggle(optionValue: string) {
    onChange(
      value.includes(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue],
    );
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              value.length === 0 && "text-muted-foreground",
              className,
            )}
          >
            {value.length > 0
              ? `${value.length} sélectionné${value.length > 1 ? "s" : ""}`
              : placeholder}
            <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    onSelect={() => toggle(opt.value)}
                  >
                    <CheckIcon
                      className={cn(
                        "mr-2 size-4",
                        value.includes(opt.value) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {opt.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {showSelectedTags && selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {visibleOptions.map((opt) => (
            <Badge key={opt.value} variant="secondary" className="gap-1 pr-1">
              {opt.label}
              <button
                type="button"
                onClick={() => toggle(opt.value)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Retirer ${opt.label}`}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
          {hasOverflow && (
            <button
              type="button"
              onClick={() => setTagsExpanded((v) => !v)}
              className="rounded-full border border-border px-2 text-xs text-muted-foreground hover:border-accent hover:text-accent"
            >
              {tagsExpanded
                ? "Réduire"
                : `+${selectedOptions.length - COLLAPSED_TAG_COUNT}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export { Combobox, MultiCombobox };
export type { ComboboxOption };
