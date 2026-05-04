import type { AppVersionPayload } from '@/lib/pwa/appVersionTypes';

/** Version figée dans le bundle JS au build (NEXT_PUBLIC_*). */
export function getBootAppVersion(): AppVersionPayload {
  return {
    commit: (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || '').trim() || 'local',
    buildTime: (process.env.NEXT_PUBLIC_BUILD_TIME || '').trim(),
    deployEnv: (process.env.NEXT_PUBLIC_DEPLOY_ENV || process.env.NODE_ENV || 'development').trim(),
  };
}

/** True si le serveur annonce un commit Git différent du bundle (déploiement N+1). */
export function hasCommitMismatch(remote: AppVersionPayload, boot: AppVersionPayload): boolean {
  const r = (remote.commit || '').trim();
  const b = (boot.commit || '').trim();
  if (!r || r === 'unknown') return false;
  if (!b || b === 'local') return false;
  return r !== b;
}
