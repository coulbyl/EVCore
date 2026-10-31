import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FormStrip } from "@/components/scoreboard/ui/form-strip";
import type {
  AiSummary,
  ProductSummary,
  ResultsPeriod,
} from "@/domains/results/types/results";
import { AI_SLUG, productSlug, sheetHref } from "./results-constants";

/**
 * One line per product, in the order of Aujourd'hui (08 § 1): its name,
 * its last ten days played as squares whatever the period, and one figure,
 * « 11 jours gagnés sur 14 » over the period. Under ten settled days:
 * « Trop tôt · 1 jour », the squares it has, never a percentage. Then
 * « Avis IA » apart, counted per opinion. Each line opens its sheet (08 § 2)
 * on the period chosen.
 */
export async function ProductRows({
  products,
  ai,
  period,
}: {
  products: readonly ProductSummary[];
  ai: AiSummary;
  period: ResultsPeriod;
}) {
  const t = await getTranslations("results");
  return (
    <div className="flex flex-col">
      <ul className="divide-y divide-border">
        {products.map((product) => (
          <ResultRow
            key={product.product}
            href={sheetHref(productSlug(product.product), period)}
            name={
              product.retired
                ? `${t(`names.${product.product}`)} · ${t("retired")}`
                : t(`names.${product.product}`)
            }
            last={product.last}
            figure={
              product.tooEarly
                ? t("tooEarlyDays", { count: product.won + product.lost })
                : t("daysWon", {
                    won: product.won,
                    played: product.won + product.lost,
                  })
            }
            muted={product.tooEarly}
            stripLabel={stripLabelOf(product.last, t)}
          />
        ))}
      </ul>
      <ul className="border-t-2 border-foreground">
        <ResultRow
          href={sheetHref(AI_SLUG, period)}
          name={t("ai")}
          last={ai.last}
          figure={
            ai.tooEarly
              ? t("tooEarlyAdvice", { count: ai.won + ai.lost })
              : t("adviceWon", { won: ai.won, played: ai.won + ai.lost })
          }
          muted={ai.tooEarly}
          stripLabel={stripLabelOf(ai.last, t)}
        />
      </ul>
    </div>
  );
}

type Translate = Awaited<ReturnType<typeof getTranslations<"results">>>;

/** « Les 10 derniers jours joués : 8 jours gagnés sur 10 ». */
function stripLabelOf(last: readonly ("won" | "lost")[], t: Translate) {
  return `${t("lastPlayed", { count: last.length })} : ${t("daysWon", {
    won: last.filter((o) => o === "won").length,
    played: last.length,
  })}`;
}

function ResultRow({
  href,
  name,
  last,
  figure,
  muted,
  stripLabel,
}: {
  href: string;
  name: string;
  last: readonly ("won" | "lost")[];
  figure: string;
  muted: boolean;
  stripLabel: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="-mx-2 flex min-h-14 items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="min-w-0 flex-1 basis-32 text-body font-medium">
            {name}
          </span>
          <span className="flex min-w-0 shrink-0 items-center justify-end gap-3">
            {last.length > 0 ? (
              <FormStrip outcomes={last} size="sm" label={stripLabel} />
            ) : null}
            <span
              className={
                muted
                  ? "score min-w-[7.5rem] text-end text-meta text-muted-foreground"
                  : "score min-w-[7.5rem] text-end text-body font-semibold"
              }
            >
              {figure}
            </span>
          </span>
        </span>
        <ChevronRight
          aria-hidden
          strokeWidth={2}
          className="size-[1.125rem] shrink-0 text-icon-subtle"
        />
      </Link>
    </li>
  );
}
