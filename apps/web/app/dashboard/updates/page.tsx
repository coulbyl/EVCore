import { Page, PageContent } from "@evcore/ui";
import { UpdatesPageClient } from "./components/updates-page-client";

export default async function UpdatesPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  // `?id=` : arrivée depuis la notification d'une annonce, qui s'ouvre
  // directement au lieu de laisser chercher dans la liste.
  const { id } = await searchParams;
  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <UpdatesPageClient initialId={id ?? null} />
      </PageContent>
    </Page>
  );
}
