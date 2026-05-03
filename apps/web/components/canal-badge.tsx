import { useTranslations } from "next-intl";

type Canal = "EV" | "SV" | "CONF" | "DRAW" | "BTTS";

const STYLES: Record<Canal, { color: string; soft: string }> = {
  EV: { color: "var(--canal-ev)", soft: "var(--canal-ev-soft)" },
  SV: { color: "var(--canal-sv)", soft: "var(--canal-sv-soft)" },
  CONF: { color: "var(--canal-conf)", soft: "var(--canal-conf-soft)" },
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
        : canal === "CONF"
          ? "Conf."
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
