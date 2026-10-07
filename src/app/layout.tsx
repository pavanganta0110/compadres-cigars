import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, Permanent_Marker } from "next/font/google";
import "./globals.css";

const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-display", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const marker = Permanent_Marker({ subsets: ["latin"], weight: "400", variable: "--font-marker", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Compadres Cigars | Premium Dominican Cigars by the Box", template: "%s | Compadres Cigars" },
  description: "Premium handcrafted Dominican cigars, sold by the box. Kansas City, MO. Adults 21+ only.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${marker.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
