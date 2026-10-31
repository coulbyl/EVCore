import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Sheet } from "@/components/scoreboard/sheet/sheet";
import { helpSheet } from "@/domains/help/help-sheets";
import { displayLocaleOf } from "@/helpers/scoreboard-format";

/** `**…**` in a sheet's text: the few words read first. */
function emphasised(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

/**
 * A help sheet (09 § 3) over the screen it was opened from: its title, a
 * few lines, the example with figures set apart, and the one link to the
 * screen it is about.
 */
export async function HelpSheetView({ slug }: { slug: string }) {
  const [t, locale] = await Promise.all([getTranslations("help"), getLocale()]);
  const sheet = helpSheet(slug, displayLocaleOf(locale));
  if (!sheet) notFound();
  return (
    <Sheet title={sheet.title} fallbackHref="/me/help">
      <div className="flex flex-col gap-3 text-body">
        {sheet.paragraphs.map((paragraph) => (
          <p key={paragraph}>{emphasised(paragraph)}</p>
        ))}
        <figure className="rounded-[0.875rem] border border-border bg-muted/50 p-3">
          <figcaption className="text-meta text-muted-foreground">
            {t("example")}
          </figcaption>
          <p className="score text-bet font-semibold">{sheet.example}</p>
        </figure>
        <Link
          href={sheet.link.href}
          className="self-start py-2 font-medium underline underline-offset-4"
        >
          {sheet.link.label} ›
        </Link>
      </div>
    </Sheet>
  );
}
