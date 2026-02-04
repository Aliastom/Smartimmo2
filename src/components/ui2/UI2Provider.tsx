/**
 * Provider pour activer les styles UI2 globalement
 * Ajoute une classe au body quand ui2=true pour permettre aux styles CSS de s'appliquer
 */
'use client';

import { useEffect } from 'react';
import { useUI2 } from '@/hooks/useUI2';

export function UI2Provider({ children }: { children: React.ReactNode }) {
  const isUI2Active = useUI2();

  useEffect(() => {
    if (isUI2Active) {
      document.body.classList.add('ui2-active');
    } else {
      document.body.classList.remove('ui2-active');
    }

    // Cleanup
    return () => {
      document.body.classList.remove('ui2-active');
    };
  }, [isUI2Active]);

  return <>{children}</>;
}

