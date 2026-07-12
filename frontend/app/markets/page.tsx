"use client";

import { useEffect, useState, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useVeilWallet } from "@/lib/useVeilWallet";
import { useLanguage } from "@/lib/i18n";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import Link from "next/link";
import { getProgram, fetchMarketOdds } from "@/lib/veilmarket";
import { WalletButton } from "@/components/WalletButton";
import { LanguageToggle } from "@/components/LanguageToggle";

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

// Gradiente decorativo determinista por mercado (no es data real, solo
// variedad visual entre cards ya que no tenemos imagenes por partido).
function gradientFor(matchId: string): string {
  let hash = 0;
  for (let i = 0; i < matchId.length; i++) hash = matchId.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(160deg, hsla(${hue},70%,25%,0.55), hsla(${(hue + 70) % 360},70%,15%,0.85))`;
}

function OddsBar({
  yes,
  no,
  labelOdds,
  labelNoBets,
}: {
  yes: number;
  no: number;
  labelOdds: string;
  labelNoBets: string;
}) {
  const total = yes + no;
  const yesPct = total > 0 ? Math.round((yes / total) * 100) : 50;
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5 font-mono text-xs">
        <span className="text-[color:var(--color-text-dim)]">{labelOdds}</span>
        <span style={{ color: "var(--color-primary-bright)" }}>
          {total > 0 ? `${yesPct}% YES` : labelNoBets}
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
        <div className="h-full flex-1" style={{ background: "var(--color-secondary)" }} />
      </div>
    </div>
  );
}

// Umbrales calibrados para que el swipe se sienta rapido, no forzado:
// se activa por distancia O por velocidad, lo que se cumpla primero.
const SWIPE_DISTANCE_THRESHOLD = 60;
const SWIPE_VELOCITY_THRESHOLD = 400;

export default function MarketsFeedPage() {
  const { connection } = useConnection();
  const wallet = useVeilWallet();
  const { t } = useLanguage();
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [odds, setOdds] = useState<{ yesLamports: number; noLamports: number } | null>(null);

  const y = useMotionValue(0);
  const dragOpacity = useTransform(y, [-160, 0, 160], [0.4, 1, 0.4]);

  const loadMarkets = useCallback(async () => {
    try {
      const provider = new AnchorProvider(
        connection,
        (wallet.wallet as unknown as AnchorProvider["wallet"]) ?? ({} as never),
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
  }, [connection, wallet.publicKey?.toBase58()]);

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
      (wallet.wallet as unknown as AnchorProvider["wallet"]) ?? ({} as never),
      { commitment: "confirmed" }
    );
    const program = getProgram(provider);
    fetchMarketOdds(program, new PublicKey(current.pubkey))
      .then((o) => setOdds({ yesLamports: o.yesLamports, noLamports: o.noLamports }))
      .catch(() => setOdds(null));
  }, [current, connection, wallet.publicKey?.toBase58()]);

  function goNext() {
    setIndex((i) => Math.min(i + 1, markets.length - 1));
  }
  function goPrev() {
    setIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <main className="h-dvh w-full overflow-hidden flex flex-col relative">
      {/* Barra superior */}
      <header className="fixed top-0 w-full z-50 glass-card-solid px-5 py-3 flex justify-between items-center h-16">
        <Link href="/" className="font-bold text-base tracking-tight" style={{ color: "var(--color-primary)" }}>
          VeilMarket
        </Link>
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

      {/* Canvas central */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 pt-16 pb-36 relative overflow-y-auto">
        {loading && (
          <p className="font-mono text-sm text-[color:var(--color-text-dim)]">
            {t("feed_loading")}
          </p>
        )}

        {!loading && markets.length === 0 && (
          <div className="glass-card rounded-3xl p-6 text-center max-w-sm">
            <p className="text-sm text-[color:var(--color-text-dim)] mb-4">
              {t("feed_empty")}
            </p>
            <Link
              href="/"
              className="inline-block text-xs font-mono px-4 py-2 rounded-full"
              style={{ background: "var(--color-primary)", color: "#080808" }}
            >
              {t("feed_create_market")}
            </Link>
          </div>
        )}

        {!loading && current && (
          <div className="w-full max-w-md">
            <div className="relative" style={{ aspectRatio: "3/4" }}>
              {/* Stacks de profundidad */}
              <div className="absolute -bottom-4 left-4 right-4 h-full glass-card rounded-[32px] -z-10 opacity-40 scale-[0.95]" />
              <div className="absolute -bottom-8 left-8 right-8 h-full glass-card rounded-[32px] -z-20 opacity-20 scale-[0.9]" />

              <AnimatePresence mode="wait">
                <motion.div
                  key={current.pubkey}
                  drag="y"
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={0.15}
                  style={{ y, opacity: dragOpacity }}
                  onDragEnd={(_, info) => {
                    const shouldAdvance =
                      info.offset.y < -SWIPE_DISTANCE_THRESHOLD ||
                      info.velocity.y < -SWIPE_VELOCITY_THRESHOLD;
                    const shouldGoBack =
                      info.offset.y > SWIPE_DISTANCE_THRESHOLD ||
                      info.velocity.y > SWIPE_VELOCITY_THRESHOLD;
                    y.set(0);
                    if (shouldAdvance) goNext();
                    else if (shouldGoBack) goPrev();
                  }}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  className="glass-card w-full h-full rounded-[32px] overflow-hidden flex flex-col relative cursor-grab active:cursor-grabbing"
                >
                  <div
                    className="absolute inset-0"
                    style={{ background: gradientFor(current.matchId) }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

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
                        {current.resolved ? t("feed_resolved") : t("feed_live")}
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
                          {t("feed_volume")}
                        </span>
                        <span className="text-white font-mono text-sm">
                          {current.totalPool.toFixed(3)} SOL
                        </span>
                      </div>
                    </div>

                    {odds && <OddsBar yes={odds.yesLamports} no={odds.noLamports} labelOdds={t("feed_odds_current")} labelNoBets={t("feed_no_bets_yet")} />}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Boton fuera del area de arrastre: nunca compite con el gesto de swipe */}
            <Link href={`/markets/${current.pubkey}`} className="block mt-4">
              <motion.div
                whileTap={{ scale: 0.97 }}
                className="w-full text-center rounded-2xl py-3.5 font-mono text-sm font-semibold"
                style={{ background: "var(--color-primary)", color: "#080808" }}
              >
                {t("feed_view_detail")}
              </motion.div>
            </Link>

            <p className="mt-4 text-[11px] font-mono text-[color:var(--color-text-faint)] text-center">
              {t("feed_swipe_hint")} · {index + 1} / {markets.length}
            </p>
          </div>
        )}
      </div>

      {/* Barra inferior */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 safe-pb pt-2 glass-card-solid rounded-t-2xl">
        <div
          className="flex flex-col items-center justify-center rounded-full px-4 py-1"
          style={{ background: "var(--color-primary-dim)", color: "var(--color-primary-bright)" }}
        >
          <span className="text-lg">🧭</span>
          <span className="text-[10px] font-mono">{t("nav_explore")}</span>
        </div>
        <Link
          href="/portfolio"
          className="flex flex-col items-center justify-center text-[color:var(--color-text-dim)]"
        >
          <span className="text-lg">💼</span>
          <span className="text-[10px] font-mono">{t("nav_portfolio")}</span>
        </Link>
        <Link
          href="/"
          className="flex flex-col items-center justify-center text-[color:var(--color-text-dim)]"
        >
          <span className="text-lg">➕</span>
          <span className="text-[10px] font-mono">{t("nav_create")}</span>
        </Link>
        <Link
          href="/profile"
          className="flex flex-col items-center justify-center text-[color:var(--color-text-dim)]"
        >
          <span className="text-lg">👤</span>
          <span className="text-[10px] font-mono">{t("nav_profile")}</span>
        </Link>
      </nav>
    </main>
  );
}
