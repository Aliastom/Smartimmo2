'use client';

import { useMemo } from 'react';
import { getBootAppVersion } from '@/lib/pwa/bootAppVersion';

/**
 * Pastille discrète build / commit (variables NEXT_PUBLIC_* injectées au build).
 */
export function AppVersionBadge() {
  const label = useMemo(() => {
    const v = getBootAppVersion();
    const short =
      v.commit && v.commit !== 'local' ? v.commit.slice(0, 7) : v.commit || 'dev';
    return `${short} · ${v.deployEnv}`;
  }, []);

  return (
    <div
      className="pointer-events-none fixed bottom-1 left-1 z-[9990] max-w-[min(100%,12rem)] select-none truncate rounded bg-base-200/80 px-1.5 py-0.5 font-mono text-[10px] text-base-content/50 opacity-70"
      title="Version du bundle (build Vercel / local)"
      aria-hidden
    >
      {label}
    </div>
  );
}
