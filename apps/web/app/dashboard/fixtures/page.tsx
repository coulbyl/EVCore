import { Suspense } from "react";
import { Page, PageContent } from "@evcore/ui";
import { todayIso } from "@/lib/date";
import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";
import { FixturesFilters } from "./components/fixtures-filters";
import { FixturesTable } from "./components/fixtures-table";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FixturesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const date = typeof sp["date"] === "string" ? sp["date"] : todayIso();
  const session = await getCurrentSession();
  const isAdmin = session?.user.role === "ADMIN";

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-hidden rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="flex h-full min-h-0 flex-col gap-5">
          <Suspense fallback={null}>
            <FixturesFilters date={date} />
          </Suspense>

          <div className="min-h-0 flex-1">
            <FixturesTable date={date} isAdmin={isAdmin} />
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
