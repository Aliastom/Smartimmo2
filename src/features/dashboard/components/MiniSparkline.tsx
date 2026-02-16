'use client';

import React from 'react';
import { motion } from 'framer-motion';

export interface MiniSparklineProps {
  /** Valeurs ordonnées (ex: 6 derniers mois) */
  data: number[];
  /** Hauteur en px */
  height?: number;
  /** Couleur (Tailwind ou hex) */
  color?: string;
  /** Durée animation en s */
  duration?: number;
  className?: string;
}

export function MiniSparkline({
  data,
  height = 24,
  color = 'currentColor',
  duration = 0.5,
  className,
}: MiniSparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 40;
  const step = w / (data.length - 1);

  const points = data
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={w} height={height} className={className} aria-hidden>
      <motion.polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration, ease: 'easeOut' }}
      />
    </svg>
  );
}
