'use client';

import React from 'react';

export default function NavigationTestPage() {
  return (
    <div className="space-y-8">
      <div className="hero bg-base-200 rounded-lg">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <h1 className="text-5xl font-bold text-base-content">
              Navigation Test
            </h1>
            <p className="py-6 text-base-content opacity-70">
              Testez la nouvelle navigation moderne avec navbar sticky et drawer daisyUI.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Navbar Sticky</h2>
            <p>
              La navbar reste fixée en haut lors du scroll avec logo, recherche, 
              notifications, thème switcher et menu utilisateur.
            </p>
            <div className="card-actions justify-end">
              <button className="btn btn-primary">Test</button>
            </div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Drawer Mobile</h2>
            <p>
              Sur mobile et tablet, un drawer daisyUI s'ouvre avec tous les liens 
              de navigation, états actifs et icônes.
            </p>
            <div className="card-actions justify-end">
              <button className="btn btn-secondary">Test</button>
            </div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Sidebar Desktop</h2>
            <p>
              Sur les écrans xl+, une sidebar fixe remplace le drawer avec la même 
              navigation mais toujours visible.
            </p>
            <div className="card-actions justify-end">
              <button className="btn btn-accent">Test</button>
            </div>
          </div>
        </div>
      </div>

      {/* Fonctionnalités détaillées */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title mb-4">Fonctionnalités de la navigation</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3 text-primary">🎨 Design</h3>
              <ul className="space-y-2 text-sm">
                <li>• Navbar sticky avec daisyUI</li>
                <li>• Logo avec initiale stylisée</li>
                <li>• Barre de recherche responsive</li>
                <li>• Notifications avec badge</li>
                <li>• Theme switcher intégré</li>
                <li>• Menu utilisateur avec dropdown</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-3 text-secondary">📱 Responsive</h3>
              <ul className="space-y-2 text-sm">
                <li>• Burger menu sur mobile/tablet</li>
                <li>• Drawer daisyUI avec animations</li>
                <li>• Sidebar fixe sur xl+</li>
                <li>• Navigation adaptative</li>
                <li>• États actifs visuels</li>
                <li>• Effets hover et focus</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-3 text-accent">♿ Accessibilité</h3>
              <ul className="space-y-2 text-sm">
                <li>• ARIA labels appropriés</li>
                <li>• Focus management</li>
                <li>• Navigation au clavier</li>
                <li>• Contrastes respectés</li>
                <li>• Screen reader friendly</li>
                <li>• Transitions fluides</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-3 text-info">⚡ Performance</h3>
              <ul className="space-y-2 text-sm">
                <li>• Composants optimisés</li>
                <li>• Animations CSS natives</li>
                <li>• Lazy loading des icônes</li>
                <li>• Bundle size minimal</li>
                <li>• Rendu côté client</li>
                <li>• Cache des états</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions de test */}
      <div className="alert alert-info">
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <h3 className="font-bold">Instructions de test</h3>
          <div className="text-xs">
            <p>1. <strong>Mobile/Tablet:</strong> Cliquez sur le burger menu pour ouvrir le drawer</p>
            <p>2. <strong>Desktop:</strong> La sidebar est visible à gauche (écrans xl+)</p>
            <p>3. <strong>Navigation:</strong> Testez les liens et les états actifs</p>
            <p>4. <strong>Thème:</strong> Changez de thème avec le switcher dans la navbar</p>
            <p>5. <strong>Scroll:</strong> La navbar reste fixe lors du scroll</p>
          </div>
        </div>
      </div>

      {/* Contenu pour tester le scroll */}
      <div className="space-y-4">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title">Section {i + 1}</h2>
              <p>
                Contenu de test pour vérifier que la navbar reste sticky lors du scroll.
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod 
                tempor incididunt ut labore et dolore magna aliqua.
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
