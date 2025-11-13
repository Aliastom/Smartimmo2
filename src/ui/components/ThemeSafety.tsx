'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

interface ThemeSafetyProps {
  children: React.ReactNode;
}

// Liste des thèmes validés et sécurisés
const SAFE_THEMES = ['smartimmo', 'light', 'dark'] as const;
const DEFAULT_SAFE_THEME = 'smartimmo';

export function ThemeSafety({ children }: ThemeSafetyProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    // Vérifier si les thèmes sont activés via feature flag
    const themesEnabled = process.env.NEXT_PUBLIC_THEMES_ENABLED === 'true';
    
    if (!themesEnabled) {
      // Forcer le thème par défaut si les thèmes sont désactivés
      setTheme(DEFAULT_SAFE_THEME);
      return;
    }

    // Vérifier si le thème actuel est sûr
    if (theme && !SAFE_THEMES.includes(theme as any)) {
      console.warn(`Thème non sécurisé détecté: ${theme}. Basculement vers ${DEFAULT_SAFE_THEME}`);
      setTheme(DEFAULT_SAFE_THEME);
      return;
    }

    // Panic button via URL
    const urlParams = new URLSearchParams(window.location.search);
    const panicTheme = urlParams.get('theme');
    
    if (panicTheme && SAFE_THEMES.includes(panicTheme as any)) {
      setTheme(panicTheme);
      // Nettoyer l'URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('theme');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [isClient, theme, setTheme]);

  // Afficher un indicateur de sécurité en développement
  if (process.env.NODE_ENV === 'development') {
    return (
      <div className="relative">
        {/* Indicateur de sécurité en développement */}
        <div className="fixed top-16 right-4 z-50 bg-base-100 border border-base-300 rounded-lg p-2 shadow-lg">
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${
              SAFE_THEMES.includes(resolvedTheme as any) ? 'bg-success' : 'bg-error'
            }`}></div>
            <span>Thème: {resolvedTheme}</span>
            {!SAFE_THEMES.includes(resolvedTheme as any) && (
              <button
                onClick={() => setTheme(DEFAULT_SAFE_THEME)}
                className="btn btn-xs btn-error"
              >
                Panic
              </button>
            )}
          </div>
        </div>
        {children}
      </div>
    );
  }

  return <>{children}</>;
}
