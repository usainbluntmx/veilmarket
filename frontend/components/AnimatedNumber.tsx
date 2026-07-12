"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

export function AnimatedNumber({
  value,
  decimals = 4,
  suffix = "",
  className = "",
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => v.toFixed(decimals));
  const prevValue = useRef(0);

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1],
    });
    prevValue.current = value;
    return controls.stop;
  }, [value, motionValue]);

  return (
    <motion.span className={className}>
      <motion.span>{rounded}</motion.span>
      {suffix}
    </motion.span>
  );
}
