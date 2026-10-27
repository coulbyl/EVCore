import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Ne plus annoncer « x-powered-by: Next.js » (audit du 2026-10-23, P3-1).
  poweredByHeader: false,
  // Ensure runtime access to `content/formation/**` when using `output: "standalone"`.
  // These files are read via `fs` at runtime, so they must be included in Next.js output file tracing.
  outputFileTracingIncludes: {
    "/*": ["./content/formation/**/*"],
  },
  async redirects() {
    return [
      {
        source: "/dashboard/params/account",
        destination: "/dashboard/params/account/profil",
        permanent: false,
      },
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

export default withNextIntl(nextConfig);
