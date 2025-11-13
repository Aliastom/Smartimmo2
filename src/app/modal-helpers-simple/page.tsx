'use client';

import React from 'react';
import { ConfirmationModal, InfoModal, useModal, useModals, createModalActions } from '@/ui/shared/ModalHelpers';
import { AppModal } from '@/ui/shared/AppModal';

export default function ModalHelpersSimplePage() {
  // Modal simple
  const infoModal = useModal();
  
  // Modal de confirmation
  const confirmationModal = useModal();
  
  // Plusieurs modales
  const { openModal, closeModal, isOpen } = useModals();

  const handleDelete = () => {
    console.log('Suppression confirmée !');
    confirmationModal.closeModal();
  };

  const handleSave = () => {
    console.log('Sauvegarde effectuée !');
    infoModal.closeModal();
  };

  return (
    <div className="min-h-screen bg-base-100 p-8">
      <div className="container mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-base-content">
          Test des helpers de modales
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Modal d'information */}
          <div className="card bg-base-200 p-6">
            <h2 className="card-title text-lg mb-4">Modal d'information</h2>
            <p className="text-sm opacity-70 mb-4">
              Modal simple avec message d'information
            </p>
            <button 
              className="btn btn-primary"
              onClick={infoModal.openModal}
            >
              Ouvrir info modal
            </button>
          </div>

          {/* Modal de confirmation */}
          <div className="card bg-base-200 p-6">
            <h2 className="card-title text-lg mb-4">Modal de confirmation</h2>
            <p className="text-sm opacity-70 mb-4">
              Modal de confirmation avec variant danger
            </p>
            <button 
              className="btn btn-error"
              onClick={confirmationModal.openModal}
            >
              Supprimer un élément
            </button>
          </div>

          {/* Modal avec helpers */}
          <div className="card bg-base-200 p-6">
            <h2 className="card-title text-lg mb-4">Modal avec helpers</h2>
            <p className="text-sm opacity-70 mb-4">
              Modal utilisant createModalActions
            </p>
            <button 
              className="btn btn-accent"
              onClick={() => openModal('save')}
            >
              Ouvrir modal save
            </button>
          </div>
        </div>

        {/* Informations sur les helpers */}
        <div className="card bg-base-200 p-6">
          <h2 className="card-title text-lg mb-4">Helpers disponibles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">🎯 createModalActions</h3>
              <ul className="text-sm space-y-1 opacity-70">
                <li>• <code>save()</code> - Action sauvegarder</li>
                <li>• <code>cancel()</code> - Action annuler</li>
                <li>• <code>delete()</code> - Action supprimer</li>
                <li>• <code>close()</code> - Action fermer</li>
                <li>• <code>confirm()</code> - Action confirmer</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">🪝 Hooks</h3>
              <ul className="text-sm space-y-1 opacity-70">
                <li>• <code>useModal()</code> - Gérer une modal</li>
                <li>• <code>useModals()</code> - Gérer plusieurs modales</li>
                <li>• <code>ConfirmationModal</code> - Modal de confirmation</li>
                <li>• <code>InfoModal</code> - Modal d'information</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Code d'exemple */}
        <div className="card bg-base-200 p-6">
          <h2 className="card-title text-lg mb-4">Exemple de code</h2>
          <pre className="bg-base-300 p-4 rounded text-sm overflow-x-auto">
            <code>{`// Hook simple
const modal = useModal();

// Actions avec helpers
const actions = {
  primary: createModalActions.save(handleSave, loading),
  secondary: createModalActions.cancel(modal.closeModal),
};

// Utilisation
<AppModal
  open={modal.open}
  onClose={modal.closeModal}
  title="Ma modal"
  primaryAction={actions.primary}
  secondaryAction={actions.secondary}
>
  Contenu de la modal
</AppModal>`}</code>
          </pre>
        </div>

        {/* Modales */}
        
        {/* Modal d'information */}
        <InfoModal
          open={infoModal.open}
          onClose={infoModal.closeModal}
          title="Information"
          message="Ceci est un message d'information simple avec un bouton OK."
        />

        {/* Modal de confirmation */}
        <ConfirmationModal
          open={confirmationModal.open}
          onClose={confirmationModal.closeModal}
          onConfirm={handleDelete}
          title="Confirmer la suppression"
          message="Êtes-vous sûr de vouloir supprimer cet élément ? Cette action est irréversible."
          confirmLabel="Supprimer"
          cancelLabel="Annuler"
          variant="danger"
        />

        {/* Modal avec helpers */}
        <AppModal
          open={isOpen('save')}
          onClose={() => closeModal('save')}
          title="Sauvegarder"
          primaryAction={createModalActions.save(
            handleSave,
            false,
            false
          )}
          secondaryAction={createModalActions.cancel(
            () => closeModal('save'),
            false
          )}
        >
          <div className="space-y-4">
            <p>Cette modal utilise les helpers <code>createModalActions</code> pour créer rapidement les actions.</p>
            <div className="alert alert-info">
              <span>Les helpers simplifient la création des modales réutilisables !</span>
            </div>
          </div>
        </AppModal>
      </div>
    </div>
  );
}
