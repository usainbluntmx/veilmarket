import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { WalletContextProvider } from "@/components/WalletContextProvider";
import { NetworkBackground } from "@/components/NetworkBackground";
import { LanguageProvider } from "@/lib/i18n";
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
  title: "VeilMarket — World Cup 2026",
  description:
    "Private prediction markets for the World Cup 2026, in real time on Solana + MagicBlock.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#080808",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${monoFont.variable}`}>
        <NetworkBackground />
        <LanguageProvider>
          <WalletContextProvider>{children}</WalletContextProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
