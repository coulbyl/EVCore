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

      {/* Deux sorties : l'accueil pour un visiteur, le tableau de bord pour
          un joueur connecté. « Retour au dashboard » seul renvoyait un
          visiteur vers la connexion (audit du 2026-10-23, P2-6). */}
      <div
        className="flex flex-col items-center gap-3 sm:flex-row"
        style={{ animation: "fade-slide-up 0.5s ease-out 0.15s both" }}
      >
        <Button asChild className="min-h-11">
          <Link href="/">Retour à l&apos;accueil</Link>
        </Button>
        <Button variant="outline" asChild className="min-h-11">
          <Link href="/dashboard">Mon tableau de bord</Link>
        </Button>
      </div>
    </div>
  );
}
