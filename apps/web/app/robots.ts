import type { MetadataRoute } from "next";

// robots.txt renvoyait 404 (audit du 2026-10-23, P2-5). Les pages publiques
// sont indexables ; le tableau de bord, les étapes de compte et l'API non.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/api",
        "/auth/verify",
        "/auth/reset-password",
        "/auth/forgot-password",
      ],
    },
    sitemap: "https://c-evcore.com/sitemap.xml",
  };
}
