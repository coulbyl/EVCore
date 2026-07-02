import { Page, PageContent } from "@evcore/ui";
import { AnalysisSheetPageClient } from "./components/analysis-sheet-page-client";

// Auth is enforced by the dashboard layout.
export default function AnalysisSheetPage() {
  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <AnalysisSheetPageClient />
      </PageContent>
    </Page>
  );
}
