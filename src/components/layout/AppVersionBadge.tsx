'use client';

/**
 * Composant d'affichage de la version de l'application
 * Affiche automatiquement la version basée sur les informations Git de Vercel
 * (branche + SHA du commit) - 100% automatique, sans maintenance manuelle
 */
export function AppVersionBadge() {
  const commitSha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
  const commitRef = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF;

  // Ne rien afficher si aucune info Git n'est disponible (ex: en local sans config)
  if (!commitSha && !commitRef) {
    return null;
  }

  // Raccourcir le SHA à 7 caractères (format standard Git)
  const shortSha = commitSha ? commitSha.slice(0, 7) : null;

  // Construire le texte à afficher : Smartimmo · branche · sha
  const parts: string[] = [];
  
  // Ajouter la branche si disponible
  if (commitRef) {
    parts.push(commitRef);
  }
  
  // Ajouter le SHA si disponible
  if (shortSha) {
    parts.push(shortSha);
  }

  // Ne rien afficher si on n'a aucune information
  if (parts.length === 0) {
    return null;
  }

  return (
    <div className="text-[10px] md:text-xs text-slate-400 font-mono">
      Smartimmo · {parts.join(' · ')}
    </div>
  );
}

