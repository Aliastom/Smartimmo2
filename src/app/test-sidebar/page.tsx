'use client';

import React from 'react';

export default function TestSidebarPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Sidebar</h1>
      
      <div className="space-y-4">
        <div className="alert alert-info">
          <span>Cette page teste la hauteur de la sidebar.</span>
        </div>
        
        <div className="bg-base-200 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Instructions de test :</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Vérifiez que la sidebar prend toute la hauteur de l'écran</li>
            <li>Vérifiez que tous les éléments du menu sont visibles</li>
            <li>Vérifiez qu'il n'y a pas de branding "SmartImmo" dans la sidebar</li>
            <li>Vérifiez que le branding "SmartImmo" est uniquement dans la topbar</li>
          </ul>
        </div>
        
        <div className="bg-base-100 p-4 rounded-lg border">
          <h2 className="font-semibold mb-2">Classes CSS appliquées :</h2>
          <code className="text-sm bg-base-300 p-2 rounded">
            aside.sidebar: height: 100vh !important; min-height: 100vh !important;
          </code>
        </div>
        
        <div className="bg-primary/10 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Si le problème persiste :</h2>
          <ol className="list-decimal list-inside space-y-1">
            <li>Videz le cache du navigateur (Ctrl+F5)</li>
            <li>Redémarrez le serveur de développement</li>
            <li>Vérifiez la console pour des erreurs CSS</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
