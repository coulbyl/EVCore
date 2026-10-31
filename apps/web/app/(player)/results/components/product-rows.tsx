import { getTranslations } from "next-intl/server";
import { FormStrip } from "@/components/scoreboard/ui/form-strip";
import type {
  AiSummary,
  ProductSummary,
} from "@/domains/results/types/results";

/**
 * One line per product, in the order of Aujourd'hui (08 § 1): its name,
 * its last ten days played as squares whatever the period, and one figure,
 * « 11 jours gagnés sur 14 » over the period. Under ten settled days:
 * « Trop tôt · 1 jour », the squares it has, never a percentage. Then
 * « Avis IA » apart, counted per opinion. The product sheet the lines open
 * comes with C10.
 */
export async function ProductRows({
  products,
  ai,
}: {
  products: readonly ProductSummary[];
  ai: AiSummary;
}) {
  const t = await getTranslations("results");
  return (
    <div className="flex flex-col">
      <ul className="divide-y divide-border">
        {products.map((product) => (
          <ResultRow
            key={product.product}
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
  name,
  last,
  figure,
  muted,
  stripLabel,
}: {
  name: string;
  last: readonly ("won" | "lost")[];
  figure: string;
  muted: boolean;
  stripLabel: string;
}) {
  return (
    <li className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 py-2">
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
    </li>
  );
}
