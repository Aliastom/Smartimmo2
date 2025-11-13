'use client';

import React from 'react';

export default function AnimationsTestPage() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="hero bg-gradient-to-r from-primary to-secondary text-primary-content rounded-lg">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <h1 className="text-5xl font-bold">Micro-animations</h1>
            <p className="py-6">
              Testez toutes les animations cohérentes de SmartImmo
            </p>
          </div>
        </div>
      </div>

      {/* Cards avec animations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card Interactive */}
        <div className="card bg-base-100 shadow-xl card-interactive">
          <div className="card-body">
            <h2 className="card-title">Card Interactive</h2>
            <p>Hover-float + hover-glow + press</p>
            <div className="card-actions justify-end">
              <button className="btn btn-primary btn-primary-animated">Bouton animé</button>
            </div>
          </div>
        </div>

        {/* Card avec hover-pop */}
        <div className="card bg-base-100 shadow-xl hover-pop press">
          <div className="card-body">
            <h2 className="card-title">Hover Pop</h2>
            <p>Légère mise à l'échelle au survol</p>
            <div className="card-actions justify-end">
              <button className="btn btn-secondary hover-pop press">Test</button>
            </div>
          </div>
        </div>

        {/* Card avec hover-float */}
        <div className="card bg-base-100 shadow-xl hover-float press">
          <div className="card-body">
            <h2 className="card-title">Hover Float</h2>
            <p>Légère élévation au survol</p>
            <div className="card-actions justify-end">
              <button className="btn btn-accent hover-bounce press">Bounce</button>
            </div>
          </div>
        </div>
      </div>

      {/* Boutons avec différentes animations */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title mb-4">Boutons animés</h2>
          
          <div className="flex flex-wrap gap-4">
            <button className="btn btn-primary btn-primary-animated">
              Hover Pop + Press
            </button>
            
            <button className="btn btn-secondary hover-bounce press">
              Hover Bounce
            </button>
            
            <button className="btn btn-accent hover-scale press">
              Hover Scale
            </button>
            
            <button className="btn btn-info hover-glow press">
              Hover Glow
            </button>
            
            <button className="btn btn-warning hover-slide press">
              Hover Slide
            </button>
            
            <button className="btn btn-error hover-rotate press">
              Hover Rotate
            </button>
          </div>
        </div>
      </div>

      {/* Badges animés */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title mb-4">Badges animés</h2>
          
          <div className="flex flex-wrap gap-4">
            <div className="badge badge-primary badge-animated">Primary</div>
            <div className="badge badge-secondary badge-animated">Secondary</div>
            <div className="badge badge-accent badge-animated">Accent</div>
            <div className="badge badge-info badge-animated">Info</div>
            <div className="badge badge-success badge-animated">Success</div>
            <div className="badge badge-warning badge-animated">Warning</div>
            <div className="badge badge-error badge-animated">Error</div>
          </div>
        </div>
      </div>

      {/* Icônes animées */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title mb-4">Icônes animées</h2>
          
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center icon-animated">
                <svg className="w-6 h-6 text-primary-content" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-sm">Hover Rotate</span>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center hover-bounce">
                <svg className="w-6 h-6 text-secondary-content" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-sm">Hover Bounce</span>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center hover-scale">
                <svg className="w-6 h-6 text-accent-content" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <span className="text-sm">Hover Scale</span>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-info rounded-full flex items-center justify-center hover-glow">
                <svg className="w-6 h-6 text-info-content" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <span className="text-sm">Hover Glow</span>
            </div>
          </div>
        </div>
      </div>

      {/* Animations continues */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title mb-4">Animations continues</h2>
          
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-success rounded-full flex items-center justify-center pulse-gentle">
                <svg className="w-6 h-6 text-success-content" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-sm">Pulse Gentle</span>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-warning rounded-full flex items-center justify-center spin-slow">
                <svg className="w-6 h-6 text-warning-content" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <span className="text-sm">Spin Slow</span>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-error rounded-full flex items-center justify-center wiggle">
                <svg className="w-6 h-6 text-error-content" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <span className="text-sm">Wiggle</span>
            </div>
          </div>
        </div>
      </div>

      {/* Liens animés */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title mb-4">Liens animés</h2>
          
          <div className="space-y-2">
            <a href="#" className="link link-primary link-animated block">
              Lien avec hover-scale et press
            </a>
            <a href="#" className="link link-secondary hover-slide block">
              Lien avec hover-slide
            </a>
            <a href="#" className="link link-accent hover-bounce block">
              Lien avec hover-bounce
            </a>
            <a href="#" className="link link-info hover-glow block">
              Lien avec hover-glow
            </a>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="alert alert-info">
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <h3 className="font-bold">Instructions de test</h3>
          <div className="text-xs">
            <p>• <strong>Hover :</strong> Survolez les éléments pour voir les animations</p>
            <p>• <strong>Press :</strong> Cliquez pour voir l'effet de compression</p>
            <p>• <strong>Durées :</strong> 150-200ms pour les transitions</p>
            <p>• <strong>Easing :</strong> ease-out pour des animations naturelles</p>
            <p>• <strong>Classes :</strong> Utilisez les classes utilitaires dans vos composants</p>
          </div>
        </div>
      </div>

      {/* Classes disponibles */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title mb-4">Classes disponibles</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2 text-primary">🎯 Animations de base</h3>
              <ul className="text-sm space-y-1 font-mono">
                <li>• <code>.hover-float</code> - Élévation au survol</li>
                <li>• <code>.hover-pop</code> - Mise à l'échelle au survol</li>
                <li>• <code>.press</code> - Compression au clic</li>
                <li>• <code>.hover-glow</code> - Lueur au survol</li>
                <li>• <code>.hover-bounce</code> - Rebond au survol</li>
                <li>• <code>.hover-slide</code> - Glissement horizontal</li>
                <li>• <code>.hover-rotate</code> - Rotation au survol</li>
                <li>• <code>.hover-scale</code> - Mise à l'échelle</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2 text-secondary">🎨 Classes composées</h3>
              <ul className="text-sm space-y-1 font-mono">
                <li>• <code>.card-interactive</code> - Card complète</li>
                <li>• <code>.btn-primary-animated</code> - Bouton primaire</li>
                <li>• <code>.menu-item-animated</code> - Item de menu</li>
                <li>• <code>.badge-animated</code> - Badge</li>
                <li>• <code>.icon-animated</code> - Icône</li>
                <li>• <code>.link-animated</code> - Lien</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2 text-accent">⚡ Animations continues</h3>
              <ul className="text-sm space-y-1 font-mono">
                <li>• <code>.pulse-gentle</code> - Pulsation douce</li>
                <li>• <code>.spin-slow</code> - Rotation lente</li>
                <li>• <code>.wiggle</code> - Oscillation</li>
                <li>• <code>.fade-in</code> - Apparition en fondu</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2 text-info">📏 Spécifications</h3>
              <ul className="text-sm space-y-1">
                <li>• <strong>Durée :</strong> 150-200ms</li>
                <li>• <strong>Easing :</strong> ease-out</li>
                <li>• <strong>Transform :</strong> translate, scale, rotate</li>
                <li>• <strong>Shadow :</strong> glow effects</li>
                <li>• <strong>Performance :</strong> CSS natif</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
