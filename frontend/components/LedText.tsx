"use client";

import { motion } from "framer-motion";

export function LedText({
  text,
  className = "",
  accentIndexFrom,
}: {
  text: string;
  className?: string;
  /** Indice desde el cual las letras usan el color de acento (amarillo) */
  accentIndexFrom?: number;
}) {
  const letters = text.split("");

  return (
    <span className={className} aria-label={text}>
      {letters.map((char, i) => {
        const isAccent =
          accentIndexFrom !== undefined && i >= accentIndexFrom;
        return (
          <motion.span
            key={i}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.4, 1] }}
            transition={{
              delay: i * 0.045,
              duration: 0.4,
              times: [0, 0.5, 0.75, 1],
            }}
            className="inline-block"
            style={{
              color: isAccent ? "var(--color-yellow)" : undefined,
              textShadow: isAccent
                ? "0 0 18px rgba(201,162,39,0.55)"
                : "0 0 14px rgba(242,242,240,0.25)",
            }}
          >
            {char === " " ? "\u00A0" : char}
          </motion.span>
        );
      })}
    </span>
  );
}
