"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, web3 } from "@coral-xyz/anchor";
import { motion } from "framer-motion";
import Link from "next/link";
import { getProgram, marketPda } from "@/lib/veilmarket";
import { PageTransition } from "@/components/PageTransition";

export default function NewMarketPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const router = useRouter();

  const [matchId, setMatchId] = useState("");
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    wallet.connected && matchId.trim().length > 0 && question.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setSubmitting(true);
    setError(null);
    try {
      const provider = new AnchorProvider(
        connection,
        wallet as unknown as AnchorProvider["wallet"],
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
      setError(err?.message ?? "No se pudo crear el mercado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageTransition>
    <main className="min-h-dvh px-5 pb-24 pt-6 mx-auto max-w-md">
      <Link
        href="/"
        className="inline-block mb-6 text-sm font-mono text-[color:var(--color-text-dim)] hover:text-[color:var(--color-mint)]"
      >
        ← Volver
      </Link>

      <h1 className="text-2xl font-bold tracking-tight mb-1">
        Nuevo mercado
      </h1>
      <p className="text-sm text-[color:var(--color-text-dim)] mb-6">
        Crea un mercado de predicción sobre un partido del Mundial 2026.
      </p>

      {!wallet.connected && (
        <p className="text-sm text-[color:var(--color-field)] mb-4 font-mono">
          Conecta tu wallet primero para poder crear un mercado.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs uppercase tracking-widest font-mono text-[color:var(--color-text-dim)] mb-2">
            Identificador del partido
          </label>
          <input
            type="text"
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            placeholder="mex-vs-usa-15jun"
            maxLength={32}
            className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 font-mono text-sm outline-none focus:border-[color:var(--color-mint)]"
          />
          <p className="mt-1 text-[11px] text-[color:var(--color-text-dim)] font-mono">
            Unico e irrepetible. Max 32 caracteres.
          </p>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest font-mono text-[color:var(--color-text-dim)] mb-2">
            Pregunta del mercado
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="¿Mexico gana el partido?"
            maxLength={200}
            rows={3}
            className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-sm outline-none focus:border-[color:var(--color-mint)] resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-[color:var(--color-field)] font-mono">
            {error}
          </p>
        )}

        <motion.button
          type="submit"
          whileTap={{ scale: 0.97 }}
          disabled={!canSubmit || submitting}
          className="w-full rounded-2xl bg-[color:var(--color-mint)] text-[#0B0E14] font-mono font-semibold py-3 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Creando..." : "Crear mercado"}
        </motion.button>
      </form>
    </main>
    </PageTransition>
  );
}
