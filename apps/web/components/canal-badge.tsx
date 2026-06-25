import { useTranslations } from "next-intl";

type Canal = "VALUE" | "SAFE" | "DOMINANT" | "DRAW" | "BTTS";

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
};

export function CanalBadge({ canal }: { canal: Canal }) {
  const t = useTranslations("picks");
  const s = STYLES[canal];
  const label =
    canal === "DRAW"
      ? t("matchNull")
      : canal === "BTTS"
        ? t("btts")
        : canal === "DOMINANT"
          ? "VICT"
          : canal;

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
