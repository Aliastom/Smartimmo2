'use client';

import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { navAuditLog } from '@/lib/dev/navAudit';

interface AppShellContentProps {
  children: React.ReactNode;
  pageKey: string;
}

/**
 * Wrapper animé pour le contenu de l'AppShell
 * Fournit des transitions douces type Ulys lors des changements de pages internes
 */
export function AppShellContent({ children, pageKey }: AppShellContentProps) {
  useEffect(() => {
    navAuditLog('page content mount', pageKey);
    return () => navAuditLog('page content unmount', pageKey);
  }, [pageKey]);

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

