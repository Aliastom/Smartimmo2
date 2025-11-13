'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, MapPin, Home, ReceiptEuro, Users, FileText, 
  Camera, Landmark, TrendingUp, Settings
} from 'lucide-react';
import { Property } from '../../domain/entities/Property';
import { usePropertyRuntimeStatus } from '../hooks/usePropertyRuntimeStatus';

interface PropertyHeaderProps {
  property: Property;
}

const tabs = [
  { id: 'transactions', label: 'Transactions', icon: ReceiptEuro, href: '/transactions' },
  { id: 'leases', label: 'Baux', icon: Users, href: '/leases' },
  { id: 'tenants', label: 'Occupants', icon: Users, href: '/locataires' },
  { id: 'documents', label: 'Documents', icon: FileText, href: '/documents' },
  { id: 'photos', label: 'Photos', icon: Camera, href: '/photos' },
  { id: 'loans', label: 'Prêts', icon: Landmark, href: '/loans' },
  { id: 'profitability', label: 'Rentabilité', icon: TrendingUp, href: '/profitability' },
  { id: 'settings', label: 'Paramètres', icon: Settings, href: '/settings' },
];

export default function PropertyHeader({ property }: PropertyHeaderProps) {
  const pathname = usePathname();

  // Déterminer l'onglet actif
  const baseUrl = `/biens/${property.id}`;
  const activeTab = tabs.find(tab => {
    return pathname === `${baseUrl}${tab.href}`;
  })?.id || 'transactions';

  // Statut automatique basé sur les baux actifs
  const { status, label, color } = usePropertyRuntimeStatus(property.id);

  return (
    <>
      {/* Breadcrumbs & Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-2 text-sm text-neutral-600 mb-3">
            <Link href="/biens" className="hover:text-neutral-900 transition-colors">
              Biens
            </Link>
            <span>/</span>
            <span className="text-neutral-900 font-medium">{property.name}</span>
          </nav>

          {/* Titre & Adresse */}
          <div className="flex items-center space-x-4">
            <Link 
              href="/biens"
              className="text-neutral-600 hover:text-neutral-900 transition-colors"
              title="Retour aux biens"
            >
              <ArrowLeft size={24} />
            </Link>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-3xl font-bold text-neutral-900">{property.name}</h1>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${color}`}>
                  {label}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-neutral-600 mt-1">
                <MapPin size={16} />
                <span>{property.address}, {property.postalCode} {property.city}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="border-b border-neutral-200">
        <nav className="flex space-x-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const href = `${baseUrl}${tab.href}`;
            const isActive = tab.id === activeTab;
            
            return (
              <Link
                key={tab.id}
                href={href}
                className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:border-neutral-300'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}

