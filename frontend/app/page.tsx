"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useConnection } from "@solana/wallet-adapter-react";
import { useVeilWallet } from "@/lib/useVeilWallet";
import { useLanguage } from "@/lib/i18n";
import { AnchorProvider, web3 } from "@coral-xyz/anchor";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { getProgram, marketPda } from "@/lib/veilmarket";
import { WalletButton } from "@/components/WalletButton";
import { LanguageToggle } from "@/components/LanguageToggle";
import { LedText } from "@/components/LedText";
import { WalletLinkedOverlay } from "@/components/WalletLinkedOverlay";

export default function LandingPage() {
  const { connection } = useConnection();
  const wallet = useVeilWallet();
  const { t } = useLanguage();
  const router = useRouter();

  const [balance, setBalance] = useState<number | null>(null);
  const [matchId, setMatchId] = useState("");
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const wasConnected = useRef<boolean | null>(null);

  const steps = [
    { icon: "👉", title: t("landing_step1_title"), desc: t("landing_step1_desc") },
    { icon: "👈", title: t("landing_step2_title"), desc: t("landing_step2_desc") },
    { icon: "💸", title: t("landing_step3_title"), desc: t("landing_step3_desc") },
  ];

  useEffect(() => {
    if (wasConnected.current === null) {
      wasConnected.current = wallet.connected;
      return;
    }
    if (wallet.connected && !wasConnected.current) {
      setShowWelcome(true);
      const timer = setTimeout(() => setShowWelcome(false), 1400);
      wasConnected.current = true;
      return () => clearTimeout(timer);
    }
    wasConnected.current = wallet.connected;
  }, [wallet.connected]);

  useEffect(() => {
    if (!wallet.publicKey) {
      setBalance(null);
      return;
    }
    connection
      .getBalance(wallet.publicKey)
      .then((lamports) => setBalance(lamports / 1_000_000_000))
      .catch(() => setBalance(null));
  }, [connection, wallet.publicKey]);

  const canSubmit =
    wallet.connected && matchId.trim().length > 0 && question.trim().length > 0;

  function handleQuickConnect() {
    wallet.connect();
  }

  async function handleCreateMarket() {
    if (!wallet.publicKey || !wallet.wallet) return;
    setSubmitting(true);
    setError(null);
    try {
      const provider = new AnchorProvider(
        connection,
        wallet.wallet as unknown as AnchorProvider["wallet"],
        { commitment: "confirmed" }
      );
      const program = getProgram(provider);
      const pda = marketPda(matchId.trim());

      await program.methods
        .createMarket(matchId.trim(), question.trim())
        .accounts({
          market: pda,
          authority: wallet.publicKey,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      router.push(`/markets/${pda.toBase58()}`);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Error creating market.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-dvh pb-20">
      <WalletLinkedOverlay
        visible={showWelcome}
        title={t("landing_wallet_linked_title")}
        subtitle={t("landing_wallet_linked_sub")}
      />
      <nav className="fixed top-0 w-full z-50 glass-card-solid px-5 py-3 flex justify-between items-center h-16">
        <div className="font-bold text-lg tracking-tight uppercase text-[color:var(--color-primary)]">
          VeilMarket
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
          <AnimatePresence mode="wait">
            {wallet.connected ? (
              <motion.div
                key="connected"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2"
              >
                <div className="bg-[color:var(--color-surface-high)] rounded-full px-3 py-1 flex items-center gap-2 border border-white/5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-primary)] animate-pulse" />
                  <span className="font-mono text-xs">
                    {balance !== null ? `${balance.toFixed(3)} SOL` : "..."}
                  </span>
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
              </motion.div>
            ) : (
              <motion.button
                key="disconnected"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleQuickConnect}
                className="text-xs font-mono px-4 py-2 rounded-full bg-[color:var(--color-primary)] text-[#080808] font-semibold"
              >
                {t("connect")}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </nav>

      <div className="pt-16">
        <section className="relative px-5 pt-12 pb-14 flex flex-col items-center text-center overflow-hidden">
          <div
            className="blob top-0 -left-20"
            style={{ background: "radial-gradient(circle, rgba(20,241,149,0.18) 0%, rgba(153,69,255,0) 70%)" }}
          />
          <div
            className="blob bottom-0 -right-20"
            style={{ background: "radial-gradient(circle, rgba(153,69,255,0.16) 0%, rgba(20,241,149,0) 70%)" }}
          />

          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[11px] tracking-[0.25em] uppercase text-[color:var(--color-primary)] font-mono mb-4"
          >
            {t("landing_eyebrow")}
          </motion.p>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-5 leading-[1.05] bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
            <LedText text={t("landing_headline_1")} />
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, var(--color-primary), var(--color-secondary))" }}
            >
              {t("landing_headline_accent")}
            </span>{" "}
            {t("landing_headline_2")}
          </h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-[color:var(--color-text-dim)] text-sm leading-relaxed mb-10 max-w-xs"
          >
            {t("landing_subtitle_pre")}{" "}
            <span className="text-[color:var(--color-primary)]">{t("landing_subtitle_private")}</span>{" "}
            {t("landing_subtitle_post")}
          </motion.p>

          <div className="w-full max-w-sm mb-10">
            <AnimatePresence mode="wait">
              {!wallet.connected ? (
                <motion.button
                  key="connect"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleQuickConnect}
                  className="w-full py-4 rounded-2xl font-mono font-semibold text-sm glow-primary active:scale-95 transition-all"
                  style={{
                    background: "linear-gradient(135deg, var(--color-primary), var(--color-secondary))",
                    color: "#080808",
                  }}
                >
                  {t("landing_cta_primary")}
                </motion.button>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="glass-card rounded-3xl p-5 text-left"
                >
                  <p className="text-xs uppercase tracking-widest font-mono text-[color:var(--color-primary)] mb-4">
                    {t("landing_new_market")}
                  </p>

                  <label className="block text-[11px] uppercase tracking-widest font-mono text-[color:var(--color-text-dim)] mb-1.5">
                    {t("landing_identifier")}
                  </label>
                  <input
                    type="text"
                    value={matchId}
                    onChange={(e) => setMatchId(e.target.value)}
                    placeholder="mex-vs-usa-15jun"
                    maxLength={32}
                    className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-4 py-3 font-mono text-sm outline-none focus:border-[color:var(--color-primary)] mb-4"
                  />

                  <label className="block text-[11px] uppercase tracking-widest font-mono text-[color:var(--color-text-dim)] mb-1.5">
                    {t("landing_question")}
                  </label>
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Will Mexico win the match?"
                    maxLength={200}
                    rows={2}
                    className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-4 py-3 text-sm outline-none focus:border-[color:var(--color-primary)] resize-none mb-4"
                  />

                  {error && (
                    <p className="text-xs text-[color:var(--color-secondary-bright)] font-mono mb-3">
                      {error}
                    </p>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleCreateMarket}
                    disabled={!canSubmit || submitting}
                    className="w-full rounded-xl py-3.5 font-mono font-semibold text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{
                      background: "linear-gradient(135deg, var(--color-primary), var(--color-secondary))",
                      color: "#080808",
                    }}
                  >
                    {submitting ? t("landing_creating") : t("landing_create_market")}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link
            href="/markets"
            className="text-sm font-mono text-[color:var(--color-text-dim)] hover:text-[color:var(--color-primary)] transition-colors"
          >
            {t("landing_view_all_markets")}
          </Link>
        </section>

        <section className="px-5 mb-16">
          <h2 className="text-lg font-bold mb-6 text-center">{t("landing_steps_title")}</h2>
          <div className="flex flex-col gap-3">
            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="glass-card p-5 rounded-3xl flex items-center gap-5"
              >
                <div className="w-12 h-12 rounded-2xl bg-[color:var(--color-primary-dim)] flex items-center justify-center text-2xl border border-[color:var(--color-primary)]/20 shrink-0">
                  {s.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-0.5">{s.title}</h3>
                  <p className="text-xs text-[color:var(--color-text-dim)] leading-snug">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="px-5 mb-16">
          <div className="grid grid-cols-2 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="col-span-2 glass-card rounded-3xl p-6 relative overflow-hidden"
            >
              <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl" style={{ background: "rgba(20,241,149,0.2)" }} />
              <span className="text-2xl mb-3 block">⚡</span>
              <h3 className="text-base font-semibold mb-1.5">{t("landing_feature_solana_title")}</h3>
              <p className="text-xs text-[color:var(--color-text-dim)] leading-relaxed">{t("landing_feature_solana_desc")}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass-card rounded-3xl p-5"
            >
              <span className="text-2xl mb-3 block">🔒</span>
              <h3 className="text-sm font-semibold mb-1">{t("landing_feature_privacy_title")}</h3>
              <p className="text-xs text-[color:var(--color-text-dim)]">{t("landing_feature_privacy_desc")}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass-card rounded-3xl p-5"
            >
              <span className="text-2xl mb-3 block">🔑</span>
              <h3 className="text-sm font-semibold mb-1">{t("landing_feature_noncustodial_title")}</h3>
              <p className="text-xs text-[color:var(--color-text-dim)]">{t("landing_feature_noncustodial_desc")}</p>
            </motion.div>
          </div>
        </section>

        <section className="px-5 text-center">
          <div className="glass-card rounded-[32px] p-8 relative overflow-hidden">
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(135deg, rgba(153,69,255,0.05), transparent)" }}
            />
            <h2 className="text-lg font-bold mb-5 relative z-10">{t("landing_cta_final_title")}</h2>
            {!wallet.connected ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleQuickConnect}
                className="w-full py-4 rounded-2xl font-mono font-semibold text-sm relative z-10 glow-primary"
                style={{ background: "var(--color-secondary)", color: "#080808" }}
              >
                {t("connect_wallet")}
              </motion.button>
            ) : (
              <Link href="/markets">
                <motion.div
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-4 rounded-2xl font-mono font-semibold text-sm relative z-10 glow-primary"
                  style={{ background: "var(--color-secondary)", color: "#080808" }}
                >
                  {t("landing_view_markets")}
                </motion.div>
              </Link>
            )}
            <Link
              href="/markets"
              className="inline-block mt-4 text-xs font-mono text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)] transition-colors relative z-10"
            >
              {t("landing_view_as_guest")}
            </Link>
          </div>
        </section>

        <footer className="py-10 text-center px-5 opacity-40">
          <div className="text-xs font-mono tracking-widest uppercase">VeilMarket</div>
          <p className="text-[11px] text-[color:var(--color-text-dim)] max-w-xs mx-auto mt-2">
            {t("landing_footer_tag")}
          </p>
        </footer>
      </div>
    </main>
  );
}
