'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';

export default function DaisyUITestPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold">
          Test DaisyUI - Thème: {theme}
        </h1>

        {/* Test des thèmes daisyUI standards */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Thèmes daisyUI standards</h2>
          <div className="flex gap-4">
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
              onClick={() => setTheme('corporate')}
              className="btn btn-accent"
            >
              Corporate
            </button>
          </div>
        </div>

        {/* Test des thèmes SmartImmo */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Thèmes SmartImmo</h2>
          <div className="flex gap-4">
            <button 
              onClick={() => setTheme('smartimmo')}
              className="btn btn-primary"
            >
              SmartImmo
            </button>
            <button 
              onClick={() => setTheme('smartimmo-warm')}
              className="btn btn-secondary"
            >
              SmartImmo Warm
            </button>
            <button 
              onClick={() => setTheme('smartimmo-cool')}
              className="btn btn-accent"
            >
              SmartImmo Cool
            </button>
          </div>
        </div>

        {/* Test des composants daisyUI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card bg-primary text-primary-content shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Card Primary</h2>
              <p>Cette carte devrait changer de couleur selon le thème</p>
              <div className="card-actions justify-end">
                <button className="btn btn-primary-content">Action</button>
              </div>
            </div>
          </div>

          <div className="card bg-secondary text-secondary-content shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Card Secondary</h2>
              <p>Cette carte devrait changer de couleur selon le thème</p>
              <div className="card-actions justify-end">
                <button className="btn btn-secondary-content">Action</button>
              </div>
            </div>
          </div>

          <div className="card bg-accent text-accent-content shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Card Accent</h2>
              <p>Cette carte devrait changer de couleur selon le thème</p>
              <div className="card-actions justify-end">
                <button className="btn btn-accent-content">Action</button>
              </div>
            </div>
          </div>
        </div>

        {/* Test des alertes */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Alertes</h2>
          <div className="alert alert-info">
            <span>Info - Cette alerte devrait changer selon le thème</span>
          </div>
          <div className="alert alert-success">
            <span>Success - Cette alerte devrait changer selon le thème</span>
          </div>
          <div className="alert alert-warning">
            <span>Warning - Cette alerte devrait changer selon le thème</span>
          </div>
          <div className="alert alert-error">
            <span>Error - Cette alerte devrait changer selon le thème</span>
          </div>
        </div>

        {/* Debug info */}
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Debug Info</h2>
            <div className="space-y-2">
              <p><strong>Theme actuel:</strong> {theme}</p>
              <p><strong>data-theme:</strong> <span id="debug-data-theme">-</span></p>
              <p><strong>Body class:</strong> <span id="debug-body-class">-</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Script de debug */}
      <script dangerouslySetInnerHTML={{
        __html: `
          function updateDebug() {
            const dataTheme = document.documentElement.getAttribute('data-theme');
            const bodyClass = document.body.className;
            document.getElementById('debug-data-theme').textContent = dataTheme || 'undefined';
            document.getElementById('debug-body-class').textContent = bodyClass || 'undefined';
          }
          updateDebug();
          setInterval(updateDebug, 1000);
        `
      }} />
    </div>
  );
}

