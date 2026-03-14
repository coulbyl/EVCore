import type { Metadata } from "next";
import localFont from "next/font/local";
import { PageShell } from "@evcore/ui";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Console EVCore",
  description:
    "Console opérateur pour les analyses EVCore, les coupons et les flux d'audit.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const navItems = [
    { label: "Tableau de bord", href: "#", active: true },
    { label: "Coupons", href: "#" },
    { label: "Audit", href: "#" },
  ];

  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Providers>
          <PageShell navItems={navItems}>{children}</PageShell>
        </Providers>
      </body>
    </html>
  );
}
