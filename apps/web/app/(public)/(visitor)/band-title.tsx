import { ChevronLeft } from "lucide-react";
import { BackLink } from "@/components/scoreboard/shell/back-link";
import { getBackPlaces } from "@/components/scoreboard/shell/get-back-places";

/**
 * La seconde ligne du bandeau du visiteur sur une page de détail : le
 * retour et le titre de l'écran, comme les sous-pages de Moi. Le retour
 * revient là d'où l'on vient, ou remplace l'adresse par `back.href` sans
 * historique (`BackLink`).
 */
export async function BandTitle({
  title,
  back,
}: {
  title: string;
  back: { href: string; label?: string };
}) {
  const places = await getBackPlaces();
  return (
    <div className="-ms-2 flex items-center gap-1">
      <BackLink
        href={back.href}
        label={back.label}
        places={places}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-band-muted hover:text-band-foreground focus-visible:outline-2 focus-visible:outline-led-on"
      >
        <ChevronLeft aria-hidden strokeWidth={2} className="size-6" />
      </BackLink>
      <h1 className="score text-title font-semibold">{title}</h1>
    </div>
  );
}
