'use client';

import React, { useState, useEffect } from 'react';

export default function ThemeManualTestPage() {
  const [currentTheme, setCurrentTheme] = useState('smartimmo');

  useEffect(() => {
    // Appliquer le thème manuellement
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  const themes = [
    { id: 'light', name: 'Light', color: '#ffffff' },
    { id: 'dark', name: 'Dark', color: '#1f2937' },
    { id: 'smartimmo', name: 'SmartImmo', color: '#1d4ed8' },
    { id: 'smartimmo-warm', name: 'SmartImmo Warm', color: '#ff6b35' },
    { id: 'smartimmo-cool', name: 'SmartImmo Cool', color: '#1565c0' },
  ];

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: 'var(--fallback-b1, oklch(var(--b1)))' }}>
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold" style={{ color: 'var(--fallback-bc, oklch(var(--bc)))' }}>
          Test Manuel des Thèmes - Thème: {currentTheme}
        </h1>

        {/* Boutons pour changer de thème */}
        <div className="flex gap-4 flex-wrap">
          {themes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => setCurrentTheme(theme.id)}
              className="px-4 py-2 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: theme.id === currentTheme ? theme.color : '#e5e7eb',
                color: theme.id === currentTheme ? '#ffffff' : '#374151',
              }}
            >
              {theme.name}
            </button>
          ))}
        </div>

        {/* Test des couleurs avec variables CSS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div 
            className="p-6 rounded-lg shadow-lg"
            style={{ backgroundColor: 'var(--fallback-p, oklch(var(--p)))', color: 'var(--fallback-pc, oklch(var(--pc)))' }}
          >
            <h3 className="text-lg font-semibold mb-2">Primary</h3>
            <p>Variable CSS: --p</p>
          </div>
          
          <div 
            className="p-6 rounded-lg shadow-lg"
            style={{ backgroundColor: 'var(--fallback-s, oklch(var(--s)))', color: 'var(--fallback-sc, oklch(var(--sc)))' }}
          >
            <h3 className="text-lg font-semibold mb-2">Secondary</h3>
            <p>Variable CSS: --s</p>
          </div>
          
          <div 
            className="p-6 rounded-lg shadow-lg"
            style={{ backgroundColor: 'var(--fallback-a, oklch(var(--a)))', color: 'var(--fallback-ac, oklch(var(--ac)))' }}
          >
            <h3 className="text-lg font-semibold mb-2">Accent</h3>
            <p>Variable CSS: --a</p>
          </div>
          
          <div 
            className="p-6 rounded-lg shadow-lg"
            style={{ backgroundColor: 'var(--fallback-b2, oklch(var(--b2)))', color: 'var(--fallback-bc, oklch(var(--bc)))' }}
          >
            <h3 className="text-lg font-semibold mb-2">Base-200</h3>
            <p>Variable CSS: --b2</p>
          </div>
        </div>

        {/* Test avec classes daisyUI */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--fallback-bc, oklch(var(--bc)))' }}>
            Test avec classes daisyUI
          </h2>
          
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

        {/* Debug info */}
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Debug Info</h2>
            <div className="space-y-2">
              <p><strong>Thème actuel:</strong> {currentTheme}</p>
              <p><strong>data-theme:</strong> {document.documentElement.getAttribute('data-theme')}</p>
              <p><strong>Body class:</strong> {document.body.className}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

