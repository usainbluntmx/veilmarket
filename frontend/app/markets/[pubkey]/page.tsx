"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useConnection } from "@solana/wallet-adapter-react";
import { useVeilWallet } from "@/lib/useVeilWallet";
import { useLanguage } from "@/lib/i18n";
import { AnchorProvider, BN, web3 } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import {
  getProgram,
  betPda,
  getConnection,
  fetchMarketOdds,
  DELEGATION_PROGRAM_ID,
  VRF_DEFAULT_QUEUE,
  permissionPdaFromAccount,
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
} from "@/lib/veilmarket";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { SwipeToConfirm } from "@/components/SwipeToConfirm";
import { LanguageToggle } from "@/components/LanguageToggle";

type MarketData = {
  authority: PublicKey;
  matchId: string;
  question: string;
  resolved: boolean;
  outcome: boolean;
  totalPool: number;
  winningPool: number;
};

type BetData = {
  amount: number;
  predictedOutcome: boolean;
  settled: boolean;
  claimed: boolean;
} | null;

function gradientFor(matchId: string): string {
  let hash = 0;
  for (let i = 0; i < matchId.length; i++) hash = matchId.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(160deg, hsla(${hue},70%,25%,0.65), hsla(${(hue + 70) % 360},70%,12%,0.9))`;
}

export default function MarketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const marketPubkey = new PublicKey(params.pubkey as string);
  const { connection } = useConnection();
  const wallet = useVeilWallet();
  const { t } = useLanguage();
  const erConnection = getConnection("er");

  const [market, setMarket] = useState<MarketData | null>(null);
  const [bet, setBet] = useState<BetData>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState("0.01");
  const [betOutcome, setBetOutcome] = useState<boolean>(true);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [odds, setOdds] = useState<{ yesLamports: number; noLamports: number } | null>(null);

  const [marketDelegated, setMarketDelegated] = useState(false);
  const [betDelegated, setBetDelegated] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [erLatencyMs, setErLatencyMs] = useState<number | null>(null);

  const getBaseProgram = useCallback(() => {
    const provider = new AnchorProvider(
      connection,
      wallet.wallet as unknown as AnchorProvider["wallet"],
      { commitment: "confirmed" }
    );
    return getProgram(provider);
  }, [connection, wallet.publicKey?.toBase58()]);

  const getErProgram = useCallback(() => {
    const provider = new AnchorProvider(
      erConnection,
      wallet.wallet as unknown as AnchorProvider["wallet"],
      { commitment: "confirmed" }
    );
    return getProgram(provider);
  }, [erConnection, wallet.publicKey?.toBase58()]);

  const load = useCallback(async () => {
    try {
      const provider = new AnchorProvider(
        connection,
        (wallet.wallet as unknown as AnchorProvider["wallet"]) ?? ({} as never),
        { commitment: "confirmed" }
      );
      const program = getProgram(provider);
      const m = await (program.account as any).market.fetch(marketPubkey);
      setMarket({
        authority: m.authority,
        matchId: m.matchId,
        question: m.question,
        resolved: m.resolved,
        outcome: m.outcome,
        totalPool: m.totalPool.toNumber() / 1_000_000_000,
        winningPool: m.winningPool.toNumber() / 1_000_000_000,
      });

      fetchMarketOdds(program, marketPubkey)
        .then((o) => setOdds({ yesLamports: o.yesLamports, noLamports: o.noLamports }))
        .catch(() => setOdds(null));

      const marketInfo = await connection.getAccountInfo(marketPubkey);
      setMarketDelegated(
        !!marketInfo && marketInfo.owner.equals(DELEGATION_PROGRAM_ID)
      );

      if (wallet.publicKey) {
        const pda = betPda(marketPubkey, wallet.publicKey);
        try {
          const b = await (program.account as any).bet.fetch(pda);
          setBet({
            amount: b.amount.toNumber() / 1_000_000_000,
            predictedOutcome: b.predictedOutcome,
            settled: b.settled,
            claimed: b.claimed,
          });
          const betInfo = await connection.getAccountInfo(pda);
          setBetDelegated(
            !!betInfo && betInfo.owner.equals(DELEGATION_PROGRAM_ID)
          );
        } catch {
          setBet(null);
          setBetDelegated(false);
        }
        connection
          .getBalance(wallet.publicKey)
          .then((l) => setWalletBalance(l / 1_000_000_000))
          .catch(() => setWalletBalance(null));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet.publicKey?.toBase58(), marketPubkey]);

  useEffect(() => {
    load();
  }, [load]);

  function friendlyError(err: any): string {
    const msg = err?.message ?? String(err);
    if (msg.includes("0x1")) return "Fondos insuficientes en tu wallet.";
    if (msg.toLowerCase().includes("already in use"))
      return "Esa cuenta ya existe.";
    return msg.length > 140 ? msg.slice(0, 140) + "..." : msg;
  }

  async function handlePlaceBet() {
    if (!wallet.publicKey) return;
    setBusy(true);
    setBusyLabel("Enviando apuesta...");
    setError(null);
    try {
      const program = getBaseProgram();
      const pda = betPda(marketPubkey, wallet.publicKey);
      const lamports = Math.round(parseFloat(betAmount) * 1_000_000_000);

      await program.methods
        .createBet(new BN(lamports), betOutcome)
        .accounts({
          market: marketPubkey,
          bet: pda,
          better: wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      await load();
    } catch (err: any) {
      console.error(err);
      setError(friendlyError(err));
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  async function handleResolve(outcome: boolean) {
    if (!wallet.publicKey) return;
    setBusy(true);
    setBusyLabel("Resolviendo...");
    setError(null);
    try {
      const program = getBaseProgram();
      await program.methods
        .resolveMarket(outcome)
        .accounts({
          market: marketPubkey,
          authority: wallet.publicKey,
        })
        .rpc();
      await load();
    } catch (err: any) {
      console.error(err);
      setError(friendlyError(err));
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  async function handleResolveVrf() {
    if (!wallet.publicKey) return;
    setBusy(true);
    setBusyLabel("Solicitando azar verificable (VRF)...");
    setError(null);
    try {
      const program = getBaseProgram();
      const clientSeed = Math.floor(Math.random() * 256);

      await program.methods
        .requestRandomResolution(clientSeed)
        .accounts({
          payer: wallet.publicKey,
          market: marketPubkey,
          oracleQueue: VRF_DEFAULT_QUEUE,
        })
        .rpc();

      setBusyLabel("Esperando al oraculo VRF...");
      const start = Date.now();
      while (Date.now() - start < 30000) {
        await new Promise((r) => setTimeout(r, 1500));
        const m = await (program.account as any).market.fetch(marketPubkey);
        if (m.resolved) break;
      }
      await load();
    } catch (err: any) {
      console.error(err);
      setError(friendlyError(err));
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  async function handleGoLive() {
    if (!wallet.publicKey || !market) return;
    setBusy(true);
    setBusyLabel("Activando tiempo real (ER)...");
    setError(null);
    try {
      const program = getBaseProgram();

      if (!marketDelegated) {
        await program.methods
          .delegateMarket(market.matchId)
          .accounts({ payer: wallet.publicKey, pda: marketPubkey })
          .rpc();
      }

      if (bet && !betDelegated) {
        const pda = betPda(marketPubkey, wallet.publicKey);
        await program.methods
          .delegateBet(marketPubkey, wallet.publicKey)
          .accounts({ payer: wallet.publicKey, pda })
          .rpc();
      }

      await load();
    } catch (err: any) {
      console.error(err);
      setError(friendlyError(err));
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  async function handleUpdatePredictionEr(newOutcome: boolean) {
    if (!wallet.publicKey || !bet) return;
    setBusy(true);
    setBusyLabel("Actualizando prediccion en el ER...");
    setError(null);
    try {
      const erProgram = getErProgram();
      const pda = betPda(marketPubkey, wallet.publicKey);
      const start = Date.now();

      await erProgram.methods
        .updatePrediction(newOutcome)
        .accounts({
          market: marketPubkey,
          bet: pda,
          better: wallet.publicKey,
        })
        .rpc();

      setErLatencyMs(Date.now() - start);
      setBet((prev) => (prev ? { ...prev, predictedOutcome: newOutcome } : prev));
    } catch (err: any) {
      console.error(err);
      setError(friendlyError(err));
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  async function handleGoPrivate() {
    if (!wallet.publicKey || !bet) return;
    setBusy(true);
    setBusyLabel("Activando privacidad (Private ER)...");
    setError(null);
    try {
      const erProgram = getErProgram();
      const pda = betPda(marketPubkey, wallet.publicKey);
      const permission = permissionPdaFromAccount(pda);
      const sharedAccounts = {
        bet: pda,
        permission,
        ephemeralVault: EPHEMERAL_VAULT_ID,
        magicProgram: MAGIC_PROGRAM_ID,
        permissionProgram: PERMISSION_PROGRAM_ID,
      };

      await erProgram.methods.initBetPermission().accounts(sharedAccounts).rpc();
      await erProgram.methods.setBetPrivacy(true).accounts(sharedAccounts).rpc();

      setIsPrivate(true);
    } catch (err: any) {
      console.error(err);
      setError(friendlyError(err));
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  async function handleSyncToSolana() {
    if (!wallet.publicKey) return;
    setBusy(true);
    setBusyLabel("Sincronizando a Solana...");
    setError(null);
    try {
      const erProgram = getErProgram();

      if (marketDelegated) {
        await erProgram.methods
          .undelegateMarket()
          .accounts({ payer: wallet.publicKey, market: marketPubkey })
          .rpc();
      }
      if (betDelegated && wallet.publicKey) {
        const pda = betPda(marketPubkey, wallet.publicKey);
        await erProgram.methods
          .undelegateBet()
          .accounts({ payer: wallet.publicKey, bet: pda })
          .rpc();
      }

      await new Promise((r) => setTimeout(r, 2500));
      await load();
    } catch (err: any) {
      console.error(err);
      setError(friendlyError(err));
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  async function handleSettleAndClaim() {
    if (!wallet.publicKey) return;
    setBusy(true);
    setBusyLabel("Procesando payout...");
    setError(null);
    try {
      const pda = betPda(marketPubkey, wallet.publicKey);

      if (betDelegated || marketDelegated) {
        setBusyLabel("Sincronizando desde el ER antes de reclamar...");
        const erProgram = getErProgram();
        if (marketDelegated) {
          await erProgram.methods
            .undelegateMarket()
            .accounts({ payer: wallet.publicKey, market: marketPubkey })
            .rpc();
        }
        if (betDelegated) {
          await erProgram.methods
            .undelegateBet()
            .accounts({ payer: wallet.publicKey, bet: pda })
            .rpc();
        }
        await new Promise((r) => setTimeout(r, 2500));
        setMarketDelegated(false);
        setBetDelegated(false);
      }

      const program = getBaseProgram();
      setBusyLabel("Reclamando payout...");

      if (bet && !bet.settled) {
        await program.methods
          .settleBet()
          .accounts({ market: marketPubkey, bet: pda })
          .rpc();
      }

      await program.methods
        .claimPayout()
        .accounts({ market: marketPubkey, bet: pda, better: wallet.publicKey })
        .rpc();

      confetti({
        particleCount: 120,
        spread: 75,
        origin: { y: 0.6 },
        colors: ["#14F195", "#9945FF", "#e5e2e1"],
      });

      await load();
    } catch (err: any) {
      console.error(err);
      setError(friendlyError(err));
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  if (loading) {
    return (
      <main className="min-h-dvh px-5 pt-20 mx-auto max-w-md">
        <motion.p
          className="font-mono text-sm text-[color:var(--color-text-dim)]"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        >
          Cargando mercado...
        </motion.p>
      </main>
    );
  }

  if (!market) {
    return (
      <main className="min-h-dvh px-5 pt-20 mx-auto max-w-md">
        <p className="font-mono text-sm" style={{ color: "var(--color-secondary-bright)" }}>
          Mercado no encontrado.
        </p>
      </main>
    );
  }

  const isAuthority = wallet.publicKey && wallet.publicKey.equals(market.authority);
  const canClaim =
    market.resolved && bet && !bet.claimed && bet.predictedOutcome === market.outcome;
  const isLive = marketDelegated || betDelegated;
  const showBetSheet = wallet.connected && !bet && !market.resolved;
  const totalOdds = odds ? odds.yesLamports + odds.noLamports : 0;
  const yesPct = totalOdds > 0 && odds ? Math.round((odds.yesLamports / totalOdds) * 100) : 50;
  const explorerUrl = `https://explorer.solana.com/address/${marketPubkey.toBase58()}?cluster=devnet`;

  return (
    <main className={`min-h-dvh ${showBetSheet ? "pb-64" : "pb-16"}`}>
      {/* Nav superior */}
      <nav className="fixed top-0 w-full z-50 glass-card-solid flex justify-between items-center px-5 py-3 h-16">
        <button
          onClick={() => router.push("/markets")}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 active:scale-95 transition-transform"
          style={{ color: "var(--color-secondary-bright)" }}
        >
          ←
        </button>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--color-text-dim)]">
          {market.matchId}
        </span>
        <div className="flex items-center gap-1.5">
          <LanguageToggle
            style={{
              backgroundColor: "var(--color-surface-high)",
              color: "var(--color-text)",
              borderColor: "var(--color-border)",
              height: "30px",
            }}
          />
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border"
            style={{ background: "var(--color-primary-dim)", borderColor: "var(--color-primary)" }}
          >
            <span className="font-mono text-xs" style={{ color: "var(--color-primary-bright)" }}>
              {walletBalance !== null ? `${walletBalance.toFixed(2)} SOL` : "—"}
            </span>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative w-full h-[280px] overflow-hidden pt-16 -mt-16">
        <div className="absolute inset-0" style={{ background: gradientFor(market.matchId) }} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-transparent" />
        <div className="absolute bottom-5 left-5 right-5 z-10">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full border backdrop-blur-md"
              style={{
                background: market.resolved ? "var(--color-primary-dim)" : "var(--color-secondary-dim)",
                borderColor: market.resolved ? "var(--color-primary)" : "var(--color-secondary)",
              }}
            >
              {!market.resolved && (
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: "var(--color-secondary-bright)" }}
                />
              )}
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: market.resolved ? "var(--color-primary-bright)" : "var(--color-secondary-bright)" }}
              >
                {market.resolved ? `Resuelto: ${market.outcome ? "SI" : "NO"}` : "Mercado en vivo"}
              </span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white leading-tight">{market.question}</h1>
        </div>
      </div>

      <div className="px-5">
        {/* Bento de stats reales */}
        <section className="grid grid-cols-2 gap-2 mt-4">
          <div className="glass-card p-4 rounded-2xl flex flex-col justify-center">
            <span className="text-[10px] uppercase tracking-widest text-[color:var(--color-text-dim)] font-bold mb-1">
              Volumen
            </span>
            <span className="font-bold text-lg" style={{ color: "var(--color-secondary-bright)" }}>
              <AnimatedNumber value={market.totalPool} decimals={3} suffix=" SOL" />
            </span>
          </div>
          <div className="glass-card p-4 rounded-2xl flex flex-col justify-center">
            <span className="text-[10px] uppercase tracking-widest text-[color:var(--color-text-dim)] font-bold mb-1">
              Odds actuales
            </span>
            <span className="font-bold text-lg" style={{ color: "var(--color-primary-bright)" }}>
              {totalOdds > 0 ? `${yesPct}% / ${100 - yesPct}%` : "Sin apuestas"}
            </span>
          </div>
        </section>

        {odds && totalOdds > 0 && (
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden flex mt-2">
            <motion.div
              className="h-full"
              style={{ background: "linear-gradient(90deg, var(--color-primary), var(--color-primary-bright))" }}
              initial={{ width: 0 }}
              animate={{ width: `${yesPct}%` }}
              transition={{ duration: 0.6 }}
            />
            <div className="h-full flex-1" style={{ background: "var(--color-secondary)" }} />
          </div>
        )}

        {/* Verificacion on-chain: real, sin datos inventados */}
        <section className="mt-5">
          <h2 className="text-sm font-bold text-white mb-2">Verificacion on-chain</h2>
          <div className="glass-card p-4 rounded-2xl">
            <p className="text-[color:var(--color-text-dim)] text-xs leading-relaxed mb-3">
              Este mercado se resuelve manualmente por su creador, o mediante
              un sorteo verificable (VRF) si el creador lo solicita en vez de
              decidir a mano. Todo el estado — pool, apuestas, resolucion —
              vive on-chain y es publicamente auditable.
            </p>
            <div className="pt-3 border-t border-white/5 flex items-center justify-between">
              <span className="text-[11px] text-[color:var(--color-text-dim)] font-mono">
                Creador: {market.authority.toBase58().slice(0, 4)}...{market.authority.toBase58().slice(-4)}
              </span>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold font-mono"
                style={{ color: "var(--color-primary-bright)" }}
              >
                Ver en Explorer →
              </a>
            </div>
          </div>
        </section>

        {/* Badges ER / privacidad */}
        <AnimatePresence>
          {(isLive || isPrivate || erLatencyMs !== null) && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex gap-2 mt-4 flex-wrap"
            >
              {isLive && (
                <span
                  className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5"
                  style={{ background: "var(--color-primary-dim)", color: "var(--color-primary-bright)" }}
                >
                  <motion.span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "var(--color-primary-bright)" }}
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                  Ephemeral Rollup activo
                </span>
              )}
              {isPrivate && (
                <span
                  className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full"
                  style={{ background: "var(--color-secondary-dim)", color: "var(--color-secondary-bright)" }}
                >
                  🔒 Monto privado
                </span>
              )}
              {erLatencyMs !== null && (
                <span className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full border border-white/10 text-[color:var(--color-text-dim)]">
                  Ultima actualizacion ER: {erLatencyMs}ms
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <p className="text-sm font-mono mt-4" style={{ color: "var(--color-secondary-bright)" }}>
            {error}
          </p>
        )}
        <AnimatePresence>
          {busy && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs font-mono mt-3"
              style={{ color: "var(--color-primary-bright)" }}
            >
              {busyLabel || "Procesando..."}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Tu apuesta */}
        <AnimatePresence>
          {bet && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-4 rounded-2xl mt-4 font-mono text-sm space-y-1"
            >
              <p className="text-[color:var(--color-text-dim)] text-xs uppercase tracking-widest mb-2">
                Tu apuesta
              </p>
              <p>
                Monto:{" "}
                {isPrivate ? (
                  <span style={{ color: "var(--color-secondary-bright)" }}>🔒 Oculto</span>
                ) : (
                  <AnimatedNumber value={bet.amount} decimals={4} suffix=" SOL" />
                )}
              </p>
              <p>Prediccion: {bet.predictedOutcome ? "SI" : "NO"}</p>
              <p>{bet.claimed ? "Payout reclamado" : "Sin reclamar"}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Panel MagicBlock */}
        {wallet.connected && bet && !market.resolved && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-4 rounded-2xl mt-4 space-y-3"
          >
            <p className="text-xs uppercase tracking-widest font-mono" style={{ color: "var(--color-primary-bright)" }}>
              MagicBlock
            </p>

            {!isLive ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleGoLive}
                disabled={busy}
                className="w-full rounded-xl border font-mono text-sm py-3 disabled:opacity-40"
                style={{ borderColor: "var(--color-primary)", color: "var(--color-primary-bright)" }}
              >
                Activar tiempo real (Ephemeral Rollup)
              </motion.button>
            ) : (
              <>
                <p className="text-xs text-[color:var(--color-text-dim)] font-mono">
                  Cambia tu prediccion sin friccion, dentro del rollup:
                </p>
                <div className="flex gap-2">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleUpdatePredictionEr(true)}
                    disabled={busy || bet.predictedOutcome === true}
                    className="flex-1 rounded-xl border font-mono text-sm py-2 disabled:opacity-30"
                    style={{ borderColor: "var(--color-primary)", color: "var(--color-primary-bright)" }}
                  >
                    Cambiar a SI
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleUpdatePredictionEr(false)}
                    disabled={busy || bet.predictedOutcome === false}
                    className="flex-1 rounded-xl border font-mono text-sm py-2 disabled:opacity-30"
                    style={{ borderColor: "var(--color-secondary)", color: "var(--color-secondary-bright)" }}
                  >
                    Cambiar a NO
                  </motion.button>
                </div>

                {!isPrivate && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleGoPrivate}
                    disabled={busy}
                    className="w-full rounded-xl border border-white/10 text-[color:var(--color-text-dim)] font-mono text-sm py-2.5 disabled:opacity-40"
                  >
                    🔒 Ocultar mi monto (Private ER)
                  </motion.button>
                )}

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSyncToSolana}
                  disabled={busy}
                  className="w-full rounded-xl font-mono font-semibold text-sm py-2.5 disabled:opacity-40"
                  style={{ background: "var(--color-primary)", color: "#080808" }}
                >
                  Sincronizar a Solana
                </motion.button>
              </>
            )}
          </motion.div>
        )}

        {/* Resolver (autoridad) */}
        {isAuthority && !market.resolved && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-4 rounded-2xl mt-4 space-y-3 border-dashed"
          >
            <p className="text-xs uppercase tracking-widest font-mono text-[color:var(--color-text-dim)]">
              Resolver (solo creador)
            </p>
            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => handleResolve(true)}
                disabled={busy}
                className="flex-1 rounded-xl border font-mono text-sm py-2 disabled:opacity-40"
                style={{ borderColor: "var(--color-primary)", color: "var(--color-primary-bright)" }}
              >
                Resolver: SI
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => handleResolve(false)}
                disabled={busy}
                className="flex-1 rounded-xl border font-mono text-sm py-2 disabled:opacity-40"
                style={{ borderColor: "var(--color-secondary)", color: "var(--color-secondary-bright)" }}
              >
                Resolver: NO
              </motion.button>
            </div>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleResolveVrf}
              disabled={busy}
              className="w-full rounded-xl border border-white/10 text-[color:var(--color-text-dim)] font-mono text-xs py-2.5 disabled:opacity-40"
            >
              🎲 Resolver con azar verificable (VRF)
            </motion.button>
          </motion.div>
        )}

        {/* Reclamar payout */}
        <AnimatePresence>
          {canClaim && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleSettleAndClaim}
              disabled={busy}
              className="w-full rounded-2xl font-mono font-semibold py-3 mt-4 disabled:opacity-40"
              style={{ background: "var(--color-primary)", color: "#080808" }}
            >
              {busy ? "Procesando..." : "Reclamar payout"}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom sheet flotante: colocar apuesta (solo si aun no apostaste) */}
      <AnimatePresence>
        {showBetSheet && (
          <motion.div
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-0 left-0 w-full z-50 p-4"
          >
            <div className="glass-card-solid rounded-[28px] p-4 shadow-[0_-8px_40px_rgba(0,0,0,0.6)]">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setBetOutcome(true)}
                  className="flex flex-col items-center justify-center py-3.5 rounded-2xl transition-all"
                  style={{
                    background: betOutcome ? "var(--color-primary-dim-2)" : "rgba(255,255,255,0.03)",
                    border: betOutcome ? "1px solid var(--color-primary)" : "1px solid transparent",
                    color: betOutcome ? "var(--color-primary-bright)" : "var(--color-text-dim)",
                  }}
                >
                  <span className="text-[9px] font-bold uppercase tracking-widest mb-0.5">Predecir</span>
                  <span className="font-bold">SI</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setBetOutcome(false)}
                  className="flex flex-col items-center justify-center py-3.5 rounded-2xl transition-all"
                  style={{
                    background: !betOutcome ? "var(--color-secondary-dim)" : "rgba(255,255,255,0.03)",
                    border: !betOutcome ? "1px solid var(--color-secondary)" : "1px solid transparent",
                    color: !betOutcome ? "var(--color-secondary-bright)" : "var(--color-text-dim)",
                  }}
                >
                  <span className="text-[9px] font-bold uppercase tracking-widest mb-0.5">Predecir</span>
                  <span className="font-bold">NO</span>
                </motion.button>
              </div>

              <div className="flex items-center justify-between gap-2 bg-black/40 rounded-2xl p-3 border border-white/5 mb-3">
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase font-bold text-[color:var(--color-text-dim)] mb-0.5">
                    Tu apuesta
                  </span>
                  <div className="flex items-baseline gap-1">
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      className="bg-transparent border-none p-0 font-bold text-lg outline-none w-20"
                    />
                    <span className="font-bold text-xs" style={{ color: "var(--color-primary-bright)" }}>
                      SOL
                    </span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {["0.01", "0.05"].map((v) => (
                    <button
                      key={v}
                      onClick={() => setBetAmount(v)}
                      className="px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                  <button
                    onClick={() =>
                      setBetAmount(
                        walletBalance ? Math.max(walletBalance - 0.01, 0).toFixed(3) : "0.01"
                      )
                    }
                    className="px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold transition-colors"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <SwipeToConfirm
                label={`Desliza para confirmar ${betOutcome ? "SI" : "NO"}`}
                confirmedLabel={`Apuesta ${betOutcome ? "SI" : "NO"} enviada ✓`}
                color={betOutcome ? "var(--color-primary)" : "var(--color-secondary)"}
                textColor={betOutcome ? "#080808" : "#f2f2f0"}
                onConfirm={handlePlaceBet}
                disabled={busy || !betAmount || parseFloat(betAmount) <= 0}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!wallet.connected && (
        <p className="fixed bottom-6 left-0 w-full text-center text-xs font-mono text-[color:var(--color-text-dim)] z-40 px-5">
          {t("connect_prompt")}
        </p>
      )}
    </main>
  );
}
