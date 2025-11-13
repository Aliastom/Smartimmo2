'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';

export default function ThemeBasicTestPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-base-100 p-8">
        <div className="max-w-xl mx-auto">
          <h1 className="text-2xl font-bold text-base-content">Chargement...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100 p-8">
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-base-content">
          Test Thèmes - {theme}
        </h1>

        {/* Boutons */}
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={() => setTheme('smartimmo')}
            className={`btn btn-sm ${theme === 'smartimmo' ? 'btn-primary' : 'btn-outline'}`}
          >
            SmartImmo
          </button>
          <button 
            onClick={() => setTheme('smartimmo-warm')}
            className={`btn btn-sm ${theme === 'smartimmo-warm' ? 'btn-primary' : 'btn-outline'}`}
          >
            Warm
          </button>
          <button 
            onClick={() => setTheme('smartimmo-cool')}
            className={`btn btn-sm ${theme === 'smartimmo-cool' ? 'btn-primary' : 'btn-outline'}`}
          >
            Cool
          </button>
        </div>

        {/* Test visuel simple */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card bg-primary text-primary-content">
            <div className="card-body">
              <h3 className="card-title">Primary</h3>
            </div>
          </div>
          
          <div className="card bg-secondary text-secondary-content">
            <div className="card-body">
              <h3 className="card-title">Secondary</h3>
            </div>
          </div>
          
          <div className="card bg-accent text-accent-content">
            <div className="card-body">
              <h3 className="card-title">Accent</h3>
            </div>
          </div>
        </div>

        {/* Alertes */}
        <div className="space-y-2">
          <div className="alert alert-info">
            <span>Info</span>
          </div>
          <div className="alert alert-success">
            <span>Success</span>
          </div>
          <div className="alert alert-warning">
            <span>Warning</span>
          </div>
          <div className="alert alert-error">
            <span>Error</span>
          </div>
        </div>
      </div>
    </div>
  );
}

