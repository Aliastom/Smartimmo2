'use client';

import React, { useState } from 'react';
import { 
  AppCard, 
  AppButton, 
  AppInput, 
  AppSelect,
  AppModal,
  AppTable,
  AppTableRow,
  AppTableCell 
} from '@/ui/components/generic';
import { 
  Surface,
  Card,
  BtnPrimary,
  BadgePrimary,
  BadgeSuccess,
  BadgeWarning,
  BadgeError,
  combineClasses 
} from '@/ui/tokens';

export default function ExempleTokensPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className={Surface + " p-6 rounded-lg"}>
        <h1 className="text-3xl font-bold text-base-content mb-2">
          Exemple d'Utilisation des Tokens daisyUI
        </h1>
        <p className="text-base-content opacity-70">
          Cette page démontre l'utilisation des tokens et composants génériques pour une thématisation cohérente.
        </p>
      </div>

      {/* Badges */}
      <AppCard variant="default">
        <div className="card-body">
          <h2 className="card-title text-base-content">Badges avec Tokens</h2>
          <div className="flex gap-2 flex-wrap">
            <span className={BadgePrimary}>Primary</span>
            <span className={BadgeSuccess}>Success</span>
            <span className={BadgeWarning}>Warning</span>
            <span className={BadgeError}>Error</span>
          </div>
        </div>
      </AppCard>

      {/* Formulaire */}
      <AppCard variant="hover">
        <div className="card-body">
          <h2 className="card-title text-base-content mb-4">Formulaire avec Composants Génériques</h2>
          
          <AppInput
            label="Nom complet"
            value={name}
            onChange={setName}
            placeholder="Entrez votre nom"
            required
          />

          <AppSelect
            label="Catégorie"
            value={category}
            onChange={setCategory}
            placeholder="Sélectionnez une catégorie"
            options={[
              { value: 'client', label: 'Client' },
              { value: 'fournisseur', label: 'Fournisseur' },
              { value: 'partenaire', label: 'Partenaire' }
            ]}
            required
          />

          <div className="flex gap-2 mt-4">
            <AppButton variant="primary" onClick={() => setIsModalOpen(true)}>
              Enregistrer
            </AppButton>
            <AppButton variant="ghost">
              Annuler
            </AppButton>
          </div>
        </div>
      </AppCard>

      {/* Table */}
      <AppCard variant="default">
        <div className="card-body">
          <h2 className="card-title text-base-content mb-4">Table avec AppTable</h2>
          
          <AppTable 
            headers={['ID', 'Nom', 'Statut', 'Actions']}
            striped={true}
            hover={true}
          >
            <AppTableRow>
              <AppTableCell>#001</AppTableCell>
              <AppTableCell>Jean Dupont</AppTableCell>
              <AppTableCell>
                <span className={BadgeSuccess}>Actif</span>
              </AppTableCell>
              <AppTableCell>
                <AppButton variant="ghost" size="sm">
                  Modifier
                </AppButton>
              </AppTableCell>
            </AppTableRow>
            
            <AppTableRow>
              <AppTableCell>#002</AppTableCell>
              <AppTableCell>Marie Martin</AppTableCell>
              <AppTableCell>
                <span className={BadgeWarning}>En attente</span>
              </AppTableCell>
              <AppTableCell>
                <AppButton variant="ghost" size="sm">
                  Modifier
                </AppButton>
              </AppTableCell>
            </AppTableRow>

            <AppTableRow>
              <AppTableCell>#003</AppTableCell>
              <AppTableCell>Pierre Dubois</AppTableCell>
              <AppTableCell>
                <span className={BadgeError}>Inactif</span>
              </AppTableCell>
              <AppTableCell>
                <AppButton variant="ghost" size="sm">
                  Modifier
                </AppButton>
              </AppTableCell>
            </AppTableRow>
          </AppTable>
        </div>
      </AppCard>

      {/* Cards avec variants */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AppCard variant="default">
          <div className="card-body">
            <h3 className="card-title text-base-content">Card Default</h3>
            <p className="text-base-content opacity-70">
              Carte standard avec bordure et ombre subtile.
            </p>
          </div>
        </AppCard>

        <AppCard variant="interactive">
          <div className="card-body">
            <h3 className="card-title text-base-content">Card Interactive</h3>
            <p className="text-base-content opacity-70">
              Carte interactive avec effet hover sur l'ombre.
            </p>
          </div>
        </AppCard>

        <AppCard variant="hover">
          <div className="card-body">
            <h3 className="card-title text-base-content">Card Hover</h3>
            <p className="text-base-content opacity-70">
              Carte avec animation de translation au survol.
            </p>
          </div>
        </AppCard>
      </div>

      {/* Boutons */}
      <AppCard variant="default">
        <div className="card-body">
          <h2 className="card-title text-base-content mb-4">Variantes de Boutons</h2>
          
          <div className="flex gap-2 flex-wrap">
            <AppButton variant="primary">Primary</AppButton>
            <AppButton variant="secondary">Secondary</AppButton>
            <AppButton variant="accent">Accent</AppButton>
            <AppButton variant="ghost">Ghost</AppButton>
            <AppButton variant="outline">Outline</AppButton>
            <AppButton variant="link">Link</AppButton>
          </div>

          <div className="divider"></div>

          <h3 className="font-semibold text-base-content mb-2">Tailles</h3>
          <div className="flex gap-2 items-center flex-wrap">
            <AppButton variant="primary" size="xs">Extra Small</AppButton>
            <AppButton variant="primary" size="sm">Small</AppButton>
            <AppButton variant="primary" size="md">Medium</AppButton>
            <AppButton variant="primary" size="lg">Large</AppButton>
          </div>

          <div className="divider"></div>

          <h3 className="font-semibold text-base-content mb-2">États</h3>
          <div className="flex gap-2 flex-wrap">
            <AppButton variant="primary" disabled>Désactivé</AppButton>
            <AppButton variant="primary" loading>Chargement</AppButton>
          </div>
        </div>
      </AppCard>

      {/* Info Box */}
      <div className="alert alert-info">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div>
          <h3 className="font-bold">À propos de cette page</h3>
          <div className="text-xs">
            Cette page utilise exclusivement les tokens daisyUI et les composants génériques. 
            Changez de thème via le ThemeSwitcher pour voir tous les éléments s'adapter automatiquement !
          </div>
        </div>
      </div>

      {/* Modal */}
      <AppModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Confirmation"
        primaryAction={{
          label: 'Confirmer',
          onClick: () => {
            console.log('Confirmé !');
            setIsModalOpen(false);
          }
        }}
        secondaryAction={{
          label: 'Annuler',
          onClick: () => setIsModalOpen(false)
        }}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-base-content">
            Vous êtes sur le point d'enregistrer les informations suivantes :
          </p>
          
          <div className={Surface + " p-4 rounded-lg"}>
            <dl className="space-y-2">
              <div>
                <dt className="text-base-content opacity-70 text-sm">Nom :</dt>
                <dd className="text-base-content font-medium">{name || '(non défini)'}</dd>
              </div>
              <div>
                <dt className="text-base-content opacity-70 text-sm">Catégorie :</dt>
                <dd className="text-base-content font-medium">{category || '(non défini)'}</dd>
              </div>
            </dl>
          </div>

          <p className="text-base-content opacity-60 text-sm">
            Cette modal utilise <code className="bg-base-200 px-1 rounded">AppModal</code> avec les tokens daisyUI.
          </p>
        </div>
      </AppModal>
    </div>
  );
}
