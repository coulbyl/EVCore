import { InfoTooltip } from "@/components/info-tooltip";

// Informational only — never reflects a scoring/EV adjustment (that
// correction lives in the backend's rolling-stats recentForm calculation
// instead, see rolling-stats.service.ts). Rendered next to the team's own
// name (via FixtureName's homeBadge/awayBadge slots) so which team it's
// about is never ambiguous — spelled out in full rather than icon-only so
// the meaning doesn't depend on a hover-only tooltip (broken on mobile).
export function NewCoachChip({ locale }: { locale: string }) {
  const loc = locale === "en" ? "en" : "fr";
  const label = loc === "en" ? "New coach" : "Nouveau coach";
  const description =
    loc === "en"
      ? "Fewer than 5 matches played under the current coach. Teams have historically outperformed their recent form by +0.08 pt/match in this window — informational only, never affects the model's probability."
      : "Moins de 5 matchs joués sous l'entraîneur actuel. Historiquement, les équipes surperforment leur forme récente de +0.08 pt/match dans cette fenêtre — purement informatif, n'affecte jamais la probabilité du modèle.";

  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-new-coach/30 bg-new-coach-soft py-0.5 pr-1 pl-1.5 text-[0.6rem] font-semibold whitespace-nowrap text-new-coach">
      {label}
      <InfoTooltip label={label} description={description} side="bottom" />
    </span>
  );
}
