import { Suspense } from "react";
import { Page, PageContent } from "@evcore/ui";
import { todayIso } from "@/lib/date";
import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";
import type { FixtureFilters } from "@/domains/fixture/types/fixture";
import { FixturesFilters } from "./components/fixtures-filters";
import { FixturesTable } from "./components/fixtures-table";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): FixtureFilters {
  const str = (key: string) =>
    typeof sp[key] === "string" ? (sp[key] as string) : undefined;

  return {
    date: str("date") ?? todayIso(),
    competition: str("competition") ?? "ALL",
    decision: (str("decision") as FixtureFilters["decision"]) ?? "ALL",
    status: (str("status") as FixtureFilters["status"]) ?? "ALL",
    timeSlot: (str("timeSlot") as FixtureFilters["timeSlot"]) ?? "ALL",
    betStatus: (str("betStatus") as FixtureFilters["betStatus"]) ?? "ALL",
    canal: (str("canal") as FixtureFilters["canal"]) ?? "ALL",
  };
}

export default async function FixturesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const session = await getCurrentSession();
  const isAdmin = session?.user.role === "ADMIN";

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-hidden rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="flex h-full min-h-0 flex-col gap-5">
          <Suspense fallback={null}>
            <FixturesFilters filters={filters} />
          </Suspense>

          <div className="min-h-0 flex-1">
            <FixturesTable filters={filters} isAdmin={isAdmin} />
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
