"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Calendar,
} from "@evcore/ui";
import { todayIso, daysAgoIso, formatDateLong } from "@/lib/date";

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(iso: string): string {
  const today = todayIso();
  if (iso === today) return "Aujourd'hui";
  if (iso === daysAgoIso(1)) return "Hier";
  return formatDateLong(`${iso}T12:00:00Z`);
}

interface DateNavProps {
  date: string;
  onChange: (iso: string) => void;
  className?: string;
}

export function DateNav({ date, onChange, className }: DateNavProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => onChange(shiftDate(date, -1))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="h-7 min-w-28 px-2 text-sm font-medium"
          >
            {formatDateLabel(date)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="single"
            selected={new Date(`${date}T12:00:00Z`)}
            onSelect={(d) => {
              if (!d) return;
              setCalendarOpen(false);
              onChange(d.toISOString().slice(0, 10));
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => onChange(shiftDate(date, 1))}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
