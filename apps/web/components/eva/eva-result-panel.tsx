import { AlertCircle, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, Skeleton } from "@evcore/ui";
import { MarkdownArticle } from "@/components/markdown-article";
import type { AnalyzeWithEvaResult } from "@/domains/analysis-sheet/types/analysis-sheet";
import { EvaCouponCard } from "./eva-coupon-card";

export function EvaResultPanel({
  result,
  isPending,
  error,
}: {
  result: AnalyzeWithEvaResult | null;
  isPending: boolean;
  error: string | null;
}) {
  if (isPending) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-panel p-5">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Analyse impossible</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!result) return null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-panel p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-accent" />
        <span className="text-sm font-bold uppercase tracking-wide text-foreground">
          Eva
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {result.sheetSummary.fixtureCount} fixtures analysées
        </span>
      </div>

      {result.truncated && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Fiche tronquée</AlertTitle>
          <AlertDescription>
            La période sélectionnée dépasse la limite de fixtures analysées en
            un seul appel — seule une partie a été envoyée à Eva. Réduis la
            période ou ajoute un filtre pour une analyse complète.
          </AlertDescription>
        </Alert>
      )}

      <MarkdownArticle content={result.analysis} variant="chat" />

      {result.coupons.length > 0 && (
        <div className="flex flex-col gap-3">
          {result.coupons.map((coupon) => (
            <EvaCouponCard key={coupon.label} coupon={coupon} />
          ))}
        </div>
      )}

      {result.droppedCoupons.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {result.droppedCoupons.length === 1
            ? "Un coupon proposé par Eva a été écarté par le moteur (jambe non éligible)."
            : `${result.droppedCoupons.length} coupons proposés par Eva ont été écartés par le moteur (jambes non éligibles).`}
        </p>
      )}
    </div>
  );
}
