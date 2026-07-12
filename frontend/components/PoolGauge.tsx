"use client";

import { motion } from "framer-motion";
import { AnimatedNumber } from "@/components/AnimatedNumber";

export function PoolGauge({
  valueSol,
  capSol = 0.5,
  label = "Pool total",
}: {
  valueSol: number;
  capSol?: number;
  label?: string;
}) {
  const size = 180;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // Arco de 270 grados (como un velocimetro), dejando 90 grados abiertos abajo
  const arcFraction = 0.75;
  const arcLength = circumference * arcFraction;
  const fraction = Math.min(valueSol / capSol, 1);
  const filledLength = arcLength * fraction;
  const rotationOffset = 135; // empieza abajo-izquierda

  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-[0deg]"
      >
        {/* Riel de fondo */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={0}
          transform={`rotate(${rotationOffset} ${size / 2} ${size / 2})`}
        />
        {/* Progreso animado */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-yellow)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          initial={{ strokeDashoffset: arcLength }}
          animate={{ strokeDashoffset: arcLength - filledLength }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          transform={`rotate(${rotationOffset} ${size / 2} ${size / 2})`}
          style={{
            filter: "drop-shadow(0 0 6px rgba(201,162,39,0.5))",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold font-mono text-[color:var(--color-yellow)]">
          <AnimatedNumber value={valueSol} decimals={3} />
        </span>
        <span className="text-[10px] uppercase tracking-widest font-mono text-[color:var(--color-text-dim)] mt-1">
          {label}
        </span>
      </div>
    </div>
  );
}
