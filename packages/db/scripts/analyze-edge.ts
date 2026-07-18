/// <reference types="node" />
/**
 * Phase 3 — Edge analysis vs Pinnacle
 * Run: pnpm --filter @evcore/db db:analyze:edge
 * Output: packages/db/reports/edge-vs-pinnacle-YYYY-MM-DD.md
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/client";

type Channel = "EV" | "SV" | "CONF" | "DRAW" | "BTTS";
type SupportedMarket =
  | "ONE_X_TWO"
  | "BTTS"
  | "OVER_UNDER"
  | "OVER_UNDER_HT"
  | "FIRST_HALF_WINNER";

type SubjectRow = {
  id: string;
  sourceType: "SELECTION";
  channel: Channel;
  competition: string;
  fixtureId: string;
  market: string;
  pick: string;
  modelProb: number;
  correct: boolean;
  actualOdds: number | null;
};

type OddsRow = {
  fixtureId: string;
  market: string;
  snapshotAt: Date;
  pick: string | null;
  odds: number | null;
  homeOdds: number | null;
  drawOdds: number | null;
  awayOdds: number | null;
};

type SupportedRecord = {
  sourceType: "SELECTION";
  channel: Channel;
  competition: string;
  fixtureId: string;
  market: SupportedMarket;
  pick: string;
  correct: boolean;
  modelProb: number;
  pinnacleProb: number;
  edge: number;
  pinnacleOdds: number;
  actualOdds: number | null;
};

type Aggregate = {
  label: string;
  total: number;
  wins: number;
  losses: number;
  avgModelProb: number;
  avgPinnacleProb: number;
  avgEdge: number;
  avgActualOdds: number | null;
  avgPinnacleOdds: number;
  actualProfit: number | null;
  pinnacleProfit: number;
};

const REPORT_DIR = join(process.cwd(), "reports");

function toReportChannel(channel: string): Channel {
  if (channel === "SAFE") return "SV";
  if (channel === "DOMINANT") return "CONF";
  return channel as Channel;
}

function toNumber(
  value: { toString(): string } | number | null,
): number | null {
  if (value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : null;
}

function fmtPct(value: number | null, digits = 1): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

function fmtSignedPct(value: number, digits = 2): string {
  const rendered = (value * 100).toFixed(digits);
  return `${value > 0 ? "+" : ""}${rendered}%`;
}

function fmtFloat(value: number | null, digits = 3): string {
  if (value === null) return "—";
  return value.toFixed(digits);
}

function fmtInt(value: number): string {
  return value.toLocaleString("en-US");
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeInverseOdds(
  entries: Array<[string, number]>,
): Map<string, number> {
  const sum = entries.reduce((acc, [, odds]) => acc + 1 / odds, 0);
  return new Map(entries.map(([key, odds]) => [key, 1 / odds / sum]));
}

function getBinaryOppositePick(pick: string): string | null {
  const pairs: Record<string, string> = {
    YES: "NO",
    NO: "YES",
    OVER: "UNDER",
    UNDER: "OVER",
    OVER_0_5: "UNDER_0_5",
    UNDER_0_5: "OVER_0_5",
    OVER_1_5: "UNDER_1_5",
    UNDER_1_5: "OVER_1_5",
    OVER_2_5: "UNDER_2_5",
    UNDER_2_5: "OVER_2_5",
    OVER_3_5: "UNDER_3_5",
    UNDER_3_5: "OVER_3_5",
    OVER_4_5: "UNDER_4_5",
    UNDER_4_5: "OVER_4_5",
  };

  return pairs[pick] ?? null;
}

function getSupportedMarket(value: string): SupportedMarket | null {
  if (
    value === "ONE_X_TWO" ||
    value === "BTTS" ||
    value === "OVER_UNDER" ||
    value === "OVER_UNDER_HT" ||
    value === "FIRST_HALF_WINNER"
  ) {
    return value;
  }

  return null;
}

function computePinnacleSelection(
  group: OddsRow[],
  market: SupportedMarket,
  pick: string,
) {
  if (market === "ONE_X_TWO") {
    const row = group[0];
    if (
      row?.homeOdds === null ||
      row?.drawOdds === null ||
      row?.awayOdds === null ||
      row?.homeOdds === undefined ||
      row?.drawOdds === undefined ||
      row?.awayOdds === undefined
    ) {
      return null;
    }

    const normalized = normalizeInverseOdds([
      ["HOME", row.homeOdds],
      ["DRAW", row.drawOdds],
      ["AWAY", row.awayOdds],
    ]);
    const oddsMap = new Map<string, number>([
      ["HOME", row.homeOdds],
      ["DRAW", row.drawOdds],
      ["AWAY", row.awayOdds],
    ]);
    const prob = normalized.get(pick);
    const odds = oddsMap.get(pick);

    if (prob === undefined || odds === undefined) return null;
    return { impliedProb: prob, odds };
  }

  if (market === "FIRST_HALF_WINNER") {
    const marketRows = group.filter(
      (row) => row.pick !== null && row.odds !== null,
    );
    if (marketRows.length < 3) return null;

    const entries = marketRows
      .filter(
        (row): row is OddsRow & { pick: string; odds: number } =>
          row.pick !== null && row.odds !== null,
      )
      .map((row) => [row.pick, row.odds] as [string, number]);
    const normalized = normalizeInverseOdds(entries);
    const selectedOdds = entries.find(([entryPick]) => entryPick === pick)?.[1];
    const impliedProb = normalized.get(pick);

    if (selectedOdds === undefined || impliedProb === undefined) return null;
    return { impliedProb, odds: selectedOdds };
  }

  const selected = group.find((row) => row.pick === pick && row.odds !== null);
  if (!selected || selected.odds === null) return null;

  const oppositePick = getBinaryOppositePick(pick);
  const opposite =
    oppositePick === null
      ? null
      : group.find((row) => row.pick === oppositePick && row.odds !== null);

  if (opposite?.odds !== null && opposite?.odds !== undefined) {
    const normalized = normalizeInverseOdds([
      [pick, selected.odds],
      [oppositePick as string, opposite.odds],
    ]);
    const impliedProb = normalized.get(pick);
    if (impliedProb === undefined) return null;
    return { impliedProb, odds: selected.odds };
  }

  return { impliedProb: 1 / selected.odds, odds: selected.odds };
}

function summarize(label: string, rows: SupportedRecord[]): Aggregate {
  const total = rows.length;
  const wins = rows.filter((row) => row.correct).length;
  const losses = total - wins;
  const actualOdds = rows
    .map((row) => row.actualOdds)
    .filter((row): row is number => row !== null);

  const actualProfit =
    actualOdds.length === total
      ? rows.reduce(
          (sum, row) =>
            sum + (row.correct ? (row.actualOdds as number) - 1 : -1),
          0,
        )
      : null;

  const pinnacleProfit = rows.reduce(
    (sum, row) => sum + (row.correct ? row.pinnacleOdds - 1 : -1),
    0,
  );

  return {
    label,
    total,
    wins,
    losses,
    avgModelProb: rows.reduce((sum, row) => sum + row.modelProb, 0) / total,
    avgPinnacleProb:
      rows.reduce((sum, row) => sum + row.pinnacleProb, 0) / total,
    avgEdge: rows.reduce((sum, row) => sum + row.edge, 0) / total,
    avgActualOdds: average(actualOdds),
    avgPinnacleOdds:
      rows.reduce((sum, row) => sum + row.pinnacleOdds, 0) / total,
    actualProfit,
    pinnacleProfit,
  };
}

function renderAggregateTable(
  title: string,
  rows: Aggregate[],
  includeActualRoi: boolean,
): string[] {
  const lines: string[] = [];
  lines.push(`## ${title}`);
  lines.push("");

  if (rows.length === 0) {
    lines.push("Aucune ligne exploitable.");
    lines.push("");
    return lines;
  }

  const header = includeActualRoi
    ? "| Segment | Picks | Hit rate | Avg model P | Avg Pinnacle P | Avg edge | Avg Pinnacle odds | ROI Pinnacle | ROI réel |"
    : "| Segment | Picks | Hit rate | Avg model P | Avg Pinnacle P | Avg edge | Avg Pinnacle odds | ROI Pinnacle |";
  const divider = includeActualRoi
    ? "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"
    : "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |";

  lines.push(header);
  lines.push(divider);

  for (const row of rows) {
    const hitRate = row.wins / row.total;
    const roiPinnacle = row.pinnacleProfit / row.total;
    const actualRoi =
      row.actualProfit === null ? null : row.actualProfit / row.total;
    if (includeActualRoi) {
      lines.push(
        `| ${row.label} | ${fmtInt(row.total)} | ${fmtPct(hitRate)} | ${fmtPct(row.avgModelProb)} | ${fmtPct(row.avgPinnacleProb)} | ${fmtSignedPct(row.avgEdge)} | ${fmtFloat(row.avgPinnacleOdds)} | ${fmtSignedPct(roiPinnacle)} | ${actualRoi === null ? "—" : fmtSignedPct(actualRoi)} |`,
      );
    } else {
      lines.push(
        `| ${row.label} | ${fmtInt(row.total)} | ${fmtPct(hitRate)} | ${fmtPct(row.avgModelProb)} | ${fmtPct(row.avgPinnacleProb)} | ${fmtSignedPct(row.avgEdge)} | ${fmtFloat(row.avgPinnacleOdds)} | ${fmtSignedPct(roiPinnacle)} |`,
      );
    }
  }

  lines.push("");
  return lines;
}

async function main() {
  const now = new Date();
  const reportDate = now.toISOString().slice(0, 10);
  const reportPath = join(REPORT_DIR, `edge-vs-pinnacle-${reportDate}.md`);

  const settledSelections = await prisma.channelSelection.findMany({
    where: {
      result: { in: ["WON", "LOST"] },
    },
    select: {
      id: true,
      market: true,
      pick: true,
      probability: true,
      odds: true,
      result: true,
      bets: {
        where: { source: "MODEL" },
        select: { oddsSnapshot: true, status: true },
        take: 1,
      },
      channelDecision: {
        select: {
          channel: true,
          modelRun: {
            select: {
              fixtureId: true,
              fixture: {
                select: {
                  season: {
                    select: {
                      competition: {
                        select: { code: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const subjects: SubjectRow[] = settledSelections.map((selection) => {
    const bet = selection.bets[0] ?? null;
    return {
      id: selection.id,
      sourceType: "SELECTION" as const,
      channel: toReportChannel(selection.channelDecision.channel),
      competition:
        selection.channelDecision.modelRun.fixture.season.competition.code,
      fixtureId: selection.channelDecision.modelRun.fixtureId,
      market: selection.market,
      pick: selection.pick,
      modelProb: toNumber(selection.probability) ?? 0,
      correct: (bet?.status ?? selection.result) === "WON",
      actualOdds: toNumber(bet?.oddsSnapshot ?? selection.odds),
    };
  });

  const fixtureIds = Array.from(
    new Set(subjects.map((subject) => subject.fixtureId)),
  );
  const markets = Array.from(
    new Set(subjects.map((subject) => subject.market)),
  );

  const pinnacleRows = await prisma.oddsSnapshot.findMany({
    where: {
      bookmaker: "Pinnacle",
      fixtureId: { in: fixtureIds },
      market: { in: markets as never[] },
    },
    select: {
      fixtureId: true,
      market: true,
      snapshotAt: true,
      pick: true,
      odds: true,
      homeOdds: true,
      drawOdds: true,
      awayOdds: true,
    },
    orderBy: [{ fixtureId: "asc" }, { market: "asc" }, { snapshotAt: "desc" }],
  });

  const oddsGroups = new Map<string, OddsRow[]>();
  for (const row of pinnacleRows) {
    const key = `${row.fixtureId}|${row.market}`;
    const group = oddsGroups.get(key) ?? [];
    group.push({
      fixtureId: row.fixtureId,
      market: row.market,
      snapshotAt: row.snapshotAt,
      pick: row.pick,
      odds: toNumber(row.odds),
      homeOdds: toNumber(row.homeOdds),
      drawOdds: toNumber(row.drawOdds),
      awayOdds: toNumber(row.awayOdds),
    });
    oddsGroups.set(key, group);
  }

  const latestOddsGroups = new Map<string, OddsRow[]>();
  for (const [key, rows] of oddsGroups.entries()) {
    const latest = rows[0]?.snapshotAt.getTime();
    if (latest === undefined) continue;
    latestOddsGroups.set(
      key,
      rows.filter((row) => row.snapshotAt.getTime() === latest),
    );
  }

  const supported: SupportedRecord[] = [];
  const unsupportedByReason = new Map<string, number>();

  for (const subject of subjects) {
    const supportedMarket = getSupportedMarket(subject.market);
    if (supportedMarket === null) {
      const reason = `unsupported-market:${subject.market}`;
      unsupportedByReason.set(
        reason,
        (unsupportedByReason.get(reason) ?? 0) + 1,
      );
      continue;
    }

    const groupKey = `${subject.fixtureId}|${subject.market}`;
    const group = latestOddsGroups.get(groupKey);
    if (!group || group.length === 0) {
      const reason = `missing-pinnacle:${subject.market}`;
      unsupportedByReason.set(
        reason,
        (unsupportedByReason.get(reason) ?? 0) + 1,
      );
      continue;
    }

    const selection = computePinnacleSelection(
      group,
      supportedMarket,
      subject.pick,
    );
    if (!selection) {
      const reason = `unmapped-pick:${subject.market}:${subject.pick}`;
      unsupportedByReason.set(
        reason,
        (unsupportedByReason.get(reason) ?? 0) + 1,
      );
      continue;
    }

    supported.push({
      sourceType: subject.sourceType,
      channel: subject.channel,
      competition: subject.competition,
      fixtureId: subject.fixtureId,
      market: supportedMarket,
      pick: subject.pick,
      correct: subject.correct,
      modelProb: round(subject.modelProb),
      pinnacleProb: round(selection.impliedProb),
      edge: round(subject.modelProb - selection.impliedProb),
      pinnacleOdds: round(selection.odds),
      actualOdds:
        subject.actualOdds === null ? null : round(subject.actualOdds),
    });
  }

  const overallRows = [
    summarize("All supported", supported),
    ...(["EV", "SV", "CONF", "DRAW", "BTTS"] as const)
      .map((channel) => supported.filter((row) => row.channel === channel))
      .filter((rows) => rows.length > 0)
      .map((rows) => summarize(rows[0]?.channel ?? "Unknown", rows)),
  ];

  const byMarketRows = Array.from(
    supported.reduce((map, row) => {
      const key = `${row.channel}|${row.market}`;
      const bucket = map.get(key) ?? [];
      bucket.push(row);
      map.set(key, bucket);
      return map;
    }, new Map<string, SupportedRecord[]>()),
  )
    .map(([, rows]) =>
      summarize(`${rows[0]?.channel} / ${rows[0]?.market}`, rows),
    )
    .sort((a, b) => b.total - a.total || b.avgEdge - a.avgEdge);

  const byCompetitionRows = Array.from(
    supported.reduce((map, row) => {
      const key = `${row.channel}|${row.competition}|${row.market}`;
      const bucket = map.get(key) ?? [];
      bucket.push(row);
      map.set(key, bucket);
      return map;
    }, new Map<string, SupportedRecord[]>()),
  )
    .map(([, rows]) =>
      summarize(
        `${rows[0]?.channel} / ${rows[0]?.competition} / ${rows[0]?.market}`,
        rows,
      ),
    )
    .filter((row) => row.total >= 5)
    .sort((a, b) => b.avgEdge - a.avgEdge || b.total - a.total)
    .slice(0, 25);

  const topPositiveEdges = [...supported]
    .sort((a, b) => b.edge - a.edge)
    .slice(0, 15);
  const topNegativeEdges = [...supported]
    .sort((a, b) => a.edge - b.edge)
    .slice(0, 15);

  const lines: string[] = [];
  lines.push("# Phase 3 — Edge vs Pinnacle");
  lines.push("");
  lines.push(`Generated: ${now.toISOString()}`);
  lines.push("");
  lines.push("## Scope");
  lines.push("");
  lines.push(
    `- Inputs scanned: ${fmtInt(subjects.length)} settled channel selections`,
  );
  lines.push(
    `- Supported rows with Pinnacle comparison: ${fmtInt(supported.length)}`,
  );
  lines.push(
    `- Unsupported or missing-Pinnacle rows: ${fmtInt(subjects.length - supported.length)}`,
  );
  lines.push("- Probability basis:");
  lines.push(
    "  - `ONE_X_TWO` and `FIRST_HALF_WINNER`: normalized inverse odds across 3 outcomes",
  );
  lines.push(
    "  - `BTTS`, `OVER_UNDER`, `OVER_UNDER_HT`: normalized inverse odds when the opposite side exists, raw inverse odds otherwise",
  );
  lines.push(
    "  - `DOUBLE_CHANCE` and `HALF_TIME_FULL_TIME` are excluded from edge math in this first report",
  );
  lines.push("");

  lines.push(...renderAggregateTable("Executive Summary", overallRows, true));
  lines.push(
    ...renderAggregateTable("By Channel / Market", byMarketRows, true),
  );
  lines.push(
    ...renderAggregateTable(
      "Top Channel / League / Market Segments (min 5 picks)",
      byCompetitionRows,
      true,
    ),
  );

  lines.push("## Coverage gaps");
  lines.push("");
  if (unsupportedByReason.size === 0) {
    lines.push("No coverage gaps detected.");
  } else {
    lines.push("| Reason | Rows |");
    lines.push("| --- | ---: |");
    for (const [reason, count] of Array.from(
      unsupportedByReason.entries(),
    ).sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${reason} | ${fmtInt(count)} |`);
    }
  }
  lines.push("");

  lines.push("## Most positive edges");
  lines.push("");
  lines.push(
    "| Channel | League | Market | Pick | Model P | Pinnacle P | Edge | Pinnacle odds | Result |",
  );
  lines.push("| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |");
  for (const row of topPositiveEdges) {
    lines.push(
      `| ${row.channel} | ${row.competition} | ${row.market} | ${row.pick} | ${fmtPct(row.modelProb)} | ${fmtPct(row.pinnacleProb)} | ${fmtSignedPct(row.edge)} | ${fmtFloat(row.pinnacleOdds)} | ${row.correct ? "W" : "L"} |`,
    );
  }
  lines.push("");

  lines.push("## Most negative edges");
  lines.push("");
  lines.push(
    "| Channel | League | Market | Pick | Model P | Pinnacle P | Edge | Pinnacle odds | Result |",
  );
  lines.push("| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |");
  for (const row of topNegativeEdges) {
    lines.push(
      `| ${row.channel} | ${row.competition} | ${row.market} | ${row.pick} | ${fmtPct(row.modelProb)} | ${fmtPct(row.pinnacleProb)} | ${fmtSignedPct(row.edge)} | ${fmtFloat(row.pinnacleOdds)} | ${row.correct ? "W" : "L"} |`,
    );
  }
  lines.push("");

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(reportPath, lines.join("\n") + "\n", "utf8");
  process.stdout.write(`${reportPath}\n`);
}

void main().finally(async () => {
  await prisma.$disconnect();
});
