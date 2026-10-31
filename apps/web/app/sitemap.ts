import type { MetadataRoute } from "next";

const BASE = "https://c-evcore.com";

// sitemap.xml renvoyait 404 (audit du 2026-10-23, P2-5) : les pages
// publiques, et elles seules.
export default function sitemap(): MetadataRoute.Sitemap {
  const legalUpdated = new Date("2026-10-27");
  return [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 1 },
    // La page de conformité : tout ce que la landing affirme (11 § 1).
    { url: `${BASE}/resultats`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/auth/register`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/auth/login`, changeFrequency: "yearly", priority: 0.4 },
    ...[
      "/cgu",
      "/confidentialite",
      "/jeu-responsable",
      "/mentions-legales",
    ].map((path) => ({
      url: `${BASE}${path}`,
      lastModified: legalUpdated,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
