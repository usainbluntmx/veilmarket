"use client";

import { motion } from "framer-motion";

export function MarketCardSkeleton() {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 overflow-hidden relative">
      <Shimmer />
      <div className="h-3 w-20 rounded bg-[color:var(--color-surface-raised)] mb-3" />
      <div className="h-4 w-4/5 rounded bg-[color:var(--color-surface-raised)] mb-2" />
      <div className="h-4 w-3/5 rounded bg-[color:var(--color-surface-raised)] mb-4" />
      <div className="h-5 w-24 rounded bg-[color:var(--color-surface-raised)] ml-auto" />
    </div>
  );
}

function Shimmer() {
  return (
    <motion.div
      className="absolute inset-0 -translate-x-full"
      style={{
        background:
          "linear-gradient(90deg, transparent, rgba(201,162,39,0.08), transparent)",
      }}
      animate={{ translateX: ["-100%", "100%"] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
    />
  );
}
