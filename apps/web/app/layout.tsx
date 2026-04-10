import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "./providers";
import { PwaRegister } from "./pwa-register";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
  themeColor: "#142033",
};

export const metadata: Metadata = {
  title: "Console EVCore",
  description:
    "Console opérateur pour les analyses EVCore, les coupons et les flux d'audit.",
  // manifest est auto-généré par app/manifest.ts — ne pas dupliquer ici
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EVCore",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
