'use client';

import React, { useState } from 'react';
import { AppModal } from '@/ui/shared/AppModal';

export default function ModalSimpleTestPage() {
  const [showModal1, setShowModal1] = useState(false);
  const [showModal2, setShowModal2] = useState(false);
  const [showModal3, setShowModal3] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });

  const handleSubmit = () => {
    console.log('Form submitted:', formData);
    setShowModal1(false);
    setFormData({ name: '', email: '' });
  };

  return (
    <div className="min-h-screen bg-base-100 p-8">
      <div className="container mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-base-content">
          Test simple des modales AppModal
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Modal basique */}
          <div className="card bg-base-200 p-6">
            <h2 className="card-title text-lg mb-4">Modal basique</h2>
            <p className="text-sm opacity-70 mb-4">
              Modal simple avec formulaire
            </p>
            <button 
              className="btn btn-primary"
              onClick={() => setShowModal1(true)}
            >
              Ouvrir modal basique
            </button>
          </div>

          {/* Modal de confirmation */}
          <div className="card bg-base-200 p-6">
            <h2 className="card-title text-lg mb-4">Modal de confirmation</h2>
            <p className="text-sm opacity-70 mb-4">
              Modal de confirmation simple
            </p>
            <button 
              className="btn btn-secondary"
              onClick={() => setShowModal2(true)}
            >
              Confirmer une action
            </button>
          </div>

          {/* Modal large */}
          <div className="card bg-base-200 p-6">
            <h2 className="card-title text-lg mb-4">Modal large</h2>
            <p className="text-sm opacity-70 mb-4">
              Modal avec taille xl
            </p>
            <button 
              className="btn btn-accent"
              onClick={() => setShowModal3(true)}
            >
              Ouvrir modal large
            </button>
          </div>
        </div>

        {/* Informations sur les fonctionnalités */}
        <div className="card bg-base-200 p-6">
          <h2 className="card-title text-lg mb-4">Fonctionnalités AppModal</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">🎨 Styles daisyUI</h3>
              <ul className="text-sm space-y-1 opacity-70">
                <li>• Classes daisyUI (modal, modal-box, btn)</li>
                <li>• Thèmes automatiques (base-100, primary, etc.)</li>
                <li>• Boutons avec variants (primary, secondary, ghost)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">✨ Transitions framer-motion</h3>
              <ul className="text-sm space-y-1 opacity-70">
                <li>• Fade in/out du backdrop</li>
                <li>• Scale + slide de la modal</li>
                <li>• Transitions fluides (0.2s)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">♿ Accessibilité</h3>
              <ul className="text-sm space-y-1 opacity-70">
                <li>• Fermeture par Escape</li>
                <li>• Fermeture par clic extérieur</li>
                <li>• Focus management</li>
                <li>• ARIA labels</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">📱 Responsive</h3>
              <ul className="text-sm space-y-1 opacity-70">
                <li>• Tailles adaptatives (sm à 7xl)</li>
                <li>• Scroll automatique</li>
                <li>• Mobile-friendly</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Modales */}
        
        {/* Modal basique */}
        <AppModal
          open={showModal1}
          onClose={() => setShowModal1(false)}
          title="Modal basique"
          size="md"
          primaryAction={{
            label: 'Enregistrer',
            onClick: handleSubmit,
            disabled: !formData.name || !formData.email,
          }}
          secondaryAction={{
            label: 'Annuler',
            onClick: () => setShowModal1(false),
            variant: 'outline',
          }}
        >
          <div className="space-y-4">
            <div>
              <label className="label">
                <span className="label-text">Nom *</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Votre nom"
              />
            </div>
            <div>
              <label className="label">
                <span className="label-text">Email *</span>
              </label>
              <input
                type="email"
                className="input input-bordered w-full"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="votre@email.com"
              />
            </div>
          </div>
        </AppModal>

        {/* Modal de confirmation */}
        <AppModal
          open={showModal2}
          onClose={() => setShowModal2(false)}
          title="Confirmer l'action"
          size="sm"
          primaryAction={{
            label: 'Confirmer',
            onClick: () => {
              console.log('Action confirmée !');
              setShowModal2(false);
            },
            variant: 'primary',
          }}
          secondaryAction={{
            label: 'Annuler',
            onClick: () => setShowModal2(false),
            variant: 'outline',
          }}
        >
          <div className="space-y-4">
            <p>Êtes-vous sûr de vouloir effectuer cette action ?</p>
            <div className="alert alert-warning">
              <span>Cette action est irréversible.</span>
            </div>
          </div>
        </AppModal>

        {/* Modal large */}
        <AppModal
          open={showModal3}
          onClose={() => setShowModal3(false)}
          title="Modal large"
          size="xl"
          primaryAction={{
            label: 'Fermer',
            onClick: () => setShowModal3(false),
          }}
        >
          <div className="space-y-4">
            <p>Ceci est une modal avec une taille xl pour démontrer la flexibilité des tailles.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card bg-base-100 p-4">
                <h3 className="font-semibold mb-2">Colonne 1</h3>
                <p className="text-sm opacity-70">
                  Contenu de la première colonne avec du texte pour tester le scroll et la largeur.
                </p>
              </div>
              <div className="card bg-base-100 p-4">
                <h3 className="font-semibold mb-2">Colonne 2</h3>
                <p className="text-sm opacity-70">
                  Contenu de la deuxième colonne pour démontrer la mise en page.
                </p>
              </div>
            </div>
            <div className="h-32 bg-base-200 rounded flex items-center justify-center">
              <p className="text-sm opacity-70">Zone de contenu supplémentaire</p>
            </div>
          </div>
        </AppModal>
      </div>
    </div>
  );
}
