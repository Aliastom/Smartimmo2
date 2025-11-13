'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';

export default function DaisyUISimpleTestPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="min-h-screen p-8 bg-base-100">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-base-content">
          Test DaisyUI Simple - Thème: {theme}
        </h1>

        {/* Test des boutons */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-base-content">Boutons</h2>
          <div className="flex gap-4 flex-wrap">
            <button 
              onClick={() => setTheme('light')}
              className="btn btn-primary"
            >
              Light
            </button>
            <button 
              onClick={() => setTheme('dark')}
              className="btn btn-secondary"
            >
              Dark
            </button>
            <button 
              onClick={() => setTheme('smartimmo')}
              className="btn btn-accent"
            >
              SmartImmo
            </button>
            <button 
              onClick={() => setTheme('smartimmo-warm')}
              className="btn btn-info"
            >
              Warm
            </button>
            <button 
              onClick={() => setTheme('smartimmo-cool')}
              className="btn btn-success"
            >
              Cool
            </button>
          </div>
        </div>

        {/* Test des cartes */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-base-content">Cartes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card bg-primary text-primary-content shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Primary</h2>
                <p>Cette carte devrait être bleue en SmartImmo</p>
              </div>
            </div>
            
            <div className="card bg-secondary text-secondary-content shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Secondary</h2>
                <p>Cette carte devrait être grise en SmartImmo</p>
              </div>
            </div>
            
            <div className="card bg-accent text-accent-content shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Accent</h2>
                <p>Cette carte devrait être verte en SmartImmo</p>
              </div>
            </div>
            
            <div className="card bg-base-200 text-base-content shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Base</h2>
                <p>Cette carte utilise les couleurs de base</p>
              </div>
            </div>
          </div>
        </div>

        {/* Test des alertes */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-base-content">Alertes</h2>
          <div className="alert alert-info">
            <span>Info - Devrait être bleue</span>
          </div>
          <div className="alert alert-success">
            <span>Success - Devrait être verte</span>
          </div>
          <div className="alert alert-warning">
            <span>Warning - Devrait être orange</span>
          </div>
          <div className="alert alert-error">
            <span>Error - Devrait être rouge</span>
          </div>
        </div>

        {/* Debug */}
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Debug</h2>
            <div className="space-y-2 text-base-content">
              <p><strong>Theme actuel:</strong> {theme}</p>
              <p><strong>data-theme:</strong> <span id="debug-data-theme">-</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Script de debug */}
      <script dangerouslySetInnerHTML={{
        __html: `
          function updateDebug() {
            const dataTheme = document.documentElement.getAttribute('data-theme');
            document.getElementById('debug-data-theme').textContent = dataTheme || 'undefined';
          }
          updateDebug();
          setInterval(updateDebug, 1000);
        `
      }} />
    </div>
  );
}

