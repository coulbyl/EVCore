"use client";

import * as React from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@evcore/ui/lib/utils";
import { Button } from "@evcore/ui/components/button";
import { Calendar } from "@evcore/ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@evcore/ui/components/popover";

// ── DatePicker (single) ────────────────────────────────────────────────────

type DatePickerProps = {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

function DatePicker({
  value,
  onChange,
  placeholder = "Choisir une date",
  className,
  disabled,
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {value ? format(value, "dd MMM yyyy", { locale: fr }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// ── DateRangePicker ────────────────────────────────────────────────────────

type DateRangePickerProps = {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

function DateRangePicker({
  value,
  onChange,
  placeholder = "Choisir une période",
  className,
  disabled,
}: DateRangePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value?.from && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {value?.from ? (
            value.to ? (
              <>
                {format(value.from, "dd MMM", { locale: fr })} –{" "}
                {format(value.to, "dd MMM yyyy", { locale: fr })}
              </>
            ) : (
              format(value.from, "dd MMM yyyy", { locale: fr })
            )
          ) : (
            placeholder
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          numberOfMonths={2}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker, DateRangePicker };
export type { DateRange };
