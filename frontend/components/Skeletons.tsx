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

export function StatCardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl bg-[color:var(--color-surface)] p-4 relative overflow-hidden ${className}`}>
      <Shimmer />
      <div className="h-3 w-16 rounded bg-[color:var(--color-surface-raised)] mb-2" />
      <div className="h-6 w-20 rounded bg-[color:var(--color-surface-raised)]" />
    </div>
  );
}

export function ListRowSkeleton() {
  return (
    <div className="rounded-2xl bg-[color:var(--color-surface)] p-4 flex items-center gap-3 relative overflow-hidden">
      <Shimmer />
      <div className="w-11 h-11 rounded-full bg-[color:var(--color-surface-raised)] shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-3/4 rounded bg-[color:var(--color-surface-raised)]" />
        <div className="h-2.5 w-1/3 rounded bg-[color:var(--color-surface-raised)]" />
      </div>
    </div>
  );
}
