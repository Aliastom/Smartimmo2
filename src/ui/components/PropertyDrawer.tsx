'use client';

import React, { useState, useEffect } from 'react';
import { Home, ReceiptEuro, FileText, Users, Landmark, Camera, TrendingUp } from 'lucide-react';
import { Property } from '../../domain/entities/Property';
import { Transaction } from '../../domain/entities/Transaction';
import { Lease } from '../../domain/entities/Lease';
import { Loan } from '../../domain/entities/Loan';
import { Document } from '../../domain/entities/Document';
import { Tenant } from '../../domain/entities/Tenant';
import PropertyInfoTab from './PropertyInfoTab';
import PropertyTransactionsTab from './PropertyTransactionsTab';
import PropertyDocumentsTab from './PropertyDocumentsTab';
import PropertyLeasesTab from './PropertyLeasesTab';
import PropertyLoanTab from './PropertyLoanTab';
import PropertyPhotosTab from './PropertyPhotosTab';
import PropertyProfitabilityTab from './PropertyProfitabilityTab';
import { Drawer } from '@/components/ui/Drawer';

interface PropertyDrawerProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
  onPropertyUpdate?: () => void;
  defaultTab?: string;
  selectedLease?: any;
}

const tabs = [
  { id: 'info', label: 'Infos', icon: Home },
  { id: 'transactions', label: 'Transactions', icon: ReceiptEuro },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'leases', label: 'Baux/Locataires', icon: Users },
  { id: 'loan', label: 'Prêt', icon: Landmark },
  { id: 'photos', label: 'Photos', icon: Camera },
  { id: 'profitability', label: 'Rentabilité', icon: TrendingUp }
];

export default function PropertyDrawer({ property: initialProperty, isOpen, onClose, onPropertyUpdate, defaultTab = 'info', selectedLease }: PropertyDrawerProps) {
  const [property, setProperty] = useState<Property | null>(initialProperty);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);

  // Mettre à jour l'état local quand la prop change
  useEffect(() => {
    setProperty(initialProperty);
  }, [initialProperty]);

  useEffect(() => {
    if (property && isOpen) {
      fetchPropertyData();
    }
  }, [property, isOpen]); // Charger les données quand la propriété change ou à l'ouverture

  const fetchPropertyData = async () => {
    if (!property) return;
    
    setLoading(true);
    try {
      const [transactionsRes, leasesRes, loanRes, documentsRes, tenantsRes] = await Promise.all([
        fetch(`/api/transactions?propertyId=${property.id}`),
        fetch(`/api/leases?propertyId=${property.id}`),
        fetch(`/api/loans?propertyId=${property.id}`),
        fetch(`/api/documents?propertyId=${property.id}`),
        fetch('/api/tenants'),
      ]);

      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }

      if (leasesRes.ok) {
        const leasesData = await leasesRes.json();
        setLeases(leasesData);
      }

      if (loanRes.ok) {
        const loanData = await loanRes.json();
        setLoan(loanData.length > 0 ? loanData[0] : null);
      }

      if (documentsRes.ok) {
        const documentsData = await documentsRes.json();
        setDocuments(documentsData);
      }

      if (tenantsRes.ok) {
        const tenantsData = await tenantsRes.json();
        setTenants(tenantsData);
      }

      // Notifier la page parente que les données ont été mises à jour
      if (onPropertyUpdate) {
        onPropertyUpdate();
      }
    } catch (error) {
      console.error('Error fetching property data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshPropertyData = async () => {
    if (!property) return;
    
    try {
      const propertyRes = await fetch(`/api/properties/${property.id}`);
      if (propertyRes.ok) {
        const propertyData = await propertyRes.json();
        setProperty(propertyData);
        
        // Notifier la page parente que les données ont été mises à jour
        if (onPropertyUpdate) {
          onPropertyUpdate();
        }
      }
    } catch (error) {
      console.error('Error refreshing property data:', error);
    }
  };

  if (!isOpen || !property) return null;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'info':
        return <PropertyInfoTab property={property} onUpdate={refreshPropertyData} />;
      case 'transactions':
        return <PropertyTransactionsTab property={property} transactions={transactions} onUpdate={fetchPropertyData} />;
      case 'documents':
        return <PropertyDocumentsTab property={property} documents={documents} onUpdate={fetchPropertyData} />;
      case 'leases':
        return <PropertyLeasesTab property={property} tenants={tenants} onUpdate={fetchPropertyData} selectedLease={selectedLease} />;
      case 'loan':
        return <PropertyLoanTab property={property} loan={loan} onUpdate={fetchPropertyData} />;
      case 'photos':
        return <PropertyPhotosTab property={property} documents={documents.filter(d => d.docType === 'photo')} onUpdate={fetchPropertyData} />;
      case 'profitability':
        return <PropertyProfitabilityTab property={property} transactions={transactions} loan={loan} />;
      default:
        return null;
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={property.name}
      size="full"
      noPadding
    >
      <div className="p-6 border-b border-neutral-200">
        <p className="text-neutral-600">{property.address}, {property.postalCode} {property.city}</p>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 bg-base-100 border-b border-neutral-200">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="h-[calc(100vh-180px)] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-neutral-600">Chargement...</p>
            </div>
          </div>
        ) : (
          <div className="p-6">
            {renderTabContent()}
          </div>
        )}
      </div>
    </Drawer>
  );
}
