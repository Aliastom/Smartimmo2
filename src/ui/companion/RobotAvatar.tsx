'use client';

/**
 * RobotAvatar - Tête de robot Android animée
 * Utilisé pour le bouton flottant du compagnon IA
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface RobotAvatarProps {
  size?: number;
  animated?: boolean;
  className?: string;
}

export function RobotAvatar({ size = 56, animated = true, className = '' }: RobotAvatarProps) {
  const [isBlinked, setIsBlinked] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // S'assurer que le composant est monté avant d'animer
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Animation de clignement des yeux
  useEffect(() => {
    if (!animated || !isMounted) return;

    const blinkInterval = setInterval(() => {
      setIsBlinked(true);
      setTimeout(() => setIsBlinked(false), 150);
    }, 3000 + Math.random() * 2000); // Clignement aléatoire entre 3-5s

    return () => clearInterval(blinkInterval);
  }, [animated, isMounted]);

  const eyeScale = isBlinked ? 0.1 : 1;
  
  // Ne pas animer avant que le composant soit monté
  const shouldAnimate = animated && isMounted;

  return (
    <div className={className} style={{ width: size, height: size }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Antennes */}
        <motion.g
          animate={shouldAnimate ? { rotate: [-5, 5, -5] } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{ originX: '0.5', originY: '0.5' }}
        >
          {/* Antenne gauche */}
          <motion.line
            x1="30"
            y1="15"
            x2="30"
            y2="5"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            animate={shouldAnimate ? { y1: ["15", "13", "15"] } : {}}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.circle
            cx="30"
            cy="5"
            r="3"
            fill="currentColor"
            animate={shouldAnimate ? {
              scale: [1, 1.2, 1],
              opacity: [0.7, 1, 0.7]
            } : {}}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
          
          {/* Antenne droite */}
          <motion.line
            x1="70"
            y1="15"
            x2="70"
            y2="5"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            animate={shouldAnimate ? { y1: ["15", "13", "15"] } : {}}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          />
          <motion.circle
            cx="70"
            cy="5"
            r="3"
            fill="currentColor"
            animate={shouldAnimate ? {
              scale: [1, 1.2, 1],
              opacity: [0.7, 1, 0.7]
            } : {}}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          />
        </motion.g>

        {/* Tête principale */}
        <motion.rect
          x="20"
          y="20"
          width="60"
          height="65"
          rx="15"
          fill="currentColor"
          opacity="1"
          stroke="rgba(0, 0, 0, 0.2)"
          strokeWidth="2"
          animate={shouldAnimate ? {
            y: ["20", "18", "20"],
          } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Écran facial (zone claire) */}
        <motion.rect
          x="25"
          y="30"
          width="50"
          height="45"
          rx="10"
          fill="white"
          opacity="0.15"
          animate={shouldAnimate ? {
            opacity: [0.15, 0.25, 0.15]
          } : {}}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Œil gauche */}
        <motion.g>
          <ellipse
            cx="37"
            cy="45"
            rx="6"
            ry={6 * eyeScale}
            fill="white"
            stroke="rgba(0, 0, 0, 0.15)"
            strokeWidth="1"
          />
          <motion.circle
            cx="37"
            cy="45"
            r="3"
            fill="rgba(0, 0, 0, 0.6)"
            animate={shouldAnimate && !isBlinked ? {
              cx: ["37", "39", "37", "35", "37"],
              cy: ["45", "46", "45", "46", "45"],
            } : {}}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.g>

        {/* Œil droit */}
        <motion.g>
          <ellipse
            cx="63"
            cy="45"
            rx="6"
            ry={6 * eyeScale}
            fill="white"
            stroke="rgba(0, 0, 0, 0.15)"
            strokeWidth="1"
          />
          <motion.circle
            cx="63"
            cy="45"
            r="3"
            fill="rgba(0, 0, 0, 0.6)"
            animate={shouldAnimate && !isBlinked ? {
              cx: ["63", "65", "63", "61", "63"],
              cy: ["45", "46", "45", "46", "45"],
            } : {}}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.g>

        {/* Sourire */}
        <motion.path
          d="M 35 62 Q 50 70 65 62"
          stroke="white"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.95"
          filter="drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))"
          animate={shouldAnimate ? {
            d: [
              "M 35 62 Q 50 70 65 62",
              "M 35 62 Q 50 72 65 62",
              "M 35 62 Q 50 70 65 62",
            ]
          } : {}}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Détails tech - lignes de circuit */}
        <motion.g
          opacity="0.3"
          animate={shouldAnimate ? {
            opacity: [0.3, 0.5, 0.3]
          } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <line x1="30" y1="55" x2="33" y2="55" stroke="white" strokeWidth="1.5" />
          <line x1="67" y1="55" x2="70" y2="55" stroke="white" strokeWidth="1.5" />
        </motion.g>

        {/* Oreilles/Capteurs latéraux */}
        <motion.rect
          x="15"
          y="45"
          width="5"
          height="15"
          rx="2"
          fill="currentColor"
          opacity="0.8"
          animate={shouldAnimate ? { height: ["15", "17", "15"] } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.rect
          x="80"
          y="45"
          width="5"
          height="15"
          rx="2"
          fill="currentColor"
          opacity="0.8"
          animate={shouldAnimate ? { height: ["15", "17", "15"] } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        />

        {/* Petite LED indicateur (en haut) */}
        <motion.circle
          cx="50"
          cy="27"
          r="2"
          fill="#10b981"
          animate={shouldAnimate ? {
            opacity: [0.5, 1, 0.5],
            scale: [1, 1.2, 1]
          } : {}}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
    </div>
  );
}

