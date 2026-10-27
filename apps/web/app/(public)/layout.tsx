import type { Metadata } from "next";

// Titre et description des pages publiques : la promesse du produit en clair
// (football, probabilités, résultats réglés, gratuit, 18+), sans le discours
// « investissement » ni les noms de canaux (audit du 2026-10-23, P1-3 ; règles
// de rédaction dans apps/web/PRODUCT.md). L'image de partage est générée par
// opengraph-image.tsx et twitter-image.tsx, qui priment sur ce bloc.
const TITLE = "EVCore — Avant de parier, lis le match";
const DESCRIPTION =
  "Analyses de football gratuites : chaque match lu en probabilités, avec le raisonnement et tous les résultats réglés, pertes comprises. Réservé aux 18+.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL("https://c-evcore.com"),
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://c-evcore.com",
    siteName: "EVCore",
    type: "website",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="h-dvh overflow-y-auto">{children}</div>;
}
