import { Page, PageContent, PageHeader, Skeleton } from "@evcore/ui";

export default function TrackRecordLoading() {
  return (
    <Page className="flex h-full flex-col">
      <PageHeader className="flex-col items-start gap-3">
        <Skeleton className="h-6 w-40 rounded-full" />
        <Skeleton className="h-9 w-full max-w-xl rounded-xl" />
        <Skeleton className="h-16 w-full max-w-2xl rounded-xl" />
      </PageHeader>
      <PageContent className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <Skeleton className="h-10 w-72 rounded-full" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </PageContent>
    </Page>
  );
}
