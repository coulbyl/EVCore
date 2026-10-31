import process from "node:process";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Ne plus annoncer « x-powered-by: Next.js » (audit du 2026-10-23, P3-1).
  poweredByHeader: false,
  // Opening the dev server from a phone on the local network: its address,
  // e.g. NEXT_DEV_ORIGINS=192.168.1.20 (dev only, Next blocks it otherwise).
  allowedDevOrigins: process.env.NEXT_DEV_ORIGINS?.split(",") ?? [],
  experimental: {
    // `@evcore/ui` is one barrel of 54 exports, Radix and Sonner among them:
    // a page importing one of them got all (C0, measured in A12).
    optimizePackageImports: ["@evcore/ui"],
  },
  async redirects() {
    return [
      {
        source: "/dashboard/params/account",
        destination: "/dashboard/params/account/profil",
        permanent: false,
      },
      // Screens removed for everyone (15-todo.md, E1): an old bookmark lands
      // on the screen that replaced it rather than on a 404. The dashboard
      // layout cannot do it, it never runs for a route that does not exist.
      ...[
        ["/dashboard/bet-slips", "/me"],
        ["/dashboard/bankroll", "/me"],
        ["/dashboard/formation", "/me/help"],
        ["/dashboard/glossaire", "/me/help"],
      ].flatMap(([from, to]) => [
        // Not permanent: the admin overhaul (phase G) may reuse an address.
        { source: from, destination: to, permanent: false },
        { source: `${from}/:path*`, destination: to, permanent: false },
      ]),
    ];
  },
  async headers() {
    return [
      {
        // En-têtes de sécurité sur toutes les routes (audit du 2026-10-23,
        // P3-1 : ni HSTS, ni X-Frame-Options). Valeurs de la doc Next
        // embarquée ; HSTS sans « preload », qui engage le domaine au-delà
        // de ce site. Pas encore de Content-Security-Policy : à écrire avec
        // la liste réelle des origines (API, images api-sports, Next).
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
      {
        // Le service worker doit toujours être re-vérifié par le navigateur
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // Le manifest doit être frais pour que Chrome détecte les mises à jour
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.api-sports.io",
      },
    ],
  },
};

// Les pages de développement (vitrine des composants, bancs e2e) sont
// nommées `page.dev.tsx` : sous `next dev` l'extension `dev.tsx` en fait des
// routes ; un build de production ne les compile pas du tout. C'est la phase
// de Next qui décide, pas une variable d'environnement.
const DEFAULT_PAGE_EXTENSIONS = ["tsx", "ts", "jsx", "js"];

export default function config(phase) {
  return withNextIntl({
    ...nextConfig,
    pageExtensions:
      phase === PHASE_DEVELOPMENT_SERVER
        ? ["dev.tsx", ...DEFAULT_PAGE_EXTENSIONS]
        : DEFAULT_PAGE_EXTENSIONS,
  });
}
