'use client';

import React from 'react';

export default function NavigationDemoPage() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="hero bg-gradient-to-r from-primary to-secondary text-primary-content rounded-lg">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <h1 className="text-5xl font-bold">Navigation Moderne</h1>
            <p className="py-6">
              Découvrez la nouvelle navigation avec navbar sticky et drawer daisyUI
            </p>
            <button className="btn btn-accent btn-primary-animated">Commencer</button>
          </div>
        </div>
      </div>

      {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card bg-base-100 shadow-xl card-interactive">
          <div className="card-body text-center">
            <div className="mx-auto w-12 h-12 bg-primary rounded-full flex items-center justify-center mb-4 icon-animated">
              <svg className="w-6 h-6 text-primary-content" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="card-title justify-center">Navbar Sticky</h3>
            <p className="text-sm opacity-70">Restez connecté avec la navbar toujours visible</p>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl hover-pop press">
          <div className="card-body text-center">
            <div className="mx-auto w-12 h-12 bg-secondary rounded-full flex items-center justify-center mb-4 hover-bounce">
              <svg className="w-6 h-6 text-secondary-content" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </div>
            <h3 className="card-title justify-center">Drawer Mobile</h3>
            <p className="text-sm opacity-70">Navigation intuitive sur mobile et tablet</p>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl hover-float press">
          <div className="card-body text-center">
            <div className="mx-auto w-12 h-12 bg-accent rounded-full flex items-center justify-center mb-4 hover-scale">
              <svg className="w-6 h-6 text-accent-content" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="card-title justify-center">Sidebar Desktop</h3>
            <p className="text-sm opacity-70">Navigation permanente sur les grands écrans</p>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl hover-glow press">
          <div className="card-body text-center">
            <div className="mx-auto w-12 h-12 bg-info rounded-full flex items-center justify-center mb-4 hover-rotate">
              <svg className="w-6 h-6 text-info-content" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="card-title justify-center">Theme Switcher</h3>
            <p className="text-sm opacity-70">Changez de thème en un clic</p>
          </div>
        </div>
      </div>

      {/* Interactive Demo */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Démonstration Interactive</h2>
          
          <div className="space-y-4">
            <div className="alert alert-info">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-bold">Testez la navigation !</h3>
                <p>Utilisez les éléments de navigation pour explorer les fonctionnalités</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="font-semibold">📱 Sur Mobile/Tablet :</h3>
                <ul className="text-sm space-y-1">
                  <li>• Cliquez sur ☰ (burger menu)</li>
                  <li>• Le drawer s'ouvre avec les liens</li>
                  <li>• Navigation fluide avec animations</li>
                  <li>• Fermeture par clic extérieur</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">🖥️ Sur Desktop (xl+) :</h3>
                <ul className="text-sm space-y-1">
                  <li>• Sidebar fixe toujours visible</li>
                  <li>• Navigation directe sans drawer</li>
                  <li>• États actifs mis en évidence</li>
                  <li>• Effets hover sur les liens</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats shadow w-full">
        <div className="stat">
          <div className="stat-figure text-primary">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="stat-title">Performance</div>
          <div className="stat-value text-primary">100%</div>
          <div className="stat-desc">Optimisé avec daisyUI</div>
        </div>

        <div className="stat">
          <div className="stat-figure text-secondary">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="stat-title">Responsive</div>
          <div className="stat-value text-secondary">4</div>
          <div className="stat-desc">Breakpoints supportés</div>
        </div>

        <div className="stat">
          <div className="stat-figure text-accent">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <div className="stat-title">Accessibilité</div>
          <div className="stat-value text-accent">A+</div>
          <div className="stat-desc">WCAG 2.1 conforme</div>
        </div>
      </div>

      {/* Contenu pour tester le scroll */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Testez le scroll sticky</h2>
        <p className="text-base-content opacity-70">
          Faites défiler cette page pour voir la navbar rester fixe en haut. 
          La navigation moderne s'adapte parfaitement à tous les écrans.
        </p>

        {Array.from({ length: 15 }, (_, i) => (
          <div key={i} className="card bg-base-100 shadow">
            <div className="card-body">
              <h3 className="card-title">Section {i + 1}</h3>
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod 
                tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, 
                quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </p>
              <div className="card-actions justify-end">
                <button className="btn btn-sm btn-primary">Action {i + 1}</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
