"use client";

import { createAppKit } from "@reown/appkit/react";
import { SolanaAdapter } from "@reown/appkit-adapter-solana";
import { solanaDevnet } from "@reown/appkit/networks";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";

const solanaAdapter = new SolanaAdapter({
  wallets: [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
});

const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "";

const metadata = {
  name: "VeilMarket",
  description:
    "Mercados de prediccion privados para el Mundial 2026, sobre Solana + MagicBlock.",
  url: typeof window !== "undefined" ? window.location.origin : "https://veilmarket.app",
  icons: ["https://veilmarket.app/icon.png"],
};

if (projectId) {
  createAppKit({
    adapters: [solanaAdapter],
    networks: [solanaDevnet],
    defaultNetwork: solanaDevnet,
    metadata,
    projectId,
    features: {
      // Login por email y redes sociales, ademas de wallets tradicionales
      // (Phantom, Solflare). Esto es lo que baja la barrera de entrada
      // para gente sin wallet previa.
      email: true,
      socials: ["google", "x", "discord", "apple"],
      analytics: false,
    },
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "#14F195",
    },
  });
} else {
  console.warn(
    "NEXT_PUBLIC_REOWN_PROJECT_ID no esta configurado. Ve a dashboard.reown.com para obtener uno."
  );
}
