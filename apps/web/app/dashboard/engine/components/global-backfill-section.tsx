"use client";

import { useState } from "react";
import { Badge, Button } from "@evcore/ui";
import { CheckCircle2, Globe2 } from "lucide-react";
import { useTriggerOddsHistoricalFullBackfill } from "@/domains/etl/use-cases/use-etl";
import type { EtlOddsHistoricalFullResult } from "@/domains/etl/types/etl";

export function GlobalBackfillSection() {
  const [seasons, setSeasons] = useState("2023,2024");
  const [codes, setCodes] = useState("");
  const [result, setResult] = useState<EtlOddsHistoricalFullResult | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const trigger = useTriggerOddsHistoricalFullBackfill();

  async function handleTrigger() {
    setResult(null);
    setError(null);
    try {
      const r = await trigger.mutateAsync({ seasons, codes });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Globe2 size={14} className="text-accent" />
        <p className="text-[0.72rem] font-semibold uppercase tracking-widest text-muted-foreground">
          Backfill odds historiques — toutes ligues
        </p>
      </div>

      <div className="bento-cell flex flex-col gap-4 p-5">
        <p className="text-xs text-muted-foreground">
          Importe les cotes Pinnacle historiques (The Odds API) pour chaque
          compétition configurée dans THE_ODDS_API_SPORT_KEYS, ou un
          sous-ensemble via les codes. Espacé automatiquement pour respecter le
          rate-limit du provider.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[0.65rem] font-medium text-muted-foreground">
              Saisons (ex: 2022,2023,2024)
            </label>
            <input
              type="text"
              value={seasons}
              onChange={(e) => setSeasons(e.target.value)}
              placeholder="2022,2023,2024"
              className="h-9 w-52 rounded-xl border border-border bg-panel px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[0.65rem] font-medium text-muted-foreground">
              Codes (optionnel, ex: PL,SA,ARG1)
            </label>
            <input
              type="text"
              value={codes}
              onChange={(e) => setCodes(e.target.value)}
              placeholder="toutes les ligues configurées"
              className="h-9 w-56 rounded-xl border border-border bg-panel px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTrigger}
            disabled={trigger.isPending || !seasons.trim()}
          >
            {trigger.isPending ? "En cours…" : "Lancer"}
            {result && <CheckCircle2 size={12} className="ml-1 text-success" />}
          </Button>
        </div>

        {result && (
          <div className="flex flex-wrap gap-1.5">
            {result.competitionCodes.map((code) => (
              <Badge
                key={code}
                variant="neutral"
                className="font-mono text-[0.6rem]"
              >
                {code}
              </Badge>
            ))}
          </div>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </section>
  );
}
