'use client';

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { TransactionsPageCore } from '@/features/transactions/TransactionsPageCore';
import { PropertyHeaderActionsProvider } from '@/app/biens/[id]/PropertyHeaderActionsContext';
import { PropertyHeader } from '@/app/biens/[id]/PropertyHeader';
import PropertyDocumentsClient from './property/tabs/PropertyDocumentsClient';
import PropertyEcheancesClient from './property/tabs/PropertyEcheancesClient';
import PropertyLeasesClient from './property/tabs/PropertyLeasesClient';
import PropertyLoansClient from './property/tabs/PropertyLoansClient';
import { usePropertyBaseData } from './hooks/usePropertyBaseData';

// ⚠️ GUARD DEV-ONLY : Vérifier qu'on n'utilise pas router.push/replace/refresh
// Ne PAS importer useRouter ou router ici - utiliser uniquement onTabChange callback

interface PropertyDetailViewProps {
  propertyId: string;
  organizationId: string;
  tab?: string;
  initialLeaseId?: string;
}

// Fonction helper pour normaliser et valider un tab
function normalizeAndValidateTab(tab: string): string {
  let normalizedTab = tab;
  if (tab === 'echeances') normalizedTab = 'deadlines';
  if (tab === 'baux') normalizedTab = 'lease';
  const validTabs = ['transactions', 'documents', 'deadlines', 'lease', 'loans'];
  return validTabs.includes(normalizedTab) ? normalizedTab : 'transactions';
}

export function PropertyDetailView({ propertyId, organizationId, tab = 'transactions', initialLeaseId }: PropertyDetailViewProps) {
  // ✅ DEV SAFEGUARD: Détecter les remount loops (déplacé depuis PropertyLoansClient)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Import dynamique pour éviter l'import en production
      // ⚠️ CRITIQUE: Gérer les erreurs de chargement de chunk en offline
      import('@/lib/dev/remountSafeguard')
        .then(({ trackMount }) => {
          trackMount('PropertyDetailView');
        })
        .catch((error) => {
          // En offline, le chunk peut ne pas être disponible (ChunkLoadError)
          // Ne pas faire échouer l'application pour un outil de dev
          if (process.env.NODE_ENV === 'development') {
            console.warn('[PropertyDetailView] Impossible de charger remountSafeguard (probablement offline):', error.message);
          }
        });
    }
  }, []);

  // ⚙️ OPTIMISATION: Utiliser un hook séparé pour les données de base (header)
  // Query key: ['property', 'base', propertyId] - ne change pas lors du changement d'onglet
  const propertyBaseData = usePropertyBaseData(propertyId, organizationId);

  // ✅ OFFLINE-FIRST: State local pour le tab (source de vérité pour le rendu)
  // Initialisé depuis la prop tab (depuis l'URL initiale), mais ensuite géré localement
  const [activeTab, setActiveTab] = useState(() => normalizeAndValidateTab(tab));

  // ✅ Synchroniser le state local si la prop tab change (navigation externe, retour navigateur)
  useEffect(() => {
    const normalizedTab = normalizeAndValidateTab(tab);
    if (normalizedTab !== activeTab) {
      setActiveTab(normalizedTab);
    }
  }, [tab, activeTab]);

  // ✅ Handler pour changement d'onglet (navigation client-side pure)
  const handleTabChange = useCallback((tabId: string) => {
    const normalizedTab = normalizeAndValidateTab(tabId);
    setActiveTab(normalizedTab);
    
    // Synchroniser l'URL (passif, sans déclencher de fetch RSC)
    const params = new URLSearchParams(window.location.search);
    params.set('view', 'property');
    params.set('propertyId', propertyId);
    params.set('tab', normalizedTab);
    window.history.replaceState({}, '', `/app?${params.toString()}`);
  }, [propertyId]);

  // Utiliser activeTab comme source de vérité (pas la prop tab)
  const validTab = activeTab;

  // ⚙️ OPTIMISATION: Mémoriser le header pour éviter les re-renders inutiles
  // Le header ne change que si propertyId, propertyName, rentalMode ou validTab changent
  // ⚠️ IMPORTANT: Ne pas dépendre du loading pour éviter les remounts
  // -> Le header affiche toujours propertyName (même si vide au début)
  const headerElement = useMemo(() => (
          <PropertyHeader 
            propertyId={propertyId} 
      propertyName={propertyBaseData.name || 'Chargement...'} 
      rentalMode={propertyBaseData.rentalMode}
            mode="app-shell"
      activeTab={validTab}
      onTabChange={handleTabChange}
      propertyAddress={propertyBaseData.address}
      propertyPostalCode={propertyBaseData.postalCode}
      propertyCity={propertyBaseData.city}
          />
  ), [propertyId, propertyBaseData.name, propertyBaseData.rentalMode, validTab, handleTabChange, propertyBaseData.address, propertyBaseData.postalCode, propertyBaseData.city]); // Retiré loading des deps

  // Rendre le contenu selon l'onglet actif
  // ⚙️ OPTIMISATION: Utiliser useMemo pour éviter les remounts inutiles
  const renderTabContent = useMemo(() => {
    switch (validTab) {
      case 'transactions':
        return (
          <TransactionsPageCore 
            key={`transactions-${propertyId}`}
            mode="app-shell"
            initialPropertyId={propertyId}
            hideTitle={true}
          />
        );
      case 'documents':
        return (
          <PropertyDocumentsClient 
            key={`documents-${propertyId}`}
            propertyId={propertyId}
            propertyName={propertyBaseData.name || 'Chargement...'}
          />
    );
      case 'deadlines':
        return (
          <PropertyEcheancesClient 
            key={`deadlines-${propertyId}`}
            propertyId={propertyId}
            propertyName={propertyBaseData.name || 'Chargement...'}
          />
        );
      case 'lease':
        return (
          <PropertyLeasesClient 
            key={`lease-${propertyId}`}
            propertyId={propertyId}
            propertyName={propertyBaseData.name || 'Chargement...'}
            initialLeaseId={initialLeaseId}
          />
        );
      case 'loans':
        return (
          <PropertyLoansClient 
            key={`loans-${propertyId}`}
            propertyId={propertyId}
            propertyName={propertyBaseData.name || 'Chargement...'}
          />
        );
      default:
  return (
          <Card className="w-full" key={`default-${validTab}`}>
      <CardContent className="pt-6">
        <div className="text-center text-gray-600">
                Onglet "{validTab}" non implémenté
        </div>
      </CardContent>
    </Card>
        );
    }
  }, [validTab, propertyId]); // ⚠️ CRITIQUE: Retirer propertyBaseData.name des dépendances pour éviter les remounts lors des changements de données
  // Note: propertyBaseData.name est passé en prop aux composants enfants, mais ne doit pas déclencher de remount du contenu de l'onglet

  return (
    <div className="space-y-6 h-full flex flex-col min-h-0">
      {/* Header avec titre et onglets sur la même ligne - EN DEHORS du provider pour éviter les re-renders */}
      {headerElement}
      
      {/* Contenu de l'onglet actif - DANS le provider pour que les actions puissent être injectées */}
      <PropertyHeaderActionsProvider>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {renderTabContent}
        </div>
      </PropertyHeaderActionsProvider>
    </div>
  );
}

