import type { Metadata, Viewport } from "next";
import { Mulish, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Mulish = the zelos display/body face. JetBrains Mono for the packet table.
const mulish = Mulish({
  weight: ["600", "700", "800", "900"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-mulish",
  display: "swap",
});

const mono = JetBrains_Mono({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-jbmono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rig Console — LIDAR · Switch · Steering",
  description: "Control and observe the in-car SOME/IP Ethernet rig.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mulish.variable} ${mono.variable}`}>
      <body className="font-sans text-ink">{children}</body>
    </html>
  );
}
