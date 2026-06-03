import { Suspense } from "react";
import { Page, PageHeader, PageHeaderActions, PageContent } from "@evcore/ui";
import { todayIso } from "@/lib/date";
import { getCurrentSession } from "@/domains/auth/use-cases/get-current-session";
import { IndicesDrawerButton } from "@/components/indices-drawer-button";
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
      <PageHeader>
        <div />
        <PageHeaderActions>
          <IndicesDrawerButton />
          <Suspense fallback={null}>
            <FixturesFilters date={date} />
          </Suspense>
        </PageHeaderActions>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-hidden rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <FixturesTable date={date} isAdmin={isAdmin} />
      </PageContent>
    </Page>
  );
}
