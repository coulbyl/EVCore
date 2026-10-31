/**
 * L'emplacement de la feuille dans la coquille. Sur téléphone et tablette il
 * ne prend aucune place (`contents`) : la feuille y est fixée par-dessus
 * l'écran. À partir de 1024 px, c'est la colonne de droite, qui disparaît
 * quand aucune feuille n'est ouverte (la fente rend alors `null`).
 */
export function SheetColumn({ children }: { children: React.ReactNode }) {
  return (
    <div className="contents lg:block lg:w-[26rem] lg:shrink-0 lg:empty:hidden">
      {children}
    </div>
  );
}
