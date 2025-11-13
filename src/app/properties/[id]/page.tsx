'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useState } from 'react';
import { 
  Building2, 
  MapPin, 
  Users, 
  DollarSign,
  Calendar,
  FileText,
  Settings,
  Edit,
  Plus,
  Eye,
  MoreVertical
} from 'lucide-react';

// Mock data pour la démonstration
const mockProperty = {
  id: '1',
  name: 'Appartement A1',
  address: '123 Rue de la Paix, 75001 Paris',
  type: 'Appartement',
  surface: 65,
  rooms: 3,
  bedrooms: 2,
  bathrooms: 1,
  floor: 2,
  elevator: true,
  balcony: true,
  garage: false,
  status: 'occupied',
  Tenant: {
    name: 'Jean Dupont',
    email: 'jean.dupont@email.com',
    phone: '+33 6 12 34 56 78',
    startDate: '2023-01-01',
    endDate: '2024-12-31'
  },
  rent: 850,
  charges: 120,
  deposit: 1700,
  kpis: [
    {
      title: 'Loyer Mensuel',
      value: '€850',
      iconName: 'DollarSign',
      trend: { value: 0, label: 'stable', period: '12m' },
      color: 'primary' as const
    },
    {
      title: 'Charges',
      value: '€120',
      iconName: 'Building2',
      trend: { value: 5, label: 'vs année dernière', period: '12m' },
      color: 'warning' as const
    },
    {
      title: 'Durée Occupée',
      value: '12 mois',
      iconName: 'Calendar',
      trend: { value: 100, label: 'occupation', period: '12m' },
      color: 'success' as const
    },
    {
      title: 'Documents',
      value: '8',
      iconName: 'FileText',
      trend: { value: 2, label: 'nouveaux', period: '30j' },
      color: 'gray' as const
    }
  ],
  leases: [
    {
      id: '1',
      tenant: 'Jean Dupont',
      startDate: '2023-01-01',
      endDate: '2024-12-31',
      rent: '€850',
      deposit: '€1,700',
      status: 'active'
    },
    {
      id: '2',
      tenant: 'Marie Martin',
      startDate: '2021-06-01',
      endDate: '2022-12-31',
      rent: '€800',
      deposit: '€1,600',
      status: 'ended'
    }
  ],
  transactions: [
    {
      id: '1',
      type: 'Loyer',
      amount: '€850',
      date: '2024-01-01',
      status: 'paid',
      description: 'Loyer janvier 2024'
    },
    {
      id: '2',
      type: 'Charges',
      amount: '€120',
      date: '2024-01-01',
      status: 'paid',
      description: 'Charges janvier 2024'
    },
    {
      id: '3',
      type: 'Loyer',
      amount: '€850',
      date: '2023-12-01',
      status: 'paid',
      description: 'Loyer décembre 2023'
    }
  ]
};

const leaseColumns = [
  {
    key: 'tenant',
    header: 'Locataire',
    render: (value: string) => <span className="font-medium text-gray-900">{value}</span>
  },
  {
    key: 'startDate',
    header: 'Début',
    render: (value: string) => <span className="text-gray-600">{value}</span>
  },
  {
    key: 'endDate',
    header: 'Fin',
    render: (value: string) => <span className="text-gray-600">{value}</span>
  },
  {
    key: 'rent',
    header: 'Loyer',
    render: (value: string) => <span className="font-medium text-gray-900">{value}</span>
  },
  {
    key: 'status',
    header: 'Statut',
    render: (value: string) => (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
        value === 'active' 
          ? 'bg-success-100 text-success-800' 
          : 'bg-gray-100 text-gray-800'
      }`}>
        {value === 'active' ? 'Actif' : 'Terminé'}
      </span>
    )
  },
  {
    key: 'actions',
    header: 'Actions',
    render: (value: any, row: any) => (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm">
          <Eye className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm">
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>
    )
  }
];

const transactionColumns = [
  {
    key: 'type',
    header: 'Type',
    render: (value: string) => (
      <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-gray-400" />
        <span className="font-medium text-gray-900">{value}</span>
      </div>
    )
  },
  {
    key: 'description',
    header: 'Description',
    render: (value: string) => <span className="text-gray-600">{value}</span>
  },
  {
    key: 'amount',
    header: 'Montant',
    render: (value: string) => <span className="font-medium text-gray-900">{value}</span>
  },
  {
    key: 'date',
    header: 'Date',
    render: (value: string) => <span className="text-gray-600">{value}</span>
  },
  {
    key: 'status',
    header: 'Statut',
    render: (value: string) => (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
        value === 'paid' 
          ? 'bg-success-100 text-success-800' 
          : 'bg-warning-100 text-warning-800'
      }`}>
        {value === 'paid' ? 'Payé' : 'En attente'}
      </span>
    )
  }
];

export default function PropertyDetailPage({ params }: { params: { id: string } }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: Building2 },
    { id: 'leases', label: 'Baux', icon: FileText },
    { id: 'transactions', label: 'Transactions', icon: DollarSign },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'settings', label: 'Paramètres', icon: Settings }
  ];

  return (
    <div className="space-y-6">
      {/* Header Sticky */}
      <div className="sticky top-16 z-30 bg-white border-b border-gray-200 -mx-6 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 bg-primary-500 rounded-2xl">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{mockProperty.name}</h1>
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">{mockProperty.address}</span>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  mockProperty.status === 'occupied' 
                    ? 'bg-success-100 text-success-800' 
                    : 'bg-warning-100 text-warning-800'
                }`}>
                  {mockProperty.status === 'occupied' ? 'Occupé' : 'Vacant'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Modifier
            </Button>
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle Action
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {mockProperty.kpis.map((kpi, index) => (
              <KPICard key={index} {...kpi} />
            ))}
          </div>

          {/* Property Details & Tenant Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Property Details */}
            <Card>
              <CardHeader>
                <CardTitle>Détails du Bien</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Type</p>
                      <p className="font-medium text-gray-900">{mockProperty.type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Surface</p>
                      <p className="font-medium text-gray-900">{mockProperty.surface} m²</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Pièces</p>
                      <p className="font-medium text-gray-900">{mockProperty.rooms}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Chambres</p>
                      <p className="font-medium text-gray-900">{mockProperty.bedrooms}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Étage</p>
                      <p className="font-medium text-gray-900">{mockProperty.floor}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Équipements</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {mockProperty.elevator && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            Ascenseur
                          </span>
                        )}
                        {mockProperty.balcony && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                            Balcon
                          </span>
                        )}
                        {mockProperty.garage && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                            Garage
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tenant Info */}
            <Card>
              <CardHeader>
                <CardTitle>Locataire Actuel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-xl">
                      <Users className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{mockProperty.Tenant.name}</p>
                      <p className="text-sm text-gray-500">{mockProperty.Tenant.email}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Téléphone</span>
                      <span className="text-sm text-gray-900">{mockProperty.Tenant.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Début du bail</span>
                      <span className="text-sm text-gray-900">{mockProperty.Tenant.startDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Fin du bail</span>
                      <span className="text-sm text-gray-900">{mockProperty.Tenant.endDate}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'leases' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Historique des Baux</CardTitle>
                <CardDescription>
                  Tous les baux de ce bien immobilier
                </CardDescription>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau Bail
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              data={mockProperty.Lease}
              columns={leaseColumns}
              hover
              compact
            />
          </CardContent>
        </Card>
      )}

      {activeTab === 'transactions' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transactions</CardTitle>
                <CardDescription>
                  Historique des paiements et transactions
                </CardDescription>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle Transaction
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              data={mockProperty.Transaction}
              columns={transactionColumns}
              hover
              compact
            />
          </CardContent>
        </Card>
      )}

      {activeTab === 'documents' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Documents</CardTitle>
                <CardDescription>
                  Tous les documents liés à ce bien
                </CardDescription>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter Document
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              Aucun document disponible
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'settings' && (
        <Card>
          <CardHeader>
            <CardTitle>Paramètres du Bien</CardTitle>
            <CardDescription>
              Configuration et paramètres avancés
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              Paramètres à venir
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nouvelle Action"
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => setModalOpen(false)}>
              Créer
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Formulaire pour créer une nouvelle action sur ce bien.
          </p>
        </div>
      </Modal>
    </div>
  );
}
