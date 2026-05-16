import { NextResponse } from "next/server";
import { z } from "zod";

export const revalidate = 3600; // ISR — revalidate every hour

const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";
// League 1 = FIFA World Cup (all editions)
const WC_LEAGUE_ID = 1;
const WC_SEASON = 2026;

const TeamSchema = z.object({
  id: z.number(),
  name: z.string(),
  logo: z.string(),
});

const EntryAllSchema = z.object({
  played: z.number(),
  win: z.number(),
  draw: z.number(),
  lose: z.number(),
  goals: z.object({ for: z.number(), against: z.number() }),
});

const StandingEntrySchema = z.object({
  rank: z.number(),
  team: TeamSchema,
  points: z.number(),
  goalsDiff: z.number(),
  group: z.string(),
  all: EntryAllSchema,
});

const ApiResponseSchema = z.object({
  response: z.array(
    z.object({
      league: z.object({
        standings: z.array(z.array(StandingEntrySchema)),
      }),
    }),
  ),
});

export type WC2026Team = {
  rank: number;
  name: string;
  logo: string;
  played: number;
  win: number;
  draw: number;
  lose: number;
  points: number;
  goalsDiff: number;
  goalsFor: number;
  goalsAgainst: number;
};

export type WC2026Group = {
  name: string;
  teams: WC2026Team[];
};

export type WC2026StandingsData = {
  groups: WC2026Group[];
};

export async function GET() {
  const apiKey = process.env.API_FOOTBALL_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "API_FOOTBALL_KEY not configured" },
      { status: 500 },
    );
  }

  const res = await fetch(
    `${API_FOOTBALL_BASE}/standings?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`,
    {
      headers: { "x-apisports-key": apiKey },
      next: { revalidate: 3600 },
    },
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: `API Football error: ${res.status}` },
      { status: 502 },
    );
  }

  const raw: unknown = await res.json();
  const parsed = ApiResponseSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Unexpected response shape" },
      { status: 502 },
    );
  }

  const standingsArrays = parsed.data.response[0]?.league.standings ?? [];

  const groups: WC2026Group[] = standingsArrays.map((group) => ({
    name: group[0]?.group ?? "",
    teams: group.map((entry) => ({
      rank: entry.rank,
      name: entry.team.name,
      logo: entry.team.logo,
      played: entry.all.played,
      win: entry.all.win,
      draw: entry.all.draw,
      lose: entry.all.lose,
      points: entry.points,
      goalsDiff: entry.goalsDiff,
      goalsFor: entry.all.goals.for,
      goalsAgainst: entry.all.goals.against,
    })),
  }));

  return NextResponse.json({ groups } satisfies WC2026StandingsData);
}
