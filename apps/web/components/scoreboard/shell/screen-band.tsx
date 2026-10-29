import { cn } from "@evcore/ui/cn";

/**
 * Le bandeau encre en tête de chaque écran (13-style.md § 2 ; tranché le
 * 29/10 : un bandeau sur chaque onglet).
 *
 * Sur téléphone, sa première ligne porte la marque et les actions (cloche,
 * initiale) ; dessous, `children` porte ce qui est propre à l'écran (la
 * ligne Hier, les puces de jour…). Sur ordinateur, la marque et les actions
 * vivent dans la colonne gauche : il ne reste que `children`, et le bandeau
 * disparaît s'il n'y en a pas.
 */
export function ScreenBand({
  brand,
  actions,
  children,
}: {
  brand: string;
  actions: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header
      className={cn(
        // En sombre, l'encre du bandeau et le sol sont presque égaux : un
        // filet les sépare (maquette « Aujourd'hui · thème sombre »).
        "bg-band px-4 pb-3.5 text-band-foreground pt-[max(1rem,env(safe-area-inset-top))] dark:border-b dark:border-band-rule lg:px-6 lg:pt-4",
        !children && "lg:hidden",
      )}
    >
      <div className="flex min-h-11 items-center justify-between lg:hidden">
        <span className="score text-title font-bold">{brand}</span>
        {actions}
      </div>
      {children ? (
        <div className="mt-3 border-t border-band-rule pt-3 lg:mt-0 lg:border-t-0 lg:pt-0">
          {children}
        </div>
      ) : null}
    </header>
  );
}
