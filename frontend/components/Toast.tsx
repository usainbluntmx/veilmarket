"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type ToastState = { message: string; kind: "success" | "error" } | null;

export function Toast({
  toast,
  onDismiss,
  duration = 2600,
}: {
  toast: ToastState;
  onDismiss: () => void;
  duration?: number;
}) {
  // onDismiss suele llegar como funcion inline desde el padre (nueva
  // referencia en cada render). Si el efecto dependiera de ella
  // directamente, cada re-render del padre reiniciaria el timer antes
  // de que se cumpliera, y el toast nunca se desvanecia. La guardamos
  // en un ref para que el efecto solo dependa de `toast` de verdad.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => onDismissRef.current(), duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, duration]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: 20, x: "-50%" }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-24 left-1/2 z-[100] px-5 py-3 rounded-2xl glass-card-solid flex items-center gap-2 max-w-[90%]"
          style={{
            borderColor: toast.kind === "success" ? "var(--color-primary)" : "var(--color-secondary)",
          }}
        >
          <span
            className="text-lg"
            style={{
              color: toast.kind === "success" ? "var(--color-primary-bright)" : "var(--color-secondary-bright)",
            }}
          >
            {toast.kind === "success" ? "✓" : "⚠"}
          </span>
          <span className="text-sm font-mono">{toast.message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
