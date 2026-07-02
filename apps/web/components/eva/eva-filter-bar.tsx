"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import {
  Button,
  Calendar,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@evcore/ui";
import { CalendarIcon, Download, Sparkles } from "lucide-react";
import type { AnalysisSheetFilters } from "@/domains/analysis-sheet/types/analysis-sheet";
import { isoToDate, toISODate, todayIso } from "@/lib/date";
import { ANALYSIS_SHEET_CHANNEL_OPTIONS } from "./eva-constants";

const CALENDAR_END_MONTH = new Date(new Date().getFullYear() + 1, 11);

export function EvaFilterBar({
  filters,
  onFiltersChange,
  onAnalyze,
  isAnalyzing,
  onExport,
}: {
  filters: AnalysisSheetFilters;
  onFiltersChange: (filters: AnalysisSheetFilters) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  onExport: (format: "txt" | "json") => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const today = isoToDate(todayIso());
  const range: DateRange = {
    from: isoToDate(filters.from),
    to: isoToDate(filters.to),
  };

  function handleRangeSelect(next: DateRange | undefined) {
    if (!next?.from) return;
    onFiltersChange({
      ...filters,
      from: toISODate(next.from),
      to: toISODate(next.to ?? next.from),
    });
    if (next.to) setCalendarOpen(false);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-start gap-2">
            <CalendarIcon className="size-4" />
            {filters.from} → {filters.to}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={range}
            onSelect={handleRangeSelect}
            numberOfMonths={2}
            captionLayout="dropdown"
            startMonth={today}
            endMonth={CALENDAR_END_MONTH}
            disabled={{ before: today }}
          />
        </PopoverContent>
      </Popover>

      <Input
        placeholder="Compétition (ex: PL)"
        value={filters.competitionCode ?? ""}
        onChange={(e) =>
          onFiltersChange({
            ...filters,
            competitionCode: e.target.value.trim() || undefined,
          })
        }
        className="w-full sm:flex-1"
      />

      <Select
        value={filters.channel ?? "ALL"}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            channel:
              value === "ALL"
                ? undefined
                : (value as AnalysisSheetFilters["channel"]),
          })
        }
      >
        <SelectTrigger className="w-full sm:w-auto sm:flex-1">
          <SelectValue placeholder="Canal" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="ALL">Tous les canaux</SelectItem>
            {ANALYSIS_SHEET_CHANNEL_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Button onClick={onAnalyze} disabled={isAnalyzing} className="gap-2">
        <Sparkles className="size-4" />
        {isAnalyzing ? "Analyse en cours…" : "Analyser avec Eva"}
      </Button>

      <div className="flex gap-2 sm:ml-auto">
        <Button
          variant="outline"
          onClick={() => onExport("txt")}
          className="gap-2"
        >
          <Download className="size-4" />
          Exporter .txt
        </Button>
        <Button
          variant="outline"
          onClick={() => onExport("json")}
          className="gap-2"
        >
          <Download className="size-4" />
          Exporter .json
        </Button>
      </div>
    </div>
  );
}
