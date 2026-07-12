"use client";

import { FC, ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SolanaMobileWalletAdapter, createDefaultAuthorizationResultCache, createDefaultAddressSelector, createDefaultWalletNotFoundHandler } from "@solana-mobile/wallet-adapter-mobile";

import "@solana/wallet-adapter-react-ui/styles.css";

const SOLANA_DEVNET_RPC = "https://api.devnet.solana.com";

export const WalletContextProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const endpoint = SOLANA_DEVNET_RPC;

  const wallets = useMemo(
    () => [
      new SolanaMobileWalletAdapter({
        addressSelector: createDefaultAddressSelector(),
        appIdentity: {
          name: "VeilMarket",
          uri: typeof window !== "undefined" ? window.location.origin : "",
          icon: "/icon.png",
        },
        authorizationResultCache: createDefaultAuthorizationResultCache(),
        cluster: "devnet",
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
      }),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
