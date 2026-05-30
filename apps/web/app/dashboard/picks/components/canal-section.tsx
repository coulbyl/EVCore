export function CanalSection({
  title,
  color,
  children,
  count,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
  count: number;
}) {
  if (count === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className="h-3.5 w-1 rounded-full"
          style={{ background: color }}
        />
        <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </h2>
        <span
          className="rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold tabular-nums"
          style={{
            color,
            background: `color-mix(in srgb, ${color} 14%, transparent)`,
          }}
        >
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
