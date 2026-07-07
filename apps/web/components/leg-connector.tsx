// Tree connector for several picks on the same fixture: a vertical trunk with
// a dot marking each pick's branch point and a short horizontal stub reaching
// into its content — e.g. for 2 picks:
//   │
//   ●──
//   │
//   ●──
export function LegConnector({ isLast }: { isLast: boolean }) {
  return (
    <div className="relative w-5 shrink-0 self-stretch" aria-hidden>
      {/* Trunk segment above the dot. */}
      <span className="absolute left-[7px] top-0 h-[0.85rem] w-px bg-muted-foreground/50" />
      {/* Branch point. */}
      <span className="absolute left-[7px] top-[0.85rem] size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
      {/* Horizontal stub into the pick's content. */}
      <span className="absolute left-[7px] top-[0.85rem] h-px w-2.5 -translate-y-1/2 bg-muted-foreground/50" />
      {/* Trunk continuing down to the next dot. */}
      {!isLast && (
        <span className="absolute bottom-0 left-[7px] top-[0.85rem] w-px bg-muted-foreground/50" />
      )}
    </div>
  );
}
