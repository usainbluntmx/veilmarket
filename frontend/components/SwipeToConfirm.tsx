"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

const THUMB_SIZE = 52;
const COMPLETE_RATIO = 0.7;

export function SwipeToConfirm({
  label,
  confirmedLabel = "Confirmado ✓",
  color,
  textColor = "#080808",
  onConfirm,
  disabled = false,
}: {
  label: string;
  confirmedLabel?: string;
  color: string;
  textColor?: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(true);
  const x = useMotionValue(0);
  const fillWidth = useTransform(x, (v) => v + THUMB_SIZE);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  async function handleDragEnd() {
    const track = trackRef.current;
    if (!track || disabled || busy) return;
    const max = track.offsetWidth - THUMB_SIZE;
    const current = x.get();

    if (max > 0 && current / max >= COMPLETE_RATIO) {
      animate(x, max, { type: "spring", stiffness: 400, damping: 40 });
      setConfirmed(true);
      setBusy(true);
      try {
        await onConfirm();
      } finally {
        // Regresa el slider a su posicion inicial tras completarse,
        // exito o error (el mensaje de error ya se muestra aparte).
        setTimeout(() => {
          if (!isMounted.current) return;
          setBusy(false);
          setConfirmed(false);
          animate(x, 0, { type: "spring", stiffness: 400, damping: 40 });
        }, 900);
      }
    } else {
      animate(x, 0, { type: "spring", stiffness: 400, damping: 40 });
    }
  }

  return (
    <div
      ref={trackRef}
      className="relative w-full h-14 rounded-full overflow-hidden select-none"
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: color, width: fillWidth }}
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
        <span
          className="text-sm font-mono font-semibold"
          style={{ color: confirmed ? textColor : "var(--color-text-dim)" }}
        >
          {confirmed ? (busy ? "Enviando..." : confirmedLabel) : label}
        </span>
      </div>
      <motion.div
        drag={disabled || confirmed ? false : "x"}
        dragConstraints={trackRef}
        dragElastic={0}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ x, width: THUMB_SIZE, height: THUMB_SIZE, background: color }}
        className="absolute top-1/2 left-1 -translate-y-1/2 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg"
      >
        <span style={{ color: textColor }} className="text-lg leading-none">
          {confirmed ? "✓" : "→"}
        </span>
      </motion.div>
    </div>
  );
}
