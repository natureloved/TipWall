import type { Metadata, Viewport } from "next";
import { NimiqProvider } from "@/components/NimiqProvider";
import LocaleDocument from "@/components/LocaleDocument";
import { headers } from "next/headers";
import { resolveServerLocale, serverLocaleDirection } from "@/lib/i18n-server";
import "./globals.css";

export const metadata: Metadata = {
  // Resolve every icon/og URL to an absolute one - naive metadata scrapers
  // (in-app browsers, link unfurlers) don't always resolve relative paths.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://tipwall.vercel.app"),
  title: "TipWall | Public Support Walls",
  description: "Public support walls for people, projects, and communities on Nimiq",
  manifest: "/manifest.json",
  // Site-wide social/app-browser preview image (creator walls override this
  // with their own dynamic OG card). A full 1200×630 banner so link unfurls
  // render as a large card, not a small icon tile.
  openGraph: {
    title: "TipWall | Public Support Walls",
    description: "Public support walls for people, projects, and communities on Nimiq",
    siteName: "TipWall",
    images: [{ url: "/banner.png?v=2", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TipWall | Public Support Walls",
    description: "Public support walls for people, projects, and communities on Nimiq",
    images: ["/banner.png?v=2"],
  },
  // TipWall logo as the site icon everywhere: browser tabs (ico/png),
  // iOS home screen (apple-touch-icon), Android/PWA (manifest icons below
  // plus the 192px png for legacy pickups).
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays enabled (WCAG 1.4.4) - never lock maximumScale/userScalable.
  themeColor: "#f4f0e6",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = resolveServerLocale((await headers()).get('accept-language'))
  return (
    <html lang={locale} dir={serverLocaleDirection(locale)} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <LocaleDocument />
        <NimiqProvider>
          {children}
        </NimiqProvider>
      </body>
    </html>
  );
}
