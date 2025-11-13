'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';

export default function DebugThemePage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [cssVars, setCssVars] = useState<any>({});

  useEffect(() => {
    setMounted(true);
    
    // Récupérer les variables CSS
            const updateCssVars = () => {
              const computedStyle = getComputedStyle(document.documentElement);
              const vars = {
                'data-theme': document.documentElement.getAttribute('data-theme'),
                '--b1': computedStyle.getPropertyValue('--b1'),
                '--b2': computedStyle.getPropertyValue('--b2'),
                '--b3': computedStyle.getPropertyValue('--b3'),
                '--p': computedStyle.getPropertyValue('--p'),
                '--pc': computedStyle.getPropertyValue('--pc'),
                '--s': computedStyle.getPropertyValue('--s'),
                '--sc': computedStyle.getPropertyValue('--sc'),
                '--a': computedStyle.getPropertyValue('--a'),
                '--ac': computedStyle.getPropertyValue('--ac'),
                '--bc': computedStyle.getPropertyValue('--bc'),
                '--in': computedStyle.getPropertyValue('--in'),
                '--su': computedStyle.getPropertyValue('--su'),
                '--wa': computedStyle.getPropertyValue('--wa'),
                '--er': computedStyle.getPropertyValue('--er'),
              };
              setCssVars(vars);
            };

    updateCssVars();
    const interval = setInterval(updateCssVars, 1000);
    
    return () => clearInterval(interval);
  }, [theme]);

  if (!mounted) {
    return <div>Chargement...</div>;
  }

  const themes = [
    { id: 'light', name: 'Light' },
    { id: 'dark', name: 'Dark' },
    { id: 'smartimmo', name: 'SmartImmo' },
    { id: 'smartimmo-warm', name: 'SmartImmo Warm' },
    { id: 'smartimmo-cool', name: 'SmartImmo Cool' },
    { id: 'corporate', name: 'Corporate' },
  ];

  return (
    <div className="min-h-screen p-8 bg-base-100 text-base-content">
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-base-content">
          Debug Theme - Thème: {theme}
        </h1>

        {/* Boutons pour changer de thème */}
        <div className="flex gap-4 flex-wrap">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                t.id === theme 
                  ? 'bg-primary text-primary-content' 
                  : 'bg-base-200 text-base-content'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* Debug info */}
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Debug Info</h2>
            <div className="space-y-4">
              <div>
                <strong>Theme actuel:</strong> {theme}
              </div>
              <div>
                <strong>data-theme:</strong> {cssVars['data-theme'] || 'undefined'}
              </div>
              <div>
                <strong>--b1 (base-100):</strong> {cssVars['--b1'] || 'undefined'}
              </div>
              <div>
                <strong>document.documentElement.outerHTML.slice(0,200):</strong>
                <pre className="bg-base-300 p-3 rounded text-sm overflow-x-auto mt-2">
                  {document.documentElement.outerHTML.slice(0, 200)}
                </pre>
              </div>
              <div>
                <strong>Toutes les variables CSS:</strong>
                <pre className="bg-base-300 p-3 rounded text-sm overflow-x-auto mt-2">
                  {JSON.stringify(cssVars, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Test des blocs colorés */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div className="card bg-primary text-primary-content shadow-xl">
                    <div className="card-body p-4">
                      <h3 className="text-sm font-bold">Primary</h3>
                      <p className="text-xs">{cssVars['--p'] || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div className="card bg-secondary text-secondary-content shadow-xl">
                    <div className="card-body p-4">
                      <h3 className="text-sm font-bold">Secondary</h3>
                      <p className="text-xs">{cssVars['--s'] || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div className="card bg-accent text-accent-content shadow-xl">
                    <div className="card-body p-4">
                      <h3 className="text-sm font-bold">Accent</h3>
                      <p className="text-xs">{cssVars['--a'] || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="card bg-base-200 text-base-content shadow-xl">
                    <div className="card-body p-4">
                      <h3 className="text-sm font-bold">Base-200</h3>
                      <p className="text-xs">{cssVars['--b2'] || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="card bg-info text-info-content shadow-xl">
                    <div className="card-body p-4">
                      <h3 className="text-sm font-bold">Info</h3>
                      <p className="text-xs">{cssVars['--in'] || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="card bg-success text-success-content shadow-xl">
                    <div className="card-body p-4">
                      <h3 className="text-sm font-bold">Success</h3>
                      <p className="text-xs">{cssVars['--su'] || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="card bg-warning text-warning-content shadow-xl">
                    <div className="card-body p-4">
                      <h3 className="text-sm font-bold">Warning</h3>
                      <p className="text-xs">{cssVars['--wa'] || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="card bg-error text-error-content shadow-xl">
                    <div className="card-body p-4">
                      <h3 className="text-sm font-bold">Error</h3>
                      <p className="text-xs">{cssVars['--er'] || 'N/A'}</p>
                    </div>
                  </div>
        </div>

        {/* Test des alertes */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-base-content">Alertes</h2>
          <div className="alert alert-info">
            <span>Info Alert - Devrait changer selon le thème</span>
          </div>
          <div className="alert alert-success">
            <span>Success Alert - Devrait changer selon le thème</span>
          </div>
          <div className="alert alert-warning">
            <span>Warning Alert - Devrait changer selon le thème</span>
          </div>
          <div className="alert alert-error">
            <span>Error Alert - Devrait changer selon le thème</span>
          </div>
        </div>
      </div>
    </div>
  );
}
