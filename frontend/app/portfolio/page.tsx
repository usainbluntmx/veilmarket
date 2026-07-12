"use client";

import { useEffect, useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { motion } from "framer-motion";
import { getProgram, fetchBetsForWallet } from "@/lib/veilmarket";
import { WalletButton } from "@/components/WalletButton";
import { AnimatedNumber } from "@/components/AnimatedNumber";

type CreatedMarket = {
  pubkey: string;
  matchId: string;
  question: string;
  resolved: boolean;
  totalPool: number;
};

type Position = {
  marketPubkey: string;
  matchId: string;
  question: string;
  resolved: boolean;
  outcome: boolean;
  amount: number;
  predictedOutcome: boolean;
  settled: boolean;
  claimed: boolean;
  won: boolean;
  estimatedPayout: number | null;
};

export default function PortfolioPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [created, setCreated] = useState<CreatedMarket[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);

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
      setBalance(lamports / 1_000_000_000);

      // Mercados creados por esta wallet
      const allMarkets = await (program.account as any).market.all();
      const mine = allMarkets.filter((m: any) =>
        m.account.authority.equals(wallet.publicKey)
      );
      setCreated(
        mine.map((m: any) => ({
          pubkey: m.publicKey.toBase58(),
          matchId: m.account.matchId,
          question: m.account.question,
          resolved: m.account.resolved,
          totalPool: m.account.totalPool.toNumber() / 1_000_000_000,
        }))
      );

      // Apuestas de esta wallet, en cualquier mercado
      const myBets = await fetchBetsForWallet(program, wallet.publicKey);
      const marketCache = new Map<string, any>();
      for (const m of allMarkets) marketCache.set(m.publicKey.toBase58(), m.account);

      const pos: Position[] = myBets.map((b: any) => {
        const marketPubkey = b.account.market.toBase58();
        const marketAcc = marketCache.get(marketPubkey);
        const amount = b.account.amount.toNumber() / 1_000_000_000;
        const won =
          !!marketAcc?.resolved &&
          b.account.predictedOutcome === marketAcc?.outcome;

        let estimatedPayout: number | null = null;
        if (marketAcc?.resolved && won) {
          const winningPool = marketAcc.winningPool.toNumber();
          const totalPool = marketAcc.totalPool.toNumber();
          if (winningPool > 0) {
            estimatedPayout =
              (b.account.amount.toNumber() * totalPool) / winningPool / 1_000_000_000;
          }
        }

        return {
          marketPubkey,
          matchId: marketAcc?.matchId ?? "?",
          question: marketAcc?.question ?? "Mercado desconocido",
          resolved: !!marketAcc?.resolved,
          outcome: !!marketAcc?.outcome,
          amount,
          predictedOutcome: b.account.predictedOutcome,
          settled: b.account.settled,
          claimed: b.account.claimed,
          won,
          estimatedPayout,
        };
      });

      pos.sort((a, b) => Number(a.claimed) - Number(b.claimed));
      setPositions(pos);
    } catch (err) {
      console.error("Error cargando portafolio:", err);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  useEffect(() => {
    load();
  }, [load]);

  const totalStaked = positions.reduce((sum, p) => sum + p.amount, 0);
  const activeBets = positions.filter((p) => !p.resolved).length;
  const claimable = positions.filter((p) => p.won && !p.claimed).length;

  return (
    <main className="min-h-dvh pb-24">
      <header className="fixed top-0 w-full z-50 glass-card flex justify-between items-center px-5 py-3 h-16">
        <div className="flex items-center gap-2">
          <Link href="/" className="font-bold text-base tracking-tight" style={{ color: "var(--color-primary)" }}>
            VeilMarket
          </Link>
        </div>
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
              Conecta tu wallet para ver tu portafolio.
            </p>
          </div>
        ) : loading ? (
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="text-sm font-mono text-[color:var(--color-text-dim)]"
          >
            Cargando portafolio...
          </motion.p>
        ) : (
          <>
            {/* Balance real */}
            <section className="mb-4">
              <div className="glass-card rounded-2xl p-5 flex flex-col items-center border" style={{ borderColor: "rgba(20,241,149,0.2)" }}>
                <span className="text-[10px] uppercase tracking-widest text-[color:var(--color-text-dim)] font-bold mb-1">
                  Balance de tu wallet
                </span>
                <h1 className="text-3xl font-bold mb-1" style={{ color: "var(--color-primary-bright)" }}>
                  <AnimatedNumber value={balance ?? 0} decimals={3} suffix=" SOL" />
                </h1>
                {claimable > 0 && (
                  <span
                    className="mt-2 text-[11px] font-mono px-3 py-1 rounded-full"
                    style={{ background: "var(--color-primary-dim)", color: "var(--color-primary-bright)" }}
                  >
                    {claimable} payout{claimable > 1 ? "s" : ""} por reclamar →
                  </span>
                )}
              </div>
            </section>

            {/* Stats reales */}
            <section className="grid grid-cols-3 gap-2 mb-6">
              <div className="glass-card p-3 rounded-xl flex flex-col">
                <span className="text-[9px] text-[color:var(--color-text-dim)] uppercase">Creados</span>
                <span className="text-lg font-bold">{created.length}</span>
              </div>
              <div className="glass-card p-3 rounded-xl flex flex-col">
                <span className="text-[9px] text-[color:var(--color-text-dim)] uppercase">Activas</span>
                <span className="text-lg font-bold" style={{ color: "var(--color-secondary-bright)" }}>
                  {activeBets}
                </span>
              </div>
              <div className="glass-card p-3 rounded-xl flex flex-col">
                <span className="text-[9px] text-[color:var(--color-text-dim)] uppercase">Apostado</span>
                <span className="text-lg font-bold">{totalStaked.toFixed(3)}</span>
              </div>
            </section>

            {/* Tus apuestas */}
            <section className="mb-6">
              <h2 className="text-sm font-bold mb-3">Tus apuestas</h2>
              {positions.length === 0 ? (
                <div className="glass-card rounded-2xl p-5 text-center">
                  <p className="text-xs text-[color:var(--color-text-dim)]">
                    Aun no has apostado en ningun mercado.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {positions.map((p) => (
                    <Link key={p.marketPubkey + p.predictedOutcome} href={`/markets/${p.marketPubkey}`}>
                      <motion.div
                        whileTap={{ scale: 0.98 }}
                        className="glass-card rounded-2xl p-4 flex items-center gap-3"
                      >
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border"
                          style={{
                            borderColor: p.resolved
                              ? p.won
                                ? "var(--color-primary)"
                                : "var(--color-secondary)"
                              : "rgba(255,255,255,0.1)",
                            color: p.resolved
                              ? p.won
                                ? "var(--color-primary-bright)"
                                : "var(--color-secondary-bright)"
                              : "var(--color-text-dim)",
                          }}
                        >
                          {p.predictedOutcome ? "SI" : "NO"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm truncate">{p.question}</h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-mono text-[color:var(--color-text-dim)]">
                              {p.amount.toFixed(3)} SOL apostado
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {!p.resolved ? (
                            <span className="text-[11px] font-mono" style={{ color: "var(--color-secondary-bright)" }}>
                              En vivo
                            </span>
                          ) : p.won ? (
                            <>
                              <div className="text-sm font-bold" style={{ color: "var(--color-primary-bright)" }}>
                                {p.claimed
                                  ? "Reclamado"
                                  : p.estimatedPayout !== null
                                  ? `+${p.estimatedPayout.toFixed(3)}`
                                  : "Ganaste"}
                              </div>
                              {!p.claimed && (
                                <span className="text-[10px] font-mono" style={{ color: "var(--color-primary-bright)" }}>
                                  Reclamar →
                                </span>
                              )}
                            </>
                          ) : (
                            <div className="text-sm font-mono text-[color:var(--color-text-dim)]">Perdiste</div>
                          )}
                        </div>
                      </motion.div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Mercados que creaste */}
            <section>
              <h2 className="text-sm font-bold mb-3">Mercados que creaste</h2>
              {created.length === 0 ? (
                <div className="glass-card rounded-2xl p-5 text-center">
                  <p className="text-xs text-[color:var(--color-text-dim)] mb-3">
                    Aun no has creado ningun mercado.
                  </p>
                  <Link
                    href="/"
                    className="inline-block text-xs font-mono px-4 py-2 rounded-full"
                    style={{ background: "var(--color-primary)", color: "#080808" }}
                  >
                    Crear mercado
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {created.map((m) => (
                    <Link key={m.pubkey} href={`/markets/${m.pubkey}`}>
                      <motion.div whileTap={{ scale: 0.98 }} className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm truncate">{m.question}</h3>
                          <span className="text-[10px] font-mono text-[color:var(--color-text-dim)]">
                            {m.matchId}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold" style={{ color: "var(--color-primary-bright)" }}>
                            {m.totalPool.toFixed(3)} SOL
                          </div>
                          <span className="text-[10px] font-mono text-[color:var(--color-text-dim)]">
                            {m.resolved ? "Resuelto" : "En vivo"}
                          </span>
                        </div>
                      </motion.div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-2 glass-card rounded-t-2xl">
        <Link href="/markets" className="flex flex-col items-center justify-center text-[color:var(--color-text-dim)]">
          <span className="text-lg">🧭</span>
          <span className="text-[10px] font-mono">Explorar</span>
        </Link>
        <div
          className="flex flex-col items-center justify-center rounded-full px-4 py-1"
          style={{ background: "var(--color-primary-dim)", color: "var(--color-primary-bright)" }}
        >
          <span className="text-lg">💼</span>
          <span className="text-[10px] font-mono">Portafolio</span>
        </div>
        <Link href="/profile" className="flex flex-col items-center justify-center text-[color:var(--color-text-dim)]">
          <span className="text-lg">👤</span>
          <span className="text-[10px] font-mono">Perfil</span>
        </Link>
      </nav>
    </main>
  );
}
