'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';

export default function ThemeDebugPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [themeInfo, setThemeInfo] = useState({
    dataTheme: 'non défini',
    roundedBtn: 'non défini',
    roundedBox: 'non défini',
    shadow: 'non défini'
  });

  // Éviter l'erreur d'hydratation
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const updateThemeInfo = () => {
      const dataTheme = document.documentElement.getAttribute('data-theme');
      const computedStyle = getComputedStyle(document.documentElement);
      
      setThemeInfo({
        dataTheme: dataTheme || 'non défini',
        roundedBtn: computedStyle.getPropertyValue('--rounded-btn') || 'non défini',
        roundedBox: computedStyle.getPropertyValue('--rounded-box') || 'non défini',
        shadow: computedStyle.getPropertyValue('--shadow') || 'non défini'
      });
    };

    updateThemeInfo();
    const interval = setInterval(updateThemeInfo, 1000);
    
    return () => clearInterval(interval);
  }, [theme, mounted]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-base-100 p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <h1 className="text-4xl font-bold text-base-content">
            Debug des Thèmes - Chargement...
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-base-content">
          Debug des Thèmes - Thème actuel: {theme}
        </h1>

        {/* Theme Switcher */}
        <div className="card bg-base-200 shadow-lg">
          <div className="card-body">
            <h2 className="card-title">Changer de thème</h2>
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
        </div>

        {/* Test des couleurs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Primary */}
          <div className="card bg-primary text-primary-content shadow-lg">
            <div className="card-body">
              <h3 className="card-title">Primary</h3>
              <p>Couleur principale du thème</p>
              <button className="btn btn-primary-content">Bouton Primary</button>
            </div>
          </div>

          {/* Secondary */}
          <div className="card bg-secondary text-secondary-content shadow-lg">
            <div className="card-body">
              <h3 className="card-title">Secondary</h3>
              <p>Couleur secondaire du thème</p>
              <button className="btn btn-secondary-content">Bouton Secondary</button>
            </div>
          </div>

          {/* Accent */}
          <div className="card bg-accent text-accent-content shadow-lg">
            <div className="card-body">
              <h3 className="card-title">Accent</h3>
              <p>Couleur d'accent du thème</p>
              <button className="btn btn-accent-content">Bouton Accent</button>
            </div>
          </div>
        </div>

        {/* Test des couleurs de statut */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card bg-info text-info-content shadow-lg">
            <div className="card-body text-center">
              <h4>Info</h4>
            </div>
          </div>
          <div className="card bg-success text-success-content shadow-lg">
            <div className="card-body text-center">
              <h4>Success</h4>
            </div>
          </div>
          <div className="card bg-warning text-warning-content shadow-lg">
            <div className="card-body text-center">
              <h4>Warning</h4>
            </div>
          </div>
          <div className="card bg-error text-error-content shadow-lg">
            <div className="card-body text-center">
              <h4>Error</h4>
            </div>
          </div>
        </div>

        {/* Test des boutons */}
        <div className="card bg-base-100 shadow-lg">
          <div className="card-body">
            <h3 className="card-title">Boutons</h3>
            <div className="flex flex-wrap gap-4">
              <button className="btn btn-primary">Primary</button>
              <button className="btn btn-secondary">Secondary</button>
              <button className="btn btn-accent">Accent</button>
              <button className="btn btn-info">Info</button>
              <button className="btn btn-success">Success</button>
              <button className="btn btn-warning">Warning</button>
              <button className="btn btn-error">Error</button>
            </div>
          </div>
        </div>

        {/* Informations sur le thème actuel */}
        <div className="card bg-base-200 shadow-lg">
          <div className="card-body">
            <h3 className="card-title">Informations du thème</h3>
            <div className="space-y-2">
              <p><strong>Thème actuel :</strong> {theme}</p>
              <p><strong>data-theme :</strong> {themeInfo.dataTheme}</p>
              <p><strong>CSS Variables :</strong></p>
              <ul className="list-disc list-inside ml-4">
                <li>--rounded-btn: {themeInfo.roundedBtn}</li>
                <li>--rounded-box: {themeInfo.roundedBox}</li>
                <li>--shadow: {themeInfo.shadow}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
