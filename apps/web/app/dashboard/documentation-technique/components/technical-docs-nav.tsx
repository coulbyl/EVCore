import Link from "next/link";
import type { TechnicalDocSummary } from "@/domains/technical-docs/types/technical-docs";

export function TechnicalDocsNav({
  docs,
  activeSlug,
}: {
  docs: TechnicalDocSummary[];
  activeSlug?: string;
}) {
  return (
    <nav className="flex flex-col gap-1.5">
      {docs.map((doc) => {
        const active = doc.slug === activeSlug;
        return (
          <Link
            key={doc.slug}
            href={`/dashboard/documentation-technique/${doc.slug}`}
            aria-current={active ? "page" : undefined}
            className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-accent/35 bg-accent-soft text-foreground shadow-[inset_0_0_0_1px_rgba(20,184,166,0.16)]"
                : "border-transparent text-muted-foreground hover:border-border hover:bg-panel hover:text-foreground"
            }`}
          >
            {doc.title}
          </Link>
        );
      })}
    </nav>
  );
}
