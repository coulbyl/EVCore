import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Providers } from "./providers";
import { PwaRegister } from "./pwa-register";
import { WC2026EventManager } from "@/components/events/wc2026/wc2026-event-manager";
import { WC2026Splash } from "@/components/events/wc2026/wc2026-splash";
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
    "Console opérateur pour les analyses EVCore, les fixtures et les flux d'audit.",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
        <PwaRegister />
        <WC2026EventManager />
        <WC2026Splash />
      </body>
    </html>
  );
}
