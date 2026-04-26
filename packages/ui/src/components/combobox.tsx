"use client";

import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

import { cn } from "@evcore/ui/lib/utils";
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

export { Combobox };
export type { ComboboxOption };
