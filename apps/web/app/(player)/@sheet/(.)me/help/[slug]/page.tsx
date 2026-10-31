import { HelpSheetView } from "../../../../me/help/components/help-sheet-view";

/** A help sheet, on a tap of its line or of a « ? », and on a link. */
export default async function HelpSheetPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <HelpSheetView slug={slug} />;
}
