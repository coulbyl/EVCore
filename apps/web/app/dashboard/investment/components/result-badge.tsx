export function ResultBadge({ isCorrect }: { isCorrect: boolean | null }) {
  if (isCorrect === null) return null;
  return isCorrect ? (
    <span className="text-[0.6rem] font-bold uppercase tracking-widest text-emerald-500">
      ✓ Gagné
    </span>
  ) : (
    <span className="text-[0.6rem] font-bold uppercase tracking-widest text-destructive">
      ✗ Perdu
    </span>
  );
}
