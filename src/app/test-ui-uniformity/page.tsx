'use client';

import React, { useState } from 'react';
import { Icon, IconWithBadge } from '@/ui/components/Icon';
import { AppModal, ModalFooter } from '@/ui/components/AppModal';
import { 
  Home, 
  Building2, 
  Users, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  ExternalLink
} from 'lucide-react';

export default function TestUIUniformityPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  // Données de test pour les cartes KPI
  const kpiData = [
    { title: 'Biens', value: '12', icon: Building2, variant: 'accent' as const, badgeColor: 'primary' as const },
    { title: 'Locataires', value: '8', icon: Users, variant: 'success' as const, badgeColor: 'success' as const },
    { title: 'Revenus', value: '€2,400', icon: TrendingUp, variant: 'warning' as const, badgeColor: 'warning' as const },
    { title: 'Problèmes', value: '2', icon: AlertCircle, variant: 'error' as const, badgeColor: 'error' as const },
  ];

  // Données de test pour la table
  const tableData = [
    { id: 1, name: 'Appartement A', type: 'T2', price: '€800', status: 'Loué' },
    { id: 2, name: 'Appartement B', type: 'T3', price: '€1200', status: 'Disponible' },
    { id: 3, name: 'Studio C', type: 'T1', price: '€600', status: 'En travaux' },
  ];

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">Test Uniformité UI - Tokens DaisyUI</h1>
      
      {/* Test des liens */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Test des Liens</h2>
          <div className="space-y-2">
            <p>Lien standard : <a href="#">Cliquez ici</a></p>
            <p>Lien dans prose : <span className="prose">Voici un <a href="#">lien dans du texte</a> normal.</span></p>
            <p>Lien discret : <a href="#" className="link-muted">Lien discret</a></p>
            <p>Lien externe : <a href="#" className="link-muted">Documentation <ExternalLink className="inline w-4 h-4 ml-1" /></a></p>
          </div>
        </div>
      </div>

      {/* Test des icônes */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Test des Icônes</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="text-center">
              <Icon variant="default"><Home className="w-5 h-5" /></Icon>
              <p className="text-sm mt-1">Default</p>
            </div>
            <div className="text-center">
              <Icon variant="muted"><Home className="w-5 h-5" /></Icon>
              <p className="text-sm mt-1">Muted</p>
            </div>
            <div className="text-center">
              <Icon variant="accent"><Home className="w-5 h-5" /></Icon>
              <p className="text-sm mt-1">Accent</p>
            </div>
            <div className="text-center">
              <Icon variant="success"><CheckCircle className="w-5 h-5" /></Icon>
              <p className="text-sm mt-1">Success</p>
            </div>
            <div className="text-center">
              <Icon variant="warning"><AlertCircle className="w-5 h-5" /></Icon>
              <p className="text-sm mt-1">Warning</p>
            </div>
            <div className="text-center">
              <Icon variant="error"><XCircle className="w-5 h-5" /></Icon>
              <p className="text-sm mt-1">Error</p>
            </div>
          </div>
        </div>
      </div>

      {/* Test des cartes KPI avec icônes */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Test des Cartes KPI</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiData.map((kpi, index) => (
              <div key={index} className="card bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-shadow">
                <div className="card-body p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-base-content opacity-70">{kpi.title}</p>
                      <p className="text-2xl font-bold text-base-content">{kpi.value}</p>
                    </div>
                    <IconWithBadge 
                      variant={kpi.variant}
                      badgeColor={kpi.badgeColor}
                      badgeSize="md"
                    >
                      <kpi.icon className="w-4 h-4" />
                    </IconWithBadge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Test des tables */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Test des Tables</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Type</th>
                  <th>Prix</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row) => (
                  <tr 
                    key={row.id}
                    className={selectedRow === row.id ? 'active' : ''}
                    onClick={() => setSelectedRow(selectedRow === row.id ? null : row.id)}
                  >
                    <td>{row.name}</td>
                    <td>{row.type}</td>
                    <td>{row.price}</td>
                    <td>
                      <span className={`badge ${
                        row.status === 'Loué' ? 'badge-success' :
                        row.status === 'Disponible' ? 'badge-info' :
                        'badge-warning'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost btn-xs" title="Voir">
                          <Icon variant="default"><Eye className="w-4 h-4" /></Icon>
                        </button>
                        <button className="btn btn-ghost btn-xs" title="Modifier">
                          <Icon variant="default"><Edit className="w-4 h-4" /></Icon>
                        </button>
                        <button className="btn btn-ghost btn-xs" title="Supprimer">
                          <Icon variant="error"><Trash2 className="w-4 h-4" /></Icon>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="alert alert-info mt-4">
            <div>
              <h4 className="font-bold">Instructions :</h4>
              <ul className="text-sm mt-1 list-disc list-inside">
                <li>Survolez les lignes pour voir l'effet hover</li>
                <li>Cliquez sur une ligne pour la sélectionner (classe active)</li>
                <li>Les boutons d'action utilisent des icônes thématisées</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Test de la modale */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Test de la Modale</h2>
          <button 
            className="btn btn-primary"
            onClick={() => setIsModalOpen(true)}
          >
            Ouvrir la Modale
          </button>
          <div className="alert alert-info mt-4">
            <div>
              <h4 className="font-bold">Fonctionnalités de la modale :</h4>
              <ul className="text-sm mt-1 list-disc list-inside">
                <li>Backdrop flouté avec couleur de thème (pas de noir)</li>
                <li>Animation d'ouverture/fermeture (scale + fade)</li>
                <li>Fermeture avec Escape ou clic sur backdrop</li>
                <li>Scroll du body bloqué quand ouverte</li>
                <li>Focus management et aria-labels</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions générales */}
      <div className="alert alert-success">
        <div>
          <h3 className="font-bold">Instructions de Test</h3>
          <div className="text-sm mt-2 space-y-1">
            <p>1. <strong>Changer de thème</strong> et vérifier que :</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Tous les liens sont visibles et soulignables au hover</li>
              <li>Les icônes suivent les couleurs du thème</li>
              <li>Les cartes KPI ont des couleurs cohérentes</li>
              <li>Les tables ont un hover et une sélection lisibles</li>
              <li>La modale a un backdrop flouté clair (pas de noir)</li>
            </ul>
            <p>2. <strong>Thèmes à tester</strong> : light, smartimmo-warm, dark</p>
            <p>3. <strong>Vérifier</strong> qu'aucune couleur fixe (blanc, gris, noir) n'apparaît</p>
          </div>
        </div>
      </div>

      {/* Modale de test */}
      <AppModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Test de la Modale Uniforme"
        size="md"
      >
        <div className="space-y-4">
          <p>Ceci est une modale test utilisant le composant <code>AppModal</code> uniforme.</p>
          <p>Elle devrait avoir :</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Un backdrop flouté avec la couleur du thème</li>
            <li>Une animation fluide d'ouverture/fermeture</li>
            <li>Des boutons stylés avec les tokens daisyUI</li>
          </ul>
        </div>
        <ModalFooter
          onCancel={() => setIsModalOpen(false)}
          onConfirm={() => {
            alert('Action confirmée !');
            setIsModalOpen(false);
          }}
          confirmText="Confirmer"
          cancelText="Annuler"
        />
      </AppModal>
    </div>
  );
}
