'use client';

import React from 'react';

export default function TestTopbarPage() {
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Test Topbar & Layout</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Test des éléments de la topbar */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Éléments Topbar</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="badge badge-primary">✅</div>
                <span>Branding "SmartImmo" à gauche</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="badge badge-primary">✅</div>
                <span>Barre de recherche au centre</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="badge badge-primary">✅</div>
                <span>Notifications (cloche) à droite</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="badge badge-primary">✅</div>
                <span>Sélecteur de thème à droite</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="badge badge-primary">✅</div>
                <span>Menu utilisateur à droite</span>
              </div>
            </div>
          </div>
        </div>

        {/* Test de la sidebar */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Sidebar</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="badge badge-success">✅</div>
                <span>Pas de branding "SmartImmo"</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="badge badge-success">✅</div>
                <span>Tous les éléments du menu visibles</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="badge badge-success">✅</div>
                <span>Position sticky top-14</span>
              </div>
            </div>
          </div>
        </div>

        {/* Test du contenu */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Contenu Principal</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="badge badge-success">✅</div>
                <span>Pas de barre horizontale parasite</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="badge badge-success">✅</div>
                <span>Pas de chevauchement avec la topbar</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="badge badge-success">✅</div>
                <span>Espace optimal disponible</span>
              </div>
            </div>
          </div>
        </div>

        {/* Test responsive */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Responsive Design</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="badge badge-info">📱</div>
                <span>Mobile : Drawer + Topbar</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="badge badge-info">💻</div>
                <span>Desktop : Sidebar + Topbar</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="badge badge-success">✅</div>
                <span>Actions accessibles sur tous les écrans</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions de test */}
      <div className="alert alert-info">
        <div>
          <h3 className="font-bold">Instructions de Test</h3>
          <div className="text-sm mt-2 space-y-1">
            <p>1. Vérifiez que la topbar contient tous les éléments à droite</p>
            <p>2. Vérifiez qu'il n'y a plus de barre horizontale dans le contenu</p>
            <p>3. Testez le scroll : la topbar doit rester visible</p>
            <p>4. Testez responsive : les actions doivent rester accessibles</p>
            <p>5. Testez les thèmes : tout doit s'adapter correctement</p>
          </div>
        </div>
      </div>

      {/* Test des thèmes */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Test des Thèmes</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            <div className="p-4 bg-base-200 rounded-lg">
              <h3 className="font-semibold">SmartImmo</h3>
              <p className="text-sm text-base-content opacity-70">Thème principal</p>
            </div>
            <div className="p-4 bg-base-200 rounded-lg">
              <h3 className="font-semibold">SmartImmo Warm</h3>
              <p className="text-sm text-base-content opacity-70">Thème chaud</p>
            </div>
            <div className="p-4 bg-base-200 rounded-lg">
              <h3 className="font-semibold">SmartImmo Cool</h3>
              <p className="text-sm text-base-content opacity-70">Thème froid</p>
            </div>
            <div className="p-4 bg-base-200 rounded-lg">
              <h3 className="font-semibold">Light</h3>
              <p className="text-sm text-base-content opacity-70">Thème clair</p>
            </div>
            <div className="p-4 bg-base-200 rounded-lg">
              <h3 className="font-semibold">Dark</h3>
              <p className="text-sm text-base-content opacity-70">Thème sombre</p>
            </div>
            <div className="p-4 bg-base-200 rounded-lg">
              <h3 className="font-semibold">Corporate</h3>
              <p className="text-sm text-base-content opacity-70">Thème professionnel</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
