import type { Metadata } from "next";
import { Cinzel, Inter, Jost, Permanent_Marker, Playfair_Display } from "next/font/google";
import "./globals.css";

// Storefront type: a high-contrast Didone for headlines, engraved Roman capitals (like a cigar band) for labels and buttons, a light geometric sans for body.
const display = Playfair_Display({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const label = Cinzel({ subsets: ["latin"], variable: "--font-label", display: "swap" });
const body = Jost({ subsets: ["latin"], variable: "--font-body", display: "swap" });
// The admin portal keeps a sturdy UI font so tables and numbers stay easy to read.
const admin = Inter({ subsets: ["latin"], variable: "--font-admin", display: "swap" });
const marker = Permanent_Marker({ subsets: ["latin"], weight: "400", variable: "--font-marker", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Compadres Cigars | Premium Dominican Cigars by the Box", template: "%s | Compadres Cigars" },
  description: "Premium handcrafted Dominican cigars, sold by the box. Kansas City, MO. Adults 21+ only.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${label.variable} ${body.variable} ${admin.variable} ${marker.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
