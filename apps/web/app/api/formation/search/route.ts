import { NextResponse } from "next/server";
import type { FormationCategory } from "@/domains/formation/types/formation";
import { searchFormationContent } from "@/domains/formation/server/formation-content";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const category = url.searchParams.get("category") as FormationCategory | null;

  if (!category) {
    return NextResponse.json(
      { matches: [], error: "Missing category" },
      { status: 400 },
    );
  }

  const matches = await searchFormationContent({ category, q });

  return NextResponse.json(
    { matches },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
