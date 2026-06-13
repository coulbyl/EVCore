"use client";

import { useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@evcore/ui";
import { AlertCircle, FlaskConical } from "lucide-react";
import { useMlPromotionReport } from "@/domains/reports/use-cases/use-reports";
import type { PromotionWindow } from "@/domains/reports/types/reports";
import { SegmentRow } from "./segment-row";
import { WINDOW_OPTIONS, fmtDateTime } from "./reports-constants";

export function ReportsPageClient() {
  const [window, setWindow] = useState<PromotionWindow>("P30D");
  const { data, isLoading, isError } = useMlPromotionReport(window);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <FlaskConical className="size-5 text-accent" />
            <PageHeaderTitle className="text-lg font-semibold">
              Promotion ML — shadow → prod
            </PageHeaderTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Comparaison baseline vs correction shadow par segment. Aide à
            décider, segment par segment, de promouvoir la correction hors
            shadow.
          </p>
        </div>
        <PageHeaderActions>
          <Select
            value={window}
            onValueChange={(v) => setWindow(v as PromotionWindow)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOW_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PageHeaderActions>
      </PageHeader>

      {data ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="rounded-md bg-secondary px-2 py-1">{data.rule}</span>
          <span>Données les plus fraîches : {fmtDateTime(data.asOf)}</span>
        </div>
      ) : null}

      {isError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Rapport indisponible</AlertTitle>
          <AlertDescription>
            Impossible de charger le rapport de promotion ML. Réessaie plus
            tard.
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : null}

      {data ? (
        <div className="flex flex-col gap-3">
          {data.segments.map((row) => (
            <SegmentRow key={row.segment} row={row} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
