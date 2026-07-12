"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  useAppKit,
  useAppKitAccount,
  useAppKitProvider,
  useDisconnect,
} from "@reown/appkit/react";
import { PublicKey } from "@solana/web3.js";

/**
 * Reemplaza useWallet() de @solana/wallet-adapter-react, pero corriendo
 * sobre Reown AppKit (wallets tradicionales + login por email/social).
 * Expone `wallet.wallet` con la forma que espera AnchorProvider
 * (publicKey + signTransaction + signAllTransactions).
 */
export function useVeilWallet() {
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<any>("solana");
  const { open } = useAppKit();
  const { disconnect: disconnectFn } = useDisconnect();

  const publicKey = useMemo(() => (address ? new PublicKey(address) : null), [address]);

  const anchorWallet = useMemo(() => {
    if (!publicKey || !walletProvider) return null;
    return {
      publicKey,
      signTransaction: walletProvider.signTransaction?.bind(walletProvider),
      signAllTransactions: walletProvider.signAllTransactions?.bind(walletProvider),
    };
  }, [publicKey, walletProvider]);

  // Los hooks de Reown (open, disconnect) pueden devolver una referencia
  // NUEVA en cada render aunque nada haya cambiado realmente. Si los
  // usaramos directo como dependencias de useCallback/useMemo, romperian
  // la memoizacion y causarian loops infinitos. Los guardamos en refs y
  // exponemos wrappers con identidad 100% estable (deps vacios).
  const openRef = useRef(open);
  openRef.current = open;
  const connect = useCallback(() => openRef.current(), []);

  const disconnectRef = useRef(disconnectFn);
  disconnectRef.current = disconnectFn;
  const disconnect = useCallback(() => disconnectRef.current(), []);

  return useMemo(
    () => ({
      publicKey,
      connected: isConnected,
      wallet: anchorWallet,
      connect,
      disconnect,
    }),
    [publicKey, isConnected, anchorWallet, connect, disconnect]
  );
}
