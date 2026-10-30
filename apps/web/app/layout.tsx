import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { getLocale } from "next-intl/server";
import { Providers } from "./providers";
import { PwaRegister } from "./pwa-register";
import "./globals.css";

// Not preloaded: 134 kB that every page fetched first, while the player's
// screens are set in Barlow (app/fonts/scoreboard-fonts.ts). The browser
// still loads Geist as soon as a page shows text in it (dashboard, public
// pages), never on the player's screens (C0).
const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  preload: false,
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  preload: false,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
  themeColor: "#142033",
};

export const metadata: Metadata = {
  // « Console EVCore » était le nom d'un outil interne : c'est aussi celui
  // que le téléphone proposait à l'installation (audit du 2026-10-23, P2-5).
  title: "EVCore",
  description:
    "Analyses de football : probabilités, raisonnement et résultats réglés, pertes comprises. 18+.",
  // manifest est auto-généré par app/manifest.ts — ne pas dupliquer ici
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EVCore",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {/* No client messages here: the dashboard sets next-intl's provider,
            the player its own few texts (C0). Every message of the app,
            53 kB, went out with each page. */}
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
