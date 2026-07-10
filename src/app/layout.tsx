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
