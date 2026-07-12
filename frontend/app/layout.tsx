import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { WalletContextProvider } from "@/components/WalletContextProvider";
import { NetworkBackground } from "@/components/NetworkBackground";
import "./globals.css";

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "700"],
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "VeilMarket — Mundial 2026",
  description:
    "Mercados de predicción privados para el Mundial 2026, en tiempo real sobre Solana + MagicBlock.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0A0A0A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${displayFont.variable} ${monoFont.variable}`}>
        <NetworkBackground />
        <WalletContextProvider>{children}</WalletContextProvider>
      </body>
    </html>
  );
}
