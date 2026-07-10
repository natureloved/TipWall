import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NimiqProvider } from "@/components/NimiqProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TipWall — Creator Tipping Wall",
  description: "A living community tipping wall for creators on Nimiq",
  manifest: "/manifest.json",
  // Site-wide social/app-browser preview image (creator walls override this
  // with their own dynamic OG card). Some in-app browsers use og:image as the
  // app tile when no better icon is picked up.
  openGraph: {
    title: "TipWall — Creator Tipping Wall",
    description: "A living community tipping wall for creators on Nimiq",
    siteName: "TipWall",
    images: [{ url: "/android-chrome-512x512.png", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary",
    title: "TipWall — Creator Tipping Wall",
    description: "A living community tipping wall for creators on Nimiq",
    images: ["/android-chrome-512x512.png"],
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
  // Pinch-zoom stays enabled (WCAG 1.4.4) — never lock maximumScale/userScalable.
  // Single dark theme by design (matches Nimiq Pay's in-app look).
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <NimiqProvider>
          {children}
        </NimiqProvider>
      </body>
    </html>
  );
}
