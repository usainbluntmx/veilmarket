"use client";

import { motion, AnimatePresence } from "framer-motion";

export function WalletLinkedOverlay({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-[color:var(--color-bg)]/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center pointer-events-none"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="glass-card p-8 rounded-3xl flex flex-col items-center gap-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 15 }}
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-primary), var(--color-secondary))",
              }}
            >
              ✓
            </motion.div>
            <h2 className="text-lg font-bold text-center">Wallet conectada</h2>
            <p className="text-sm text-[color:var(--color-text-dim)] text-center max-w-[220px]">
              Bienvenido al futuro de las predicciones.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
