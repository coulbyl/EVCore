import { redirect } from "next/navigation";
import { listTechnicalDocs } from "@/domains/technical-docs/server/technical-docs-content";

export default async function TechnicalDocsIndexPage() {
  const docs = await listTechnicalDocs();
  const first = docs[0]?.slug ?? "apercu";
  redirect(`/dashboard/documentation-technique/${first}`);
}
