"use client";

import { useVeilWallet } from "@/lib/useVeilWallet";
import { useLanguage } from "@/lib/i18n";

export function WalletButton({ style }: { style?: React.CSSProperties }) {
  const wallet = useVeilWallet();
  const { t } = useLanguage();

  if (wallet.connected && wallet.publicKey) {
    const short = `${wallet.publicKey.toBase58().slice(0, 4)}...${wallet.publicKey
      .toBase58()
      .slice(-4)}`;
    return (
      <button
        onClick={() => wallet.disconnect()}
        style={style}
        className="rounded-full px-4 font-mono"
      >
        {short}
      </button>
    );
  }

  return (
    <button
      onClick={() => wallet.connect()}
      style={style}
      className="rounded-full px-4 font-mono"
    >
      {t("connect")}
    </button>
  );
}
