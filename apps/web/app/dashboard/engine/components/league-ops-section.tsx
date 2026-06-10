import { useState } from "react";
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@evcore/ui";
import { CheckCircle2, Globe } from "lucide-react";
import {
  useTriggerFixturesBackfill,
  useTriggerLeagueSync,
  useTriggerOddsCsvBackfill,
  useTriggerOddsHistoricalBackfill,
  useTriggerRollingStats,
  useTriggerStandingsSync,
  useTriggerStatsBackfill,
} from "@/domains/etl/use-cases/use-etl";
import type {
  EtlBackfillResult,
  LeagueSyncType,
} from "@/domains/etl/types/etl";

const COMPETITIONS = [
  "PL",
  "SA",
  "LL",
  "BL1",
  "FL1",
  "UCL",
  "UEL",
  "UECL",
  "WC",
  "FRI",
  "J1",
  "ERD",
  "POR",
] as const;

type LeagueActionStatus = { ok: boolean; error?: string } | null;

function LeagueSyncButtons({ competitionCode }: { competitionCode: string }) {
  const [statuses, setStatuses] = useState<
    Record<LeagueSyncType | "standings", LeagueActionStatus>
  >({
    fixtures: null,
    stats: null,
    injuries: null,
    standings: null,
  });

  const fixturesSync = useTriggerLeagueSync("fixtures");
  const statsSync = useTriggerLeagueSync("stats");
  const injuriesSync = useTriggerLeagueSync("injuries");
  const standingsSync = useTriggerStandingsSync();
  const [standingSeason, setStandingSeason] = useState(
    String(new Date().getFullYear()),
  );

  async function trigger(
    key: LeagueSyncType | "standings",
    fn: () => Promise<unknown>,
  ) {
    setStatuses((prev) => ({ ...prev, [key]: null }));
    try {
      await fn();
      setStatuses((prev) => ({ ...prev, [key]: { ok: true } }));
    } catch (err) {
      setStatuses((prev) => ({
        ...prev,
        [key]: {
          ok: false,
          error: err instanceof Error ? err.message : "Erreur",
        },
      }));
    }
  }

  const season = Number(standingSeason);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
        Sync courant
      </p>
      <div className="flex flex-wrap gap-2">
        {(
          [
            {
              key: "fixtures" as const,
              label: "Fixtures",
              fn: () => fixturesSync.mutateAsync(competitionCode),
              isPending: fixturesSync.isPending,
            },
            {
              key: "stats" as const,
              label: "Stats",
              fn: () => statsSync.mutateAsync(competitionCode),
              isPending: statsSync.isPending,
            },
            {
              key: "injuries" as const,
              label: "Blessures",
              fn: () => injuriesSync.mutateAsync(competitionCode),
              isPending: injuriesSync.isPending,
            },
          ] as const
        ).map((action) => (
          <div key={action.key} className="flex flex-col items-start gap-0.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => trigger(action.key, action.fn)}
              disabled={action.isPending}
            >
              {action.isPending ? "En cours…" : action.label}
              {statuses[action.key]?.ok && (
                <CheckCircle2 size={12} className="ml-1 text-success" />
              )}
            </Button>
            {statuses[action.key]?.error && (
              <p className="text-[0.6rem] text-danger">
                {statuses[action.key]?.error}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[0.65rem] font-medium text-muted-foreground">
            Standings — saison
          </label>
          <input
            type="number"
            value={standingSeason}
            onChange={(e) => setStandingSeason(e.target.value)}
            className="h-9 w-24 rounded-xl border border-border bg-panel px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="flex flex-col items-start gap-0.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              trigger("standings", () =>
                standingsSync.mutateAsync({ competitionCode, season }),
              )
            }
            disabled={standingsSync.isPending || !season}
          >
            {standingsSync.isPending ? "En cours…" : "Standings"}
            {statuses.standings?.ok && (
              <CheckCircle2 size={12} className="ml-1 text-success" />
            )}
          </Button>
          {statuses.standings?.error && (
            <p className="text-[0.6rem] text-danger">
              {statuses.standings.error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RollingStatsRow({ competitionCode }: { competitionCode: string }) {
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [mode, setMode] = useState<"refresh" | "rebuild">("refresh");
  const [status, setStatus] = useState<LeagueActionStatus>(null);
  const trigger = useTriggerRollingStats();

  async function handle() {
    setStatus(null);
    try {
      await trigger.mutateAsync({
        competitionCode,
        season: Number(season),
        mode,
      });
      setStatus({ ok: true });
    } catch (err) {
      setStatus({
        ok: false,
        error: err instanceof Error ? err.message : "Erreur",
      });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
        Rolling stats
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[0.65rem] font-medium text-muted-foreground">
            Saison
          </label>
          <input
            type="number"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="h-9 w-24 rounded-xl border border-border bg-panel px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[0.65rem] font-medium text-muted-foreground">
            Mode
          </label>
          <Select
            value={mode}
            onValueChange={(v) => setMode(v as "refresh" | "rebuild")}
          >
            <SelectTrigger className="h-9 w-28 rounded-xl bg-panel text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="refresh">refresh</SelectItem>
                <SelectItem value="rebuild">rebuild</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col items-start gap-0.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handle}
            disabled={trigger.isPending || !season}
          >
            {trigger.isPending ? "En cours…" : "Lancer"}
            {status?.ok && (
              <CheckCircle2 size={12} className="ml-1 text-success" />
            )}
          </Button>
          {status?.error && (
            <p className="text-[0.6rem] text-danger">{status.error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function BackfillRow({ competitionCode }: { competitionCode: string }) {
  const [seasons, setSeasons] = useState("2023,2024");
  const [results, setResults] = useState<
    Record<string, EtlBackfillResult | null>
  >({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fixturesBackfill = useTriggerFixturesBackfill();
  const statsBackfill = useTriggerStatsBackfill();
  const oddsCsvBackfill = useTriggerOddsCsvBackfill();
  const oddsHistoricalBackfill = useTriggerOddsHistoricalBackfill();

  async function backfill(
    key: string,
    fn: (opts: {
      competitionCode: string;
      seasons: string;
    }) => Promise<EtlBackfillResult>,
  ) {
    setResults((prev) => ({ ...prev, [key]: null }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
    try {
      const r = await fn({ competitionCode, seasons });
      setResults((prev) => ({ ...prev, [key]: r }));
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [key]: err instanceof Error ? err.message : "Erreur",
      }));
    }
  }

  const actions = [
    {
      key: "fixtures",
      label: "Fixtures",
      fn: fixturesBackfill.mutateAsync,
      isPending: fixturesBackfill.isPending,
    },
    {
      key: "stats",
      label: "Stats",
      fn: statsBackfill.mutateAsync,
      isPending: statsBackfill.isPending,
    },
    {
      key: "odds-csv",
      label: "Odds CSV",
      fn: oddsCsvBackfill.mutateAsync,
      isPending: oddsCsvBackfill.isPending,
    },
    {
      key: "odds-historical",
      label: "Historical Pinnacle",
      fn: oddsHistoricalBackfill.mutateAsync,
      isPending: oddsHistoricalBackfill.isPending,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
        Backfill historique
      </p>
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
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <div key={action.key} className="flex flex-col items-start gap-0.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => backfill(action.key, action.fn)}
              disabled={action.isPending || !seasons.trim()}
            >
              {action.isPending ? "En cours…" : action.label}
              {results[action.key] && (
                <CheckCircle2 size={12} className="ml-1 text-success" />
              )}
            </Button>
            {errors[action.key] && (
              <p className="text-[0.6rem] text-danger">{errors[action.key]}</p>
            )}
          </div>
        ))}
      </div>
      {Object.entries(results)
        .filter(([, r]) => r !== null)
        .map(([key, r]) => (
          <div key={key} className="flex flex-wrap gap-1">
            {r?.seasons.map((s) => (
              <Badge
                key={s}
                variant="neutral"
                className="font-mono text-[0.6rem]"
              >
                {r.competitionCode} {s}
              </Badge>
            ))}
          </div>
        ))}
    </div>
  );
}

export function LeagueOpsSection() {
  const [competitionCode, setCompetitionCode] = useState<string>("PL");

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Globe size={14} className="text-accent" />
        <p className="text-[0.72rem] font-semibold uppercase tracking-widest text-muted-foreground">
          Opérations par ligue
        </p>
      </div>

      <div className="bento-cell flex flex-col gap-6 p-5">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[0.65rem] font-medium text-muted-foreground">
              Ligue
            </label>
            <Select value={competitionCode} onValueChange={setCompetitionCode}>
              <SelectTrigger className="h-9 w-32 rounded-xl bg-panel text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {COMPETITIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Badge variant="neutral" className="mt-5 font-mono text-xs">
            {competitionCode}
          </Badge>
        </div>

        <div className="grid gap-6 border-t border-border/50 pt-4 lg:grid-cols-3">
          <LeagueSyncButtons competitionCode={competitionCode} />
          <RollingStatsRow competitionCode={competitionCode} />
          <BackfillRow competitionCode={competitionCode} />
        </div>
      </div>
    </section>
  );
}
