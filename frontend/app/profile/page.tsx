"use client";

import { useEffect, useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import Link from "next/link";
import { motion } from "framer-motion";
import { getProgram, fetchBetsForWallet } from "@/lib/veilmarket";
import { WalletButton } from "@/components/WalletButton";
import { AnimatedNumber } from "@/components/AnimatedNumber";

type Stats = {
  balance: number;
  netPnl: number;
  accuracy: number | null;
  marketsJoined: number;
  marketsCreated: number;
  resolvedCount: number;
  wonCount: number;
  totalStaked: number;
};

export default function ProfilePage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!wallet.publicKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const provider = new AnchorProvider(
        connection,
        wallet as unknown as AnchorProvider["wallet"],
        { commitment: "confirmed" }
      );
      const program = getProgram(provider);

      const lamports = await connection.getBalance(wallet.publicKey);
      const myBets = await fetchBetsForWallet(program, wallet.publicKey);
      const allMarkets = await (program.account as any).market.all();
      const marketCache = new Map<string, any>();
      for (const m of allMarkets) marketCache.set(m.publicKey.toBase58(), m.account);

      const myCreated = allMarkets.filter((m: any) =>
        m.account.authority.equals(wallet.publicKey)
      ).length;

      let netPnl = 0;
      let resolvedCount = 0;
      let wonCount = 0;
      let totalStaked = 0;

      for (const b of myBets) {
        const marketAcc = marketCache.get(b.account.market.toBase58());
        const amountSol = b.account.amount.toNumber() / 1_000_000_000;
        totalStaked += amountSol;

        if (marketAcc?.resolved) {
          resolvedCount += 1;
          const won = b.account.predictedOutcome === marketAcc.outcome;
          if (won) {
            wonCount += 1;
            const winningPool = marketAcc.winningPool.toNumber();
            const totalPool = marketAcc.totalPool.toNumber();
            const payout =
              winningPool > 0
                ? (b.account.amount.toNumber() * totalPool) / winningPool / 1_000_000_000
                : amountSol;
            netPnl += payout - amountSol;
          } else {
            netPnl -= amountSol;
          }
        }
      }

      setStats({
        balance: lamports / 1_000_000_000,
        netPnl,
        accuracy: resolvedCount > 0 ? (wonCount / resolvedCount) * 100 : null,
        marketsJoined: myBets.length,
        marketsCreated: myCreated,
        resolvedCount,
        wonCount,
        totalStaked,
      });
    } catch (err) {
      console.error("Error cargando perfil:", err);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  useEffect(() => {
    load();
  }, [load]);

  function copyAddress() {
    if (!wallet.publicKey) return;
    navigator.clipboard.writeText(wallet.publicKey.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const address = wallet.publicKey?.toBase58() ?? "";
  const shortAddress = address ? `${address.slice(0, 4)}...${address.slice(-4)}` : "";
  const explorerTxUrl = wallet.publicKey
    ? `https://explorer.solana.com/address/${address}?cluster=devnet`
    : "#";

  // Logros con umbrales reales, no inventados: cada uno refleja un dato
  // verificable de las stats calculadas arriba.
  const achievements = stats
    ? [
        { icon: "🎯", label: "Primera apuesta", earned: stats.marketsJoined >= 1 },
        {
          icon: "🎖️",
          label: "Tirador certero",
          earned: stats.accuracy !== null && stats.accuracy >= 70 && stats.resolvedCount >= 3,
        },
        { icon: "🛠️", label: "Creador", earned: stats.marketsCreated >= 1 },
        { icon: "🐋", label: "Alta apuesta", earned: stats.totalStaked >= 0.5 },
      ]
    : [];

  return (
    <main className="min-h-dvh pb-24">
      <header className="fixed top-0 w-full z-50 glass-card flex justify-between items-center px-5 py-3 h-16">
        <Link href="/" className="font-bold text-base tracking-tight" style={{ color: "var(--color-primary)" }}>
          VeilMarket
        </Link>
        <WalletButton
          style={{
            backgroundColor: "var(--color-surface-high)",
            color: "var(--color-text)",
            border: "1px solid var(--color-border)",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            height: "34px",
          }}
        />
      </header>

      <div className="pt-24 px-5">
        {!wallet.connected ? (
          <div className="glass-card rounded-2xl p-6 text-center">
            <p className="text-sm text-[color:var(--color-text-dim)]">
              Conecta tu wallet para ver tu perfil.
            </p>
          </div>
        ) : loading || !stats ? (
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="text-sm font-mono text-[color:var(--color-text-dim)]"
          >
            Cargando perfil...
          </motion.p>
        ) : (
          <>
            {/* Titulo + direccion real + PnL real */}
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-2xl font-bold">Perfil</h2>
                <button
                  onClick={copyAddress}
                  className="flex items-center gap-1.5 mt-1 opacity-60 hover:opacity-100 transition-opacity"
                >
                  <span className="text-xs font-mono">{shortAddress}</span>
                  <span className="text-[10px]">{copied ? "✓ copiado" : "📋"}</span>
                </button>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-widest font-bold block mb-1" style={{ color: "var(--color-primary-bright)" }}>
                  Ganancia neta
                </span>
                <span
                  className="text-xl font-bold"
                  style={{
                    color: stats.netPnl >= 0 ? "var(--color-primary-bright)" : "var(--color-secondary-bright)",
                    textShadow: "0 0 15px rgba(20,241,149,0.3)",
                  }}
                >
                  {stats.netPnl >= 0 ? "+" : ""}
                  {stats.netPnl.toFixed(3)} SOL
                </span>
                <p className="text-[9px] text-[color:var(--color-text-dim)] mt-0.5">
                  solo mercados resueltos
                </p>
              </div>
            </div>

            {/* Stats reales */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="glass-card p-4 rounded-2xl flex flex-col justify-between aspect-square">
                <span className="text-2xl">📊</span>
                <div>
                  <p className="text-[10px] uppercase text-[color:var(--color-text-dim)] mb-1">
                    % de aciertos
                  </p>
                  <p className="text-2xl font-bold">
                    {stats.accuracy !== null ? `${stats.accuracy.toFixed(1)}%` : "—"}
                  </p>
                  <p className="text-[9px] text-[color:var(--color-text-dim)] mt-1">
                    {stats.resolvedCount > 0
                      ? `${stats.wonCount}/${stats.resolvedCount} resueltos`
                      : "Sin mercados resueltos aun"}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div className="glass-card p-3 rounded-2xl flex-1 flex flex-col justify-center">
                  <p className="text-[10px] uppercase text-[color:var(--color-text-dim)] mb-1">
                    Mercados en los que participaste
                  </p>
                  <p className="text-lg font-bold">{stats.marketsJoined}</p>
                </div>
                <div className="glass-card p-3 rounded-2xl flex-1 flex flex-col justify-center">
                  <p className="text-[10px] uppercase text-[color:var(--color-text-dim)] mb-1">
                    Mercados creados
                  </p>
                  <p className="text-lg font-bold">{stats.marketsCreated}</p>
                </div>
              </div>
            </div>

            {/* Logros con umbrales reales */}
            <div className="mb-6">
              <h3 className="text-xs uppercase tracking-widest text-[color:var(--color-text-dim)] font-bold mb-3">
                Logros
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {achievements.map((a) => (
                  <div key={a.label} className="min-w-[76px] flex flex-col items-center gap-1.5">
                    <div
                      className="w-14 h-14 rounded-full glass-card flex items-center justify-center text-xl"
                      style={{
                        border: a.earned ? "2px solid var(--color-primary)" : "1px solid rgba(255,255,255,0.08)",
                        opacity: a.earned ? 1 : 0.35,
                      }}
                    >
                      {a.icon}
                    </div>
                    <span className="text-[10px] text-center leading-tight">{a.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Menu: solo acciones reales y funcionales */}
            <div className="space-y-2">
              <a
                href={explorerTxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full glass-card p-4 rounded-2xl flex items-center justify-between active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[color:var(--color-surface-high)] flex items-center justify-center text-lg">
                    🧾
                  </div>
                  <span className="text-sm">Ver historial en Explorer</span>
                </div>
                <span className="text-[color:var(--color-text-dim)]">›</span>
              </a>

              <Link
                href="/portfolio"
                className="w-full glass-card p-4 rounded-2xl flex items-center justify-between active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[color:var(--color-surface-high)] flex items-center justify-center text-lg">
                    💼
                  </div>
                  <span className="text-sm">Ver portafolio completo</span>
                </div>
                <span className="text-[color:var(--color-text-dim)]">›</span>
              </Link>

              <button
                onClick={() => wallet.disconnect()}
                className="w-full p-4 rounded-2xl flex items-center gap-3 mt-4 border border-transparent active:border-white/10 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-[rgba(153,69,255,0.12)] flex items-center justify-center text-lg">
                  🚪
                </div>
                <span className="text-sm" style={{ color: "var(--color-secondary-bright)" }}>
                  Desconectar wallet
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-2 glass-card rounded-t-2xl">
        <Link href="/markets" className="flex flex-col items-center justify-center text-[color:var(--color-text-dim)]">
          <span className="text-lg">🧭</span>
          <span className="text-[10px] font-mono">Explorar</span>
        </Link>
        <Link href="/portfolio" className="flex flex-col items-center justify-center text-[color:var(--color-text-dim)]">
          <span className="text-lg">💼</span>
          <span className="text-[10px] font-mono">Portafolio</span>
        </Link>
        <div
          className="flex flex-col items-center justify-center rounded-full px-4 py-1"
          style={{ background: "var(--color-primary-dim)", color: "var(--color-primary-bright)" }}
        >
          <span className="text-lg">👤</span>
          <span className="text-[10px] font-mono">Perfil</span>
        </div>
      </nav>
    </main>
  );
}
