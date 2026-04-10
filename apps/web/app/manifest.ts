import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Console EVCore",
    short_name: "EVCore",
    description:
      "Console opérateur pour les analyses EVCore, les coupons et les flux d'audit.",
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
    screenshots: [
      {
        src: "/screenshots/mobile.png",
        sizes: "390x844",
        type: "image/png",
        // form_factor absent = mobile (requis pour le Richer Install UI mobile)
      },
      {
        src: "/screenshots/desktop.png",
        sizes: "1280x800",
        type: "image/png",
        form_factor: "wide",
      },
    ],
  };
}
