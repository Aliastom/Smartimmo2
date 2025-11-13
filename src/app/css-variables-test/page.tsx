'use client';

import React, { useState, useEffect } from 'react';

export default function CSSVariablesTestPage() {
  const [currentTheme, setCurrentTheme] = useState('smartimmo');
  const [cssVars, setCssVars] = useState<any>({});

  useEffect(() => {
    // Appliquer le thème manuellement
    document.documentElement.setAttribute('data-theme', currentTheme);
    
    // Récupérer les variables CSS
    const computedStyle = getComputedStyle(document.documentElement);
    const vars = {
      '--p': computedStyle.getPropertyValue('--p'),
      '--s': computedStyle.getPropertyValue('--s'),
      '--a': computedStyle.getPropertyValue('--a'),
      '--b1': computedStyle.getPropertyValue('--b1'),
      '--b2': computedStyle.getPropertyValue('--b2'),
      '--bc': computedStyle.getPropertyValue('--bc'),
    };
    setCssVars(vars);
  }, [currentTheme]);

  const themes = [
    { id: 'light', name: 'Light' },
    { id: 'dark', name: 'Dark' },
    { id: 'smartimmo', name: 'SmartImmo' },
    { id: 'smartimmo-warm', name: 'SmartImmo Warm' },
    { id: 'smartimmo-cool', name: 'SmartImmo Cool' },
  ];

  return (
    <div className="min-h-screen p-8 bg-base-100">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-base-content">
          Test Variables CSS - Thème: {currentTheme}
        </h1>

        {/* Boutons pour changer de thème */}
        <div className="flex gap-4 flex-wrap">
          {themes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => setCurrentTheme(theme.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                theme.id === currentTheme 
                  ? 'bg-primary text-primary-content' 
                  : 'bg-base-200 text-base-content'
              }`}
            >
              {theme.name}
            </button>
          ))}
        </div>

        {/* Test des variables CSS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="card bg-primary text-primary-content shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Primary</h3>
              <p>Variable: {cssVars['--p'] || 'non définie'}</p>
            </div>
          </div>
          
          <div className="card bg-secondary text-secondary-content shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Secondary</h3>
              <p>Variable: {cssVars['--s'] || 'non définie'}</p>
            </div>
          </div>
          
          <div className="card bg-accent text-accent-content shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Accent</h3>
              <p>Variable: {cssVars['--a'] || 'non définie'}</p>
            </div>
          </div>
          
          <div className="card bg-base-200 text-base-content shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Base-200</h3>
              <p>Variable: {cssVars['--b2'] || 'non définie'}</p>
            </div>
          </div>
          
          <div className="card bg-info text-info-content shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Info</h3>
              <p>Variable: {cssVars['--in'] || 'non définie'}</p>
            </div>
          </div>
          
          <div className="card bg-success text-success-content shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Success</h3>
              <p>Variable: {cssVars['--su'] || 'non définie'}</p>
            </div>
          </div>
        </div>

        {/* Debug info */}
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Debug Info</h2>
            <div className="space-y-2">
              <p><strong>Thème actuel:</strong> {currentTheme}</p>
              <p><strong>data-theme:</strong> {document.documentElement.getAttribute('data-theme')}</p>
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Variables CSS:</h3>
                <pre className="bg-base-300 p-3 rounded text-sm overflow-x-auto">
                  {JSON.stringify(cssVars, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

