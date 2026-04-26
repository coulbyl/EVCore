type Canal = "EV" | "SV" | "CONF";

const STYLES: Record<Canal, { color: string; soft: string }> = {
  EV: { color: "var(--canal-ev)", soft: "var(--canal-ev-soft)" },
  SV: { color: "var(--canal-sv)", soft: "var(--canal-sv-soft)" },
  CONF: { color: "var(--canal-conf)", soft: "var(--canal-conf-soft)" },
};

const LABELS: Record<Canal, string> = {
  EV: "EV",
  SV: "SV",
  CONF: "Conf.",
};

export function CanalBadge({ canal }: { canal: Canal }) {
  const s = STYLES[canal];
  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em]"
      style={{
        color: s.color,
        background: s.soft,
        border: `1px solid color-mix(in srgb, ${s.color} 22%, transparent)`,
      }}
    >
      {LABELS[canal]}
    </span>
  );
}
