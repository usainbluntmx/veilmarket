"use client";

import { useEffect, useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, BN, web3 } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import Link from "next/link";
import { getProgram, betPda, fetchMarketOdds } from "@/lib/veilmarket";
import { WalletButton } from "@/components/WalletButton";

type MarketRow = {
  pubkey: string;
  matchId: string;
  question: string;
  resolved: boolean;
  outcome: boolean;
  totalPool: number;
};

const LEGACY_TEST_IDS = new Set([
  "MEX-USA-2026",
  "MEX-USA-2026-ER",
  "MEX-USA-2026-R1",
]);

function isTestMarket(matchId: string): boolean {
  if (LEGACY_TEST_IDS.has(matchId)) return true;
  if (/\d{10,}/.test(matchId)) return true;
  return false;
}

const QUICK_VOTE_AMOUNT_SOL = 0.01;

// Gradiente decorativo determinista por mercado (no es data real, solo
// variedad visual entre cards ya que no tenemos imagenes por partido).
function gradientFor(matchId: string): string {
  let hash = 0;
  for (let i = 0; i < matchId.length; i++) hash = matchId.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(160deg, hsla(${hue},70%,25%,0.55), hsla(${(hue + 70) % 360},70%,15%,0.85))`;
}

function OddsBar({ yes, no }: { yes: number; no: number }) {
  const total = yes + no;
  const yesPct = total > 0 ? Math.round((yes / total) * 100) : 50;
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5 font-mono text-xs">
        <span className="text-[color:var(--color-text-dim)]">Odds actuales</span>
        <span style={{ color: "var(--color-primary-bright)" }}>
          {total > 0 ? `${yesPct}% SI` : "Sin apuestas aun"}
        </span>
      </div>
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden flex">
        <motion.div
          className="h-full"
          style={{ background: "linear-gradient(90deg, var(--color-primary), var(--color-primary-bright))" }}
          initial={{ width: 0 }}
          animate={{ width: `${yesPct}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
        <div
          className="h-full flex-1"
          style={{ background: "var(--color-secondary)" }}
        />
      </div>
    </div>
  );
}

export default function MarketsFeedPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [odds, setOdds] = useState<{ yesLamports: number; noLamports: number } | null>(null);
  const [voting, setVoting] = useState(false);
  const [voteFlash, setVoteFlash] = useState<"si" | "no" | null>(null);

  const y = useMotionValue(0);
  const dragOpacity = useTransform(y, [-200, 0, 200], [0.3, 1, 0.3]);

  const loadMarkets = useCallback(async () => {
    try {
      const provider = new AnchorProvider(
        connection,
        (wallet as unknown as AnchorProvider["wallet"]) ?? ({} as never),
        { commitment: "confirmed" }
      );
      const program = getProgram(provider);
      const accounts = await (program.account as any).market.all();
      const rows: MarketRow[] = accounts
        .filter((a: any) => !isTestMarket(a.account.matchId))
        .map((a: any) => ({
          pubkey: a.publicKey.toBase58(),
          matchId: a.account.matchId,
          question: a.account.question,
          resolved: a.account.resolved,
          outcome: a.account.outcome,
          totalPool: a.account.totalPool.toNumber() / 1_000_000_000,
        }));
      rows.sort((a, b) => b.totalPool - a.totalPool);
      setMarkets(rows);
    } catch (err) {
      console.error("Error cargando mercados:", err);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  const current = markets[index] ?? null;

  useEffect(() => {
    if (!current) {
      setOdds(null);
      return;
    }
    const provider = new AnchorProvider(
      connection,
      (wallet as unknown as AnchorProvider["wallet"]) ?? ({} as never),
      { commitment: "confirmed" }
    );
    const program = getProgram(provider);
    fetchMarketOdds(program, new PublicKey(current.pubkey))
      .then((o) => setOdds({ yesLamports: o.yesLamports, noLamports: o.noLamports }))
      .catch(() => setOdds(null));
  }, [current, connection, wallet]);

  function goNext() {
    setIndex((i) => Math.min(i + 1, markets.length - 1));
  }
  function goPrev() {
    setIndex((i) => Math.max(i - 1, 0));
  }

  async function castVote(predictedOutcome: boolean) {
    if (!wallet.publicKey || !current || voting) return;
    setVoting(true);
    try {
      const provider = new AnchorProvider(
        connection,
        wallet as unknown as AnchorProvider["wallet"],
        { commitment: "confirmed" }
      );
      const program = getProgram(provider);
      const marketPubkey = new PublicKey(current.pubkey);
      const pda = betPda(marketPubkey, wallet.publicKey);
      const lamports = Math.round(QUICK_VOTE_AMOUNT_SOL * 1_000_000_000);

      await program.methods
        .createBet(new BN(lamports), predictedOutcome)
        .accounts({
          market: marketPubkey,
          bet: pda,
          better: wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(predictedOutcome ? [20, 30, 20] : [40]);
      }
      setVoteFlash(predictedOutcome ? "si" : "no");
      setTimeout(() => {
        setVoteFlash(null);
        goNext();
        loadMarkets();
      }, 500);
    } catch (err) {
      console.error("Error votando:", err);
    } finally {
      setVoting(false);
    }
  }

  return (
    <main className="h-dvh w-full overflow-hidden flex flex-col relative">
      {/* Barra superior */}
      <header className="fixed top-0 w-full z-50 glass-card px-5 py-3 flex justify-between items-center h-16">
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

      {/* Canvas central */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 pt-16 pb-32 relative">
        {loading && (
          <p className="font-mono text-sm text-[color:var(--color-text-dim)]">
            Cargando mercados...
          </p>
        )}

        {!loading && markets.length === 0 && (
          <div className="glass-card rounded-3xl p-6 text-center max-w-sm">
            <p className="text-sm text-[color:var(--color-text-dim)] mb-4">
              Aun no hay mercados. Crea el primero.
            </p>
            <Link
              href="/"
              className="inline-block text-xs font-mono px-4 py-2 rounded-full"
              style={{ background: "var(--color-primary)", color: "#080808" }}
            >
              Crear mercado
            </Link>
          </div>
        )}

        {!loading && current && (
          <div className="w-full max-w-md relative" style={{ aspectRatio: "3/4" }}>
            {/* Stacks de profundidad */}
            <div className="absolute -bottom-4 left-4 right-4 h-full glass-card rounded-[32px] -z-10 opacity-40 scale-[0.95]" />
            <div className="absolute -bottom-8 left-8 right-8 h-full glass-card rounded-[32px] -z-20 opacity-20 scale-[0.9]" />

            <AnimatePresence mode="wait">
              <motion.div
                key={current.pubkey}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.7}
                style={{ y, opacity: dragOpacity }}
                onDragEnd={(_, info) => {
                  if (info.offset.y < -120) {
                    y.set(0);
                    goNext();
                  } else if (info.offset.y > 120) {
                    y.set(0);
                    goPrev();
                  } else {
                    y.set(0);
                  }
                }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="glass-card w-full h-full rounded-[32px] overflow-hidden flex flex-col relative cursor-grab active:cursor-grabbing"
              >
                <div
                  className="absolute inset-0"
                  style={{ background: gradientFor(current.matchId) }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

                {/* Flash de voto */}
                <AnimatePresence>
                  {voteFlash && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center z-20"
                      style={{
                        background:
                          voteFlash === "si"
                            ? "rgba(20,241,149,0.25)"
                            : "rgba(153,69,255,0.25)",
                      }}
                    >
                      <span className="text-5xl font-bold text-white">
                        {voteFlash === "si" ? "SI ✓" : "NO ✕"}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mt-auto p-5 relative z-10 space-y-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest border flex items-center gap-1.5"
                      style={{
                        background: current.resolved
                          ? "rgba(20,241,149,0.15)"
                          : "rgba(153,69,255,0.2)",
                        borderColor: current.resolved
                          ? "var(--color-primary)"
                          : "var(--color-secondary)",
                        color: current.resolved
                          ? "var(--color-primary-bright)"
                          : "var(--color-secondary-bright)",
                      }}
                    >
                      {!current.resolved && (
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                      )}
                      {current.resolved ? "RESUELTO" : "EN VIVO"}
                    </span>
                    <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
                      {current.matchId}
                    </span>
                  </div>

                  <h2 className="text-2xl font-bold text-white leading-tight">
                    {current.question}
                  </h2>

                  <div className="flex justify-between items-end pt-1">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
                        Volumen
                      </span>
                      <span className="text-white font-mono text-sm">
                        {current.totalPool.toFixed(3)} SOL
                      </span>
                    </div>
                  </div>

                  {odds && <OddsBar yes={odds.yesLamports} no={odds.noLamports} />}

                  <Link
                    href={`/markets/${current.pubkey}`}
                    className="inline-block text-[10px] font-mono text-white/60 hover:text-white pt-1"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    Ver detalle, apostar mas o gestionar →
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {!loading && markets.length > 0 && (
          <p className="mt-5 text-[11px] font-mono text-[color:var(--color-text-faint)] text-center">
            Desliza arriba/abajo para explorar · {index + 1} / {markets.length}
          </p>
        )}
      </div>

      {/* Botones de accion */}
      {!loading && current && wallet.connected && !current.resolved && (
        <div className="fixed bottom-24 left-0 w-full flex justify-center gap-8 z-40">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => castVote(false)}
            disabled={voting}
            className="flex flex-col items-center gap-1.5"
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl border"
              style={{
                background: "var(--color-surface-high)",
                borderColor: "var(--color-border)",
                color: "var(--color-secondary-bright)",
              }}
            >
              ✕
            </div>
            <span className="text-[10px] font-mono text-[color:var(--color-text-dim)]">NO</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => castVote(true)}
            disabled={voting}
            className="flex flex-col items-center gap-1.5"
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl border"
              style={{
                background: "var(--color-surface-high)",
                borderColor: "var(--color-border)",
                color: "var(--color-primary-bright)",
              }}
            >
              ✓
            </div>
            <span className="text-[10px] font-mono text-[color:var(--color-text-dim)]">SI</span>
          </motion.button>
        </div>
      )}

      {!wallet.connected && current && (
        <p className="fixed bottom-24 left-0 w-full text-center text-xs font-mono text-[color:var(--color-text-dim)] z-40">
          Conecta tu wallet para votar
        </p>
      )}

      {/* Barra inferior */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-2 glass-card rounded-t-2xl">
        <div
          className="flex flex-col items-center justify-center rounded-full px-4 py-1"
          style={{ background: "var(--color-primary-dim)", color: "var(--color-primary-bright)" }}
        >
          <span className="text-lg">🧭</span>
          <span className="text-[10px] font-mono">Explorar</span>
        </div>
        <Link
          href="/portfolio"
          className="flex flex-col items-center justify-center text-[color:var(--color-text-dim)]"
        >
          <span className="text-lg">💼</span>
          <span className="text-[10px] font-mono">Portafolio</span>
        </Link>
        <Link
          href="/"
          className="flex flex-col items-center justify-center text-[color:var(--color-text-dim)]"
        >
          <span className="text-lg">➕</span>
          <span className="text-[10px] font-mono">Crear</span>
        </Link>
        <Link
          href="/profile"
          className="flex flex-col items-center justify-center text-[color:var(--color-text-dim)]"
        >
          <span className="text-lg">👤</span>
          <span className="text-[10px] font-mono">Perfil</span>
        </Link>
      </nav>
    </main>
  );
}
