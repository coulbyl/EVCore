import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EVCore",
    short_name: "EVCore",
    description:
      "Analyses de football : probabilités, raisonnement et résultats réglés, pertes comprises. 18+.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#e5ebf2",
    theme_color: "#142033",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      // SVG retiré : non supporté de façon fiable par Chrome dans le manifest
    ],
    // Plus de captures d'écran : celles de juillet montraient le nom et la
    // photo du fondateur, un solde de 500 millions de francs, des « +63 % »
    // et le menu « Investir » (audit du 2026-10-23, P1-4). Le manifeste est
    // valide sans ; de nouvelles captures sans donnée de compte pourront
    // revenir avec la passe sur la coquille.
  };
}
