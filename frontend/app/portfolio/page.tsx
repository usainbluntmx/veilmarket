"use client";

import { useEffect, useState, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useVeilWallet } from "@/lib/useVeilWallet";
import { useLanguage } from "@/lib/i18n";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { motion } from "framer-motion";
import { getProgram, fetchBetsForWallet } from "@/lib/veilmarket";
import { WalletButton } from "@/components/WalletButton";
import { LanguageToggle } from "@/components/LanguageToggle";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { StatCardSkeleton, ListRowSkeleton } from "@/components/Skeletons";

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
  const wallet = useVeilWallet();
  const { t } = useLanguage();
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
        wallet.wallet as unknown as AnchorProvider["wallet"],
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
          question: marketAcc?.question ?? "Unknown market",
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
      console.error("Error loading portfolio:", err);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet.publicKey?.toBase58()]);

  useEffect(() => {
    load();
  }, [load]);

  const totalStaked = positions.reduce((sum, p) => sum + p.amount, 0);
  const activeBets = positions.filter((p) => !p.resolved).length;
  const claimable = positions.filter((p) => p.won && !p.claimed).length;

  return (
    <main className="min-h-dvh pb-24">
      <header className="fixed top-0 w-full z-50 glass-card-solid flex justify-between items-center px-5 py-3 h-16">
        <div className="flex items-center gap-2">
          <Link href="/" className="font-bold text-base tracking-tight" style={{ color: "var(--color-primary)" }}>
            VeilMarket
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle
            style={{
              backgroundColor: "var(--color-surface-high)",
              color: "var(--color-text)",
              borderColor: "var(--color-border)",
              height: "34px",
            }}
          />
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
        </div>
      </header>

      <div className="pt-24 px-5">
        {!wallet.connected ? (
          <div className="glass-card rounded-2xl p-6 text-center">
            <p className="text-sm text-[color:var(--color-text-dim)]">
              {t("port_connect_prompt")}
            </p>
          </div>
        ) : loading ? (
          <div className="space-y-4">
            <StatCardSkeleton className="aspect-[3/1.4]" />
            <div className="grid grid-cols-3 gap-2">
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
            <ListRowSkeleton />
            <ListRowSkeleton />
          </div>
        ) : (
          <>
            {/* Balance real */}
            <section className="mb-4">
              <div className="glass-card rounded-2xl p-5 flex flex-col items-center border" style={{ borderColor: "rgba(20,241,149,0.2)" }}>
                <span className="text-[10px] uppercase tracking-widest text-[color:var(--color-text-dim)] font-bold mb-1">
                  {t("port_wallet_balance")}
                </span>
                <h1 className="text-3xl font-bold mb-1" style={{ color: "var(--color-primary-bright)" }}>
                  <AnimatedNumber value={balance ?? 0} decimals={3} suffix=" SOL" />
                </h1>
                {claimable > 0 && (
                  <span
                    className="mt-2 text-[11px] font-mono px-3 py-1 rounded-full"
                    style={{ background: "var(--color-primary-dim)", color: "var(--color-primary-bright)" }}
                  >
                    {claimable} {claimable > 1 ? t("port_payout_plural") : t("port_payout_singular")} {t("port_to_claim")}
                  </span>
                )}
              </div>
            </section>

            {/* Stats reales */}
            <section className="grid grid-cols-3 gap-2 mb-6">
              <div className="glass-card p-3 rounded-xl flex flex-col">
                <span className="text-[9px] text-[color:var(--color-text-dim)] uppercase">{t("port_created")}</span>
                <span className="text-lg font-bold">{created.length}</span>
              </div>
              <div className="glass-card p-3 rounded-xl flex flex-col">
                <span className="text-[9px] text-[color:var(--color-text-dim)] uppercase">{t("port_active")}</span>
                <span className="text-lg font-bold" style={{ color: "var(--color-secondary-bright)" }}>
                  {activeBets}
                </span>
              </div>
              <div className="glass-card p-3 rounded-xl flex flex-col">
                <span className="text-[9px] text-[color:var(--color-text-dim)] uppercase">{t("port_staked")}</span>
                <span className="text-lg font-bold">{totalStaked.toFixed(3)}</span>
              </div>
            </section>

            {/* Tus apuestas */}
            <section className="mb-6">
              <h2 className="text-sm font-bold mb-3">{t("port_your_bets")}</h2>
              {positions.length === 0 ? (
                <div className="glass-card rounded-2xl p-5 text-center">
                  <p className="text-xs text-[color:var(--color-text-dim)]">
                    {t("port_no_bets")}
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
                          {p.predictedOutcome ? t("yes") : t("no")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm truncate">{p.question}</h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-mono text-[color:var(--color-text-dim)]">
                              {p.amount.toFixed(3)} {t("port_staked_suffix")}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {!p.resolved ? (
                            <span className="text-[11px] font-mono" style={{ color: "var(--color-secondary-bright)" }}>
                              {t("port_live")}
                            </span>
                          ) : p.won ? (
                            <>
                              <div className="text-sm font-bold" style={{ color: "var(--color-primary-bright)" }}>
                                {p.claimed
                                  ? t("port_claimed")
                                  : p.estimatedPayout !== null
                                  ? `+${p.estimatedPayout.toFixed(3)}`
                                  : t("port_won")}
                              </div>
                              {!p.claimed && (
                                <span className="text-[10px] font-mono" style={{ color: "var(--color-primary-bright)" }}>
                                  {t("port_claim_arrow")}
                                </span>
                              )}
                            </>
                          ) : (
                            <div className="text-sm font-mono text-[color:var(--color-text-dim)]">{t("port_lost")}</div>
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
              <h2 className="text-sm font-bold mb-3">{t("port_your_markets")}</h2>
              {created.length === 0 ? (
                <div className="glass-card rounded-2xl p-5 text-center">
                  <p className="text-xs text-[color:var(--color-text-dim)] mb-3">
                    {t("port_no_markets")}
                  </p>
                  <Link
                    href="/"
                    className="inline-block text-xs font-mono px-4 py-2 rounded-full"
                    style={{ background: "var(--color-primary)", color: "#080808" }}
                  >
                    {t("feed_create_market")}
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
                            {m.resolved ? t("feed_resolved") : t("port_live")}
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

      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 safe-pb pt-2 glass-card-solid rounded-t-2xl">
        <Link href="/markets" className="flex flex-col items-center justify-center text-[color:var(--color-text-dim)]">
          <span className="text-lg">🧭</span>
          <span className="text-[10px] font-mono">{t("nav_explore")}</span>
        </Link>
        <div
          className="flex flex-col items-center justify-center rounded-full px-4 py-1"
          style={{ background: "var(--color-primary-dim)", color: "var(--color-primary-bright)" }}
        >
          <span className="text-lg">💼</span>
          <span className="text-[10px] font-mono">{t("nav_portfolio")}</span>
        </div>
        <Link href="/profile" className="flex flex-col items-center justify-center text-[color:var(--color-text-dim)]">
          <span className="text-lg">👤</span>
          <span className="text-[10px] font-mono">{t("nav_profile")}</span>
        </Link>
      </nav>
    </main>
  );
}
