import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EVCore — Arrêtez de parier. Commencez à investir.",
  description:
    "EVCore alloue une mise sur chaque pick sélectionné par ses canaux SAFE, CONF et BB. Une position calculée, répétée sur la durée — comme un portefeuille.",
  metadataBase: new URL("https://c-evcore.com"),
  openGraph: {
    title: "EVCore — Arrêtez de parier. Commencez à investir.",
    description:
      "EVCore alloue une mise sur chaque pick sélectionné par ses canaux SAFE, CONF et BB. Une position calculée, répétée sur la durée — comme un portefeuille.",
    url: "https://c-evcore.com",
    siteName: "EVCore",
    images: [
      {
        url: "/screenshots/desktop.png",
        width: 1200,
        height: 630,
        alt: "EVCore — Console d'analyse",
      },
    ],
    type: "website",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "EVCore — Arrêtez de parier. Commencez à investir.",
    description:
      "EVCore alloue une mise sur chaque pick sélectionné par ses canaux SAFE, CONF et BB. Une position calculée, répétée sur la durée — comme un portefeuille.",
    images: ["/screenshots/desktop.png"],
  },
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="scrollbar-dark h-dvh overflow-y-auto">{children}</div>;
}
