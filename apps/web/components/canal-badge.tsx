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
  | "WIN_EITHER_HALF";

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
};

const LABEL_KEY: Partial<Record<Canal, string>> = {
  DRAW: "matchNull",
  BTTS: "btts",
  GOALS: "goals",
  CLEAN_SHEET: "cleanSheet",
  TEAM_TOTAL: "teamTotal",
  WIN_EITHER_HALF: "winEitherHalf",
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
