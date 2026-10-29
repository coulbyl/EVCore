import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@evcore/ui/cn";

/**
 * Les lignes filetées : la liste du tableau d'affichage, une chose par ligne,
 * séparées par un filet de 1 px, sans carte ni ombre (13-style.md § 4).
 * Chaque ligne fait au moins 56 px de haut, pour le doigt.
 */
export function RowList({
  label,
  children,
  className,
}: {
  /** Ce que la liste contient, pour les lecteurs d'écran. */
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ul aria-label={label} className={cn("divide-y divide-border", className)}>
      {children}
    </ul>
  );
}

/**
 * Une ligne : à gauche ce qui l'identifie (`leading`, une pastille, une
 * heure), au milieu son titre et sa ligne secondaire, à droite sa valeur
 * (une cote, « 7 sur 10 ») et, si elle mène quelque part, un chevron.
 * Le texte se replie, il n'est jamais tronqué.
 */
export function Row({
  href,
  title,
  meta,
  leading,
  value,
  trailing,
  muted = false,
  className,
}: {
  href?: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  leading?: React.ReactNode;
  value?: React.ReactNode;
  /** Remplace le chevron (un signe ✓, un bouton). */
  trailing?: React.ReactNode;
  /** Une ligne grisée : un produit absent, un match sans lecture. */
  muted?: boolean;
  className?: string;
}) {
  const body = (
    <>
      {leading ? <span className="shrink-0">{leading}</span> : null}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-body font-medium",
            muted && "font-normal text-muted-foreground",
          )}
        >
          {title}
        </span>
        {meta ? (
          <span className="block text-meta text-muted-foreground">{meta}</span>
        ) : null}
      </span>
      {value ? (
        <span className="shrink-0 score text-bet font-semibold">{value}</span>
      ) : null}
      {trailing ??
        (href ? (
          <ChevronRight
            aria-hidden
            strokeWidth={2}
            className="size-[1.125rem] shrink-0 text-icon-subtle"
          />
        ) : null)}
    </>
  );

  const layout = cn("flex min-h-14 items-center gap-3 py-2", className);

  return (
    <li>
      {href ? (
        <Link
          href={href}
          className={cn(
            layout,
            "-mx-2 rounded-md px-2 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
          )}
        >
          {body}
        </Link>
      ) : (
        <div className={layout}>{body}</div>
      )}
    </li>
  );
}
