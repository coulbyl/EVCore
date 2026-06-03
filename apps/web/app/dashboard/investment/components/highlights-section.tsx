"use client";

import { useState } from "react";
import { Button } from "@evcore/ui";
import type { InvestmentPickDto } from "@/domains/ai-engine/types/investment";
import { PickCard } from "./pick-card";

export function HighlightsSection({
  top5,
  top10,
  locale,
}: {
  top5: InvestmentPickDto[];
  top10: InvestmentPickDto[];
  locale: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const picks = showAll ? top10 : top5;

  if (top5.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Sélection du jour</h2>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-bold tabular-nums text-muted-foreground">
              Top {showAll ? top10.length : top5.length}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Les meilleurs signaux cross-canal triés par score.
          </p>
        </div>
        {top10.length > top5.length && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 text-xs"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll
              ? `Réduire au top ${top5.length}`
              : `Voir le top ${top10.length}`}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {picks.map((pick) => (
          <PickCard
            key={`${pick.fixtureId}:${pick.canal}`}
            pick={pick}
            locale={locale}
          />
        ))}
      </div>
    </section>
  );
}
