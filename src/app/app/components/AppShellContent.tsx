'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface AppShellContentProps {
  children: React.ReactNode;
  pageKey: string;
}

/**
 * Wrapper animé pour le contenu de l'AppShell
 * Fournit des transitions douces type Ulys lors des changements de pages internes
 */
export function AppShellContent({ children, pageKey }: AppShellContentProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pageKey}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{
          duration: 0.3,
          ease: [0.4, 0, 0.2, 1], // easeOut
        }}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

