'use client';

/**
 * Composant d'affichage de la version de l'application
 * Affiche automatiquement la version basée sur les informations Git de Vercel
 * (branche + SHA du commit) - 100% automatique, sans maintenance manuelle
 */
export function AppVersionBadge() {
  const commitSha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_GIT_COMMIT_SHA || '';
  const commitRef = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF || '';
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || '';
  const deployEnv = process.env.NEXT_PUBLIC_DEPLOY_ENV || process.env.NODE_ENV || 'development';

  const shortSha = commitSha ? commitSha.slice(0, 7) : 'local';
  const shortEnv = deployEnv === 'production' ? 'prod' : deployEnv === 'development' ? 'dev' : deployEnv;
  const buildLabel = buildTime ? new Date(buildTime).toLocaleString('fr-FR', { hour12: false }) : 'build n/a';

  return (
    <div className="text-[10px] md:text-xs text-slate-400 font-mono text-center leading-tight" title={`branche: ${commitRef || 'n/a'}`}>
      <div>Smartimmo · {shortSha} · {shortEnv}</div>
      <div>{buildLabel}</div>
    </div>
  );
}

