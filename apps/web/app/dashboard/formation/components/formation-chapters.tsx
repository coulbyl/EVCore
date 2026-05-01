import Link from "next/link";
import { Clock } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@evcore/ui";
import type { FormationChapter } from "@/domains/formation/types/formation";

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function FormationChapters({
  chapters,
  currentStart,
}: {
  chapters: FormationChapter[];
  currentStart: number;
}) {
  if (chapters.length === 0) return null;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Chapitres</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {chapters.map((chapter) => {
          const active = chapter.start === currentStart;
          return (
            <Link
              key={`${chapter.label}-${chapter.start}`}
              href={`?t=${chapter.start}`}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition-colors ${
                active
                  ? "border-accent/30 bg-accent/10 text-foreground"
                  : "border-border bg-panel-strong hover:bg-secondary"
              }`}
            >
              <span className="min-w-0 truncate">{chapter.label}</span>
              <Badge
                variant="secondary"
                className="shrink-0 gap-1 tabular-nums"
              >
                <Clock size={12} />
                {formatTime(chapter.start)}
              </Badge>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
