"use client";

import { ReactNode } from "react";
import { ConnectionProvider } from "@solana/wallet-adapter-react";
import "@/lib/reown-appkit"; // side-effect: inicializa createAppKit() una sola vez
import { SOLANA_DEVNET } from "@/lib/veilmarket";

export function WalletContextProvider({ children }: { children: ReactNode }) {
  // Mantenemos ConnectionProvider solo para el objeto `connection` que ya
  // usan todas las paginas via useConnection(). La seleccion/conexion de
  // wallet ahora la maneja Reown AppKit (ver lib/reown-appkit.ts).
  return (
    <ConnectionProvider endpoint={SOLANA_DEVNET}>{children}</ConnectionProvider>
  );
}
