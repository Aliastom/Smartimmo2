'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Edit, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { BienKpis } from '@/components/bien/BienKpis';
import { BienMiniCharts } from '@/components/bien/BienMiniCharts';
import { BienAlerts } from '@/components/bien/BienAlerts';
import PropertyForm from '@/components/forms/PropertyForm';

export interface BienOverviewClientProps {
  property: any;
  kpis: any[];
  alerts: any;
  counts: any;
  evolutionData?: any[];
  repartitionData?: any[];
  incomeExpenseData?: any[];
  recentItems?: {
    transactions: string[];
    documents: string[];
    unreconciled: string[];
    photos: string[];
  };
}

export default function BienOverviewClient({
  property,
  kpis,
  alerts,
  counts,
  evolutionData,
  repartitionData,
  incomeExpenseData,
  recentItems
}: BienOverviewClientProps) {
  const [editModalOpen, setEditModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Style identique à Transactions */}
      <SectionTitle
        title={property.name}
        description="Vue d'ensemble du bien"
        actions={
          <>
            {/* Adresse et badges */}
            <div className="flex items-center gap-2 flex-wrap mr-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                <span>{property.address}</span>
              </div>
              {property.status && (
                <Badge variant={property.status === 'OCCUPE' ? 'success' : 'warning'}>
                  {property.status === 'OCCUPE' ? 'Occupé' : 'Vacant'}
                </Badge>
              )}
              {property.type && (
                <Badge variant="outline">{property.type}</Badge>
              )}
              {property.surface && (
                <Badge variant="outline">{property.surface} m²</Badge>
              )}
            </div>
            {/* Bouton Modifier */}
            <Button
              onClick={() => setEditModalOpen(true)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Modifier
            </Button>
          </>
        }
      />


      {/* Hex Navigation - CODE EXACT CODEPEN - Raccourcis visuels */}
      <div className="bg-white border border-gray-200 rounded-2xl py-8 shadow-sm mx-6 mt-6">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          {/* Layout 3 colonnes : cartes gauche + hexagones centre + cartes droite */}
          <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_280px] gap-10 items-start">
            
            {/* Cartes gauche - Style Documents avec items */}
            <div className="hidden xl:flex flex-col gap-4 justify-center px-4">
              <div className="bg-white rounded-xl border border-blue-200 p-4 md:p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-blue-600">Transactions</p>
                    <p className="text-xl md:text-2xl font-semibold text-gray-900 mt-1">{counts?.transactions || 0}</p>
                  </div>
                  <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center bg-blue-100 text-blue-600">
                    <i className="fa fa-receipt text-lg md:text-xl"></i>
                  </div>
                </div>
                {recentItems?.transactions && recentItems.transactions.length > 0 && (
                  <div className="space-y-1 text-xs text-gray-500">
                    {recentItems.transactions.map((item, i) => (
                      <div key={i} className="truncate">• {item}</div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-xl border border-blue-200 p-4 md:p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-blue-600">Non rapprochées</p>
                    <p className="text-xl md:text-2xl font-semibold text-gray-900 mt-1">{counts?.transactionsNonRapprochees || 0}</p>
                  </div>
                  <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center bg-blue-100 text-blue-600">
                    <i className="fa fa-exclamation-circle text-lg md:text-xl"></i>
                  </div>
                </div>
                {recentItems?.unreconciled && recentItems.unreconciled.length > 0 && (
                  <div className="space-y-1 text-xs text-gray-500">
                    {recentItems.unreconciled.map((item, i) => (
                      <div key={i} className="truncate">• {item}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Hexagones centre */}
            <div style={{ maxWidth: '750px', margin: '0 auto' }}>
            <div className="hexagon-menu page-home clear">
            <div className="hexagon-item hexagon-transactions">
              <div className="hex-item">
                <div></div>
                <div></div>
                <div></div>
              </div>
              <div className="hex-item">
                <div></div>
                <div></div>
                <div></div>
              </div>
              <Link href={`/biens/${property.id}/transactions`} className="hex-content hex-transactions">
                <span className="hex-content-inner">
                  <span className="icon">
                    <span style={{fontSize: '2rem'}}>💰</span>
                  </span>
                  <span className="title">Transactions</span>
                </span>
                <svg viewBox="0 0 173.20508075688772 200" height="200" width="174" version="1.1" xmlns="http://www.w3.org/2000/svg">
                  <path d="M86.60254037844386 0L173.20508075688772 50L173.20508075688772 150L86.60254037844386 200L0 150L0 50Z" fill="#f3f4f6"></path>
                </svg>
              </Link>
            </div>
            <div className="hexagon-item hexagon-documents">
              <div className="hex-item">
                <div></div>
                <div></div>
                <div></div>
              </div>
              <div className="hex-item">
                <div></div>
                <div></div>
                <div></div>
              </div>
              <Link href={`/biens/${property.id}/documents`} className="hex-content hex-documents">
                <span className="hex-content-inner">
                  <span className="icon">
                    <span style={{fontSize: '2rem'}}>📄</span>
                  </span>
                  <span className="title">Documents</span>
                </span>
                <svg viewBox="0 0 173.20508075688772 200" height="200" width="174" version="1.1" xmlns="http://www.w3.org/2000/svg">
                  <path d="M86.60254037844386 0L173.20508075688772 50L173.20508075688772 150L86.60254037844386 200L0 150L0 50Z" fill="#f3f4f6"></path>
                </svg>
              </Link>
            </div>
            <div className="hexagon-item hexagon-photos">
              <div className="hex-item">
                <div></div>
                <div></div>
                <div></div>
              </div>
              <div className="hex-item">
                <div></div>
                <div></div>
                <div></div>
              </div>
              <Link href={`/biens/${property.id}/photos`} className="hex-content hex-photos">
                <span className="hex-content-inner">
                  <span className="icon">
                    <span style={{fontSize: '2rem'}}>📷</span>
                  </span>
                  <span className="title">Photos</span>
                </span>
                <svg viewBox="0 0 173.20508075688772 200" height="200" width="174" version="1.1" xmlns="http://www.w3.org/2000/svg">
                  <path d="M86.60254037844386 0L173.20508075688772 50L173.20508075688772 150L86.60254037844386 200L0 150L0 50Z" fill="#f3f4f6"></path>
                </svg>
              </Link>
            </div>
            <div className="hexagon-item hexagon-baux">
              <div className="hex-item">
                <div></div>
                <div></div>
                <div></div>
              </div>
              <div className="hex-item">
                <div></div>
                <div></div>
                <div></div>
              </div>
              <Link href={`/biens/${property.id}/leases`} className="hex-content hex-baux">
                <span className="hex-content-inner">
                  <span className="icon">
                    <span style={{fontSize: '2rem'}}>📝</span>
                  </span>
                  <span className="title">Baux</span>
                </span>
                <svg viewBox="0 0 173.20508075688772 200" height="200" width="174" version="1.1" xmlns="http://www.w3.org/2000/svg">
                  <path d="M86.60254037844386 0L173.20508075688772 50L173.20508075688772 150L86.60254037844386 200L0 150L0 50Z" fill="#f3f4f6"></path>
                </svg>
              </Link>
            </div>
            <div className="hexagon-item hexagon-echeances">
              <div className="hex-item">
                <div></div>
                <div></div>
                <div></div>
              </div>
              <div className="hex-item">
                <div></div>
                <div></div>
                <div></div>
              </div>
              <Link href={`/biens/${property.id}/echeances`} className="hex-content hex-echeances">
                <span className="hex-content-inner">
                  <span className="icon">
                    <span style={{fontSize: '2rem'}}>📅</span>
                  </span>
                  <span className="title">Échéances</span>
                </span>
                <svg viewBox="0 0 173.20508075688772 200" height="200" width="174" version="1.1" xmlns="http://www.w3.org/2000/svg">
                  <path d="M86.60254037844386 0L173.20508075688772 50L173.20508075688772 150L86.60254037844386 200L0 150L0 50Z" fill="#f3f4f6"></path>
                </svg>
              </Link>
            </div>
            <div className="hexagon-item hexagon-prets">
              <div className="hex-item">
                <div></div>
                <div></div>
                <div></div>
              </div>
              <div className="hex-item">
                <div></div>
                <div></div>
                <div></div>
              </div>
              <Link href={`/biens/${property.id}/loans`} className="hex-content hex-prets">
                <span className="hex-content-inner">
                  <span className="icon">
                    <span style={{fontSize: '2rem'}}>💳</span>
                  </span>
                  <span className="title">Prêts</span>
                </span>
                <svg viewBox="0 0 173.20508075688772 200" height="200" width="174" version="1.1" xmlns="http://www.w3.org/2000/svg">
                  <path d="M86.60254037844386 0L173.20508075688772 50L173.20508075688772 150L86.60254037844386 200L0 150L0 50Z" fill="#f3f4f6"></path>
                </svg>
              </Link>
            </div>
            <div className="hexagon-item hexagon-a-venir">
              <div className="hex-item">
                <div></div>
                <div></div>
                <div></div>
              </div>
              <div className="hex-item">
                <div></div>
                <div></div>
                <div></div>
              </div>
              <a className="hex-content hex-a-venir">
                <span className="hex-content-inner">
                  <span className="icon">
                    <span style={{fontSize: '2rem'}}>🎯</span>
                  </span>
                  <span className="title">À venir</span>
                </span>
                <svg viewBox="0 0 173.20508075688772 200" height="200" width="174" version="1.1" xmlns="http://www.w3.org/2000/svg">
                  <path d="M86.60254037844386 0L173.20508075688772 50L173.20508075688772 150L86.60254037844386 200L0 150L0 50Z" fill="#f3f4f6"></path>
                </svg>
              </a>
            </div>
          </div>
          </div>

            {/* Cartes droite - Style Documents avec items */}
            <div className="hidden xl:flex flex-col gap-4 justify-center px-4">
              <div className="bg-white rounded-xl border border-blue-200 p-4 md:p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-blue-600">Documents</p>
                    <p className="text-xl md:text-2xl font-semibold text-gray-900 mt-1">{counts?.documents || 0}</p>
                  </div>
                  <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center bg-blue-100 text-blue-600">
                    <i className="fa fa-file-alt text-lg md:text-xl"></i>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  {counts?.docsNonClasses || 0} non classés
                </div>
                {recentItems?.documents && recentItems.documents.length > 0 && (
                  <div className="space-y-1 text-xs text-gray-500">
                    {recentItems.documents.map((item, i) => (
                      <div key={i} className="truncate">• {item}</div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-xl border border-blue-200 p-4 md:p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-blue-600">Photos</p>
                    <p className="text-xl md:text-2xl font-semibold text-gray-900 mt-1">{counts?.photos || 0}</p>
                  </div>
                  <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center bg-blue-100 text-blue-600">
                    <i className="fa fa-camera text-lg md:text-xl"></i>
                  </div>
                </div>
                {recentItems?.photos && recentItems.photos.length > 0 ? (
                  <div className="space-y-1 text-xs text-gray-500">
                    {recentItems.photos.map((item, i) => (
                      <div key={i} className="truncate">• {item}</div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 italic">Aucune photo</div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* KPIs Compacts */}
        <BienKpis kpis={kpis} />

        {/* Mini Charts */}
        {(evolutionData?.length || repartitionData?.length || incomeExpenseData?.length) ? (
          <BienMiniCharts
            evolutionData={evolutionData}
            repartitionData={repartitionData}
            incomeExpenseData={incomeExpenseData}
          />
        ) : null}

        {/* Alertes */}
        <BienAlerts
          alerts={alerts}
          propertyId={property.id}
        />
      </div>

      {/* Modal d'édition */}
      <PropertyForm
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Modifier le bien"
        initialData={property}
        onSubmit={async (data) => {
          try {
            const response = await fetch(`/api/properties/${property.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            
            if (!response.ok) {
              throw new Error('Erreur lors de la mise à jour');
            }
            
            setEditModalOpen(false);
            window.location.reload();
          } catch (error) {
            console.error('Erreur:', error);
            throw error;
          }
        }}
      />
    </div>
  );
}

