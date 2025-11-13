'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { ThemeSwitcher } from '@/ui/components/ThemeSwitcher';

export default function ThemePersistenceTestPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-base-100 p-8">
      <div className="container mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-base-content">
          Test de persistance des thèmes
        </h1>
        
        <div className="card bg-base-200 p-6">
          <h2 className="text-xl font-semibold mb-4">Informations sur le thème actuel</h2>
          <div className="space-y-2">
            <p><strong>Thème actuel :</strong> <span className="badge badge-primary">{theme}</span></p>
            <p><strong>localStorage theme :</strong> <span className="badge badge-secondary">{typeof window !== 'undefined' ? localStorage.getItem('theme') || 'none' : 'SSR'}</span></p>
          </div>
        </div>

        <div className="card bg-base-200 p-6">
          <h2 className="text-xl font-semibold mb-4">ThemeSwitcher</h2>
          <p className="mb-4">Utilisez le ThemeSwitcher ci-dessous pour changer de thème :</p>
          <ThemeSwitcher />
        </div>

        <div className="card bg-base-200 p-6">
          <h2 className="text-xl font-semibold mb-4">Instructions de test</h2>
          <div className="space-y-4">
            <div className="alert alert-info">
              <span>1. Changez de thème avec le ThemeSwitcher</span>
            </div>
            <div className="alert alert-info">
              <span>2. Rafraîchissez la page (F5)</span>
            </div>
            <div className="alert alert-info">
              <span>3. Le thème devrait être conservé</span>
            </div>
            <div className="alert alert-info">
              <span>4. Vérifiez que localStorage contient le bon thème</span>
            </div>
          </div>
        </div>

        <div className="card bg-base-200 p-6">
          <h2 className="text-xl font-semibold mb-4">Composants daisyUI</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <button className="btn btn-primary">Primary</button>
              <button className="btn btn-secondary">Secondary</button>
              <button className="btn btn-accent">Accent</button>
              <button className="btn btn-neutral">Neutral</button>
            </div>
            
            <div className="flex gap-4">
              <div className="badge badge-primary">Primary</div>
              <div className="badge badge-secondary">Secondary</div>
              <div className="badge badge-success">Success</div>
              <div className="badge badge-warning">Warning</div>
              <div className="badge badge-error">Error</div>
              <div className="badge badge-info">Info</div>
            </div>

            <div className="alert alert-success">
              <span>Ceci est une alerte de succès</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
