import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@evcore/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6 text-center">
      <span
        className="inline-flex size-20 items-center justify-center rounded-[1.6rem] border border-border bg-panel"
        style={{ animation: "icon-float 4s ease-in-out infinite" }}
      >
        <FileQuestion size={36} className="text-muted-foreground" />
      </span>

      <div
        className="flex flex-col gap-2"
        style={{ animation: "fade-slide-up 0.5s ease-out both" }}
      >
        <p className="text-6xl font-bold tracking-tight text-foreground">404</p>
        <p className="text-lg font-medium text-foreground">Page introuvable</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cette page n&apos;existe pas ou a été déplacée.
        </p>
      </div>

      <div style={{ animation: "fade-slide-up 0.5s ease-out 0.15s both" }}>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Retour au dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
