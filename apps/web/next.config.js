import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Ensure runtime access to `content/formation/**` when using `output: "standalone"`.
  // These files are read via `fs` at runtime, so they must be included in Next.js output file tracing.
  outputFileTracingIncludes: {
    "/*": ["./content/formation/**/*"],
  },
  async headers() {
    return [
      {
        // Le service worker doit toujours être re-vérifié par le navigateur
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // Le manifest doit être frais pour que Chrome détecte les mises à jour
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
        ],
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
