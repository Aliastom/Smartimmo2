'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { ClientPropertyTable } from '@/components/ui/ClientPropertyTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Drawer } from '@/components/ui/Drawer';
import { useState } from 'react';
import { 
  Building2, 
  Users, 
  DollarSign, 
  FileText,
  Plus,
  Settings,
  Eye
} from 'lucide-react';

const mockData = {
  kpis: [
    {
      title: 'Total Biens',
      value: '24',
      iconName: 'Building2',
      trend: { value: 12, label: 'vs mois dernier', period: '30j' },
      color: 'primary' as const
    },
    {
      title: 'Locataires Actifs',
      value: '18',
      iconName: 'Users',
      trend: { value: 5, label: 'vs mois dernier', period: '30j' },
      color: 'success' as const
    },
    {
      title: 'Revenus Mensuels',
      value: '€12,450',
      iconName: 'DollarSign',
      trend: { value: 8, label: 'vs mois dernier', period: '30j' },
      color: 'success' as const
    },
    {
      title: 'Documents Envoyés',
      value: '156',
      iconName: 'FileText',
      trend: { value: -2, label: 'vs mois dernier', period: '30j' },
      color: 'warning' as const
    }
  ],
  properties: [
    {
      id: '1',
      name: 'Appartement A1',
      address: '123 Rue de la Paix, Paris',
      tenant: 'Jean Dupont',
      rent: '€850',
      status: 'occupied'
    },
    {
      id: '2',
      name: 'Maison B2',
      address: '456 Avenue des Champs, Lyon',
      tenant: 'Marie Martin',
      rent: '€1,200',
      status: 'occupied'
    },
    {
      id: '3',
      name: 'Studio C3',
      address: '789 Boulevard Saint-Germain, Paris',
      tenant: 'Pierre Durand',
      rent: '€650',
      status: 'vacant'
    }
  ]
};

// Colonnes simplifiées sans fonctions render
const propertyColumns = [
  { key: 'name', header: 'Bien' },
  { key: 'address', header: 'Adresse' },
  { key: 'tenant', header: 'Locataire' },
  { key: 'rent', header: 'Loyer' },
  { key: 'status', header: 'Statut' }
];

export default function TestUIModernPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Test UI Moderne</h1>
          <p className="text-gray-600 mt-1">Démonstration des nouveaux composants</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ouvrir Modal
          </Button>
          <Button variant="outline" onClick={() => setDrawerOpen(true)}>
            Ouvrir Drawer
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">KPI Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {mockData.kpis.map((kpi, index) => (
            <KPICard key={index} {...kpi} />
          ))}
        </div>
      </div>

      {/* Cards Variants */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Card Variants</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card hover>
            <CardHeader>
              <CardTitle>Card Default</CardTitle>
              <CardDescription>
                Card avec variant par défaut et effet hover
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Cette card utilise le variant par défaut avec un effet hover.
              </p>
            </CardContent>
          </Card>

          <Card variant="glass" hover>
            <CardHeader>
              <CardTitle>Card Glass</CardTitle>
              <CardDescription>
                Card avec effet glass et backdrop blur
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Cette card utilise l'effet glass avec backdrop blur.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Data Table */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Table</h2>
        <ClientPropertyTable
          data={mockData.Property}
          hover
          compact
        />
      </div>

      {/* Buttons */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Buttons</h2>
        <div className="flex flex-wrap gap-4">
          <Button>Primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="soft">Soft</Button>
          <Button variant="success">Success</Button>
          <Button variant="warning">Warning</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="outline">Outline</Button>
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Modal de Test"
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => setModalOpen(false)}>
              Confirmer
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Ceci est un exemple de modal avec backdrop blur et animation fluide.
          </p>
          <div className="p-4 bg-gray-50 rounded-2xl">
            <h3 className="font-medium text-gray-900 mb-2">Contenu de la modal</h3>
            <p className="text-sm text-gray-600">
              La modal utilise Framer Motion pour les animations et respecte les tokens de design.
            </p>
          </div>
        </div>
      </Modal>

      {/* Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Drawer de Test"
        size="md"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setDrawerOpen(false)}>
              Fermer
            </Button>
            <Button onClick={() => setDrawerOpen(false)}>
              Sauvegarder
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Ceci est un exemple de drawer qui slide depuis la droite.
          </p>
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded-xl">
              <h4 className="font-medium text-gray-900">Section 1</h4>
              <p className="text-sm text-gray-600">Contenu de la section 1</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <h4 className="font-medium text-gray-900">Section 2</h4>
              <p className="text-sm text-gray-600">Contenu de la section 2</p>
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
