import { useTranslations } from "next-intl";

type Canal =
  | "VALUE"
  | "SAFE"
  | "DOMINANT"
  | "DRAW"
  | "BTTS"
  | "GOALS"
  | "CLEAN_SHEET"
  | "TEAM_TOTAL"
  | "WIN_EITHER_HALF"
  | "FIRST_HALF"
  | "DOUBLE_CHANCE"
  | "RESULT_TOTAL_GOALS"
  | "OVER_UNDER_HT"
  | "RESULT_BTTS"
  | "DRAW_NO_BET"
  | "WIN_TO_NIL"
  | "HALF_TIME_FULL_TIME";

const STYLES: Record<Canal, { color: string; soft: string }> = {
  VALUE: { color: "var(--canal-value)", soft: "var(--canal-value-soft)" },
  SAFE: { color: "var(--canal-safe)", soft: "var(--canal-safe-soft)" },
  DOMINANT: {
    color: "var(--canal-dominant)",
    soft: "var(--canal-dominant-soft)",
  },
  DRAW: {
    color: "var(--canal-draw)",
    soft: "var(--canal-draw-soft)",
  },
  BTTS: { color: "var(--canal-btts)", soft: "var(--canal-btts-soft)" },
  GOALS: { color: "var(--canal-goals)", soft: "var(--canal-goals-soft)" },
  CLEAN_SHEET: {
    color: "var(--canal-clean-sheet)",
    soft: "var(--canal-clean-sheet-soft)",
  },
  TEAM_TOTAL: {
    color: "var(--canal-team-total)",
    soft: "var(--canal-team-total-soft)",
  },
  WIN_EITHER_HALF: {
    color: "var(--canal-win-either-half)",
    soft: "var(--canal-win-either-half-soft)",
  },
  FIRST_HALF: {
    color: "var(--canal-first-half)",
    soft: "var(--canal-first-half-soft)",
  },
  DOUBLE_CHANCE: {
    color: "var(--canal-double-chance)",
    soft: "var(--canal-double-chance-soft)",
  },
  RESULT_TOTAL_GOALS: {
    color: "var(--canal-result-total-goals)",
    soft: "var(--canal-result-total-goals-soft)",
  },
  OVER_UNDER_HT: {
    color: "var(--canal-over-under-ht)",
    soft: "var(--canal-over-under-ht-soft)",
  },
  RESULT_BTTS: {
    color: "var(--canal-result-btts)",
    soft: "var(--canal-result-btts-soft)",
  },
  DRAW_NO_BET: {
    color: "var(--canal-draw-no-bet)",
    soft: "var(--canal-draw-no-bet-soft)",
  },
  WIN_TO_NIL: {
    color: "var(--canal-win-to-nil)",
    soft: "var(--canal-win-to-nil-soft)",
  },
  HALF_TIME_FULL_TIME: {
    color: "var(--canal-half-time-full-time)",
    soft: "var(--canal-half-time-full-time-soft)",
  },
};

const LABEL_KEY: Partial<Record<Canal, string>> = {
  DRAW: "matchNull",
  BTTS: "btts",
  GOALS: "goals",
  CLEAN_SHEET: "cleanSheet",
  TEAM_TOTAL: "teamTotal",
  WIN_EITHER_HALF: "winEitherHalf",
  FIRST_HALF: "firstHalf",
  DOUBLE_CHANCE: "doubleChance",
  RESULT_TOTAL_GOALS: "resultTotalGoals",
  OVER_UNDER_HT: "overUnderHt",
  RESULT_BTTS: "resultBtts",
  DRAW_NO_BET: "drawNoBet",
  WIN_TO_NIL: "winToNil",
  HALF_TIME_FULL_TIME: "halfTimeFullTime",
};

export function CanalBadge({ canal }: { canal: Canal }) {
  const t = useTranslations("picks");
  const s = STYLES[canal];
  const labelKey = LABEL_KEY[canal];
  const label = labelKey ? t(labelKey) : canal === "DOMINANT" ? "VICT" : canal;

  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em]"
      style={{
        color: s.color,
        background: s.soft,
        border: `1px solid color-mix(in srgb, ${s.color} 22%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}
