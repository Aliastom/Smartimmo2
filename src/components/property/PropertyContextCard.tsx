'use client';

import React, { useState, useEffect } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import type { LocalProperty } from '@/lib/offline/db';
import { cn } from '@/utils/cn';
import { Badge } from '@/components/ui/Badge';

interface PropertyContextCardProps {
  propertyId: string;
  onOpenSwitcher: () => void;
  mode: 'app-shell';
}

// Fonction pour obtenir le badge de statut (basé sur les baux actifs, comme dans BiensClient)
function getStatusBadge(property: LocalProperty, hasActiveLease: boolean) {
  if (property.isArchived) {
    return (
      <Badge 
        variant="gray" 
        size="sm" 
        className="bg-transparent border-gray-300 text-gray-600"
      >
        Archivé
      </Badge>
    );
  }
  
  // Si mode Airbnb
  if (property.rentalMode === 'SEASONAL_AIRBNB') {
    return (
      <Badge 
        variant="success" 
        size="sm" 
        className="bg-transparent border-green-300 text-green-700"
      >
        Airbnb
      </Badge>
    );
  }
  
  // Pour les biens en location, le statut dépend des baux actifs
  if (property.occupation === 'LOCATIF') {
    if (hasActiveLease) {
      return (
        <Badge 
          variant="success" 
          size="sm" 
          className="bg-transparent border-green-300 text-green-700"
        >
          Occupé
        </Badge>
      );
    } else {
      return (
        <Badge 
          variant="warning" 
          size="sm" 
          className="bg-transparent border-yellow-300 text-yellow-700"
        >
          Vacant
        </Badge>
      );
    }
  }
  
  // Pour les biens principaux/secondaires, toujours "Occupé"
  if (property.occupation === 'PRINCIPALE' || property.occupation === 'SECONDAIRE') {
    return (
      <Badge 
        variant="info" 
        size="sm" 
        className="bg-transparent border-blue-300 text-blue-700"
      >
        Occupé
      </Badge>
    );
  }
  
  // Par défaut, si pas de bail actif et occupation != LOCATIF, on considère vacant
  if (!hasActiveLease) {
    return (
      <Badge 
        variant="warning" 
        size="sm" 
        className="bg-transparent border-yellow-300 text-yellow-700"
      >
        Vacant
      </Badge>
    );
  }
  
  return null;
}

export function PropertyContextCard({
  propertyId,
  onOpenSwitcher,
  mode,
}: PropertyContextCardProps) {
  const { organizationId } = useCurrentOrganization();
  const [property, setProperty] = useState<LocalProperty | null>(null);
  const [hasActiveLease, setHasActiveLease] = useState(false);
  const [loading, setLoading] = useState(true);

  // Charger les données du bien et vérifier les baux actifs (PASSIF - ne modifie jamais l'URL)
  useEffect(() => {
    if (!propertyId || !organizationId) {
      setProperty(null);
      setHasActiveLease(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadPropertyAndLeases() {
      try {
        setLoading(true);
        const propRepo = getPropertyRepositoryOffline();
        const leaseRepo = getLeaseRepositoryOffline();
        
        // Charger le bien
        const prop = await propRepo.getById(propertyId, organizationId);
        
        if (!cancelled && prop) {
          setProperty(prop);
          
          // Charger les baux actifs pour ce bien
          const activeLeases = await leaseRepo.getActiveByProperty(propertyId, organizationId);
          const hasActive = activeLeases.length > 0;
          setHasActiveLease(hasActive);
        }
      } catch (error) {
        console.error('[PropertyContextCard] Erreur chargement bien/baux:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPropertyAndLeases();

    return () => {
      cancelled = true;
    };
  }, [propertyId, organizationId]);

  if (loading) {
    return (
      <div className="px-3 py-2.5 bg-transparent rounded-lg border-2 border-orange-300 shadow-sm">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-orange-600 animate-pulse" />
          <span className="text-xs text-orange-700 font-medium">Chargement...</span>
        </div>
      </div>
    );
  }

  if (!property) {
    return null;
  }

  // Construire l'adresse courte (rue + ville)
  const addressShort = property.address && property.city
    ? `${property.address} · ${property.city}`
    : property.address || property.city || '';

  const statusBadge = getStatusBadge(property, hasActiveLease);

  return (
    <div className="px-3 py-2.5 bg-transparent rounded-lg border-2 border-orange-400 mb-3 relative property-context-border">
      
      {/* Label "Contexte actif" */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-orange-700 uppercase tracking-wider">
          Contexte actif
        </span>
        {statusBadge}
      </div>

      {/* Ligne principale : Nom du bien */}
      <div className="flex items-center gap-1.5 min-w-0 mb-1.5">
        <Building2 className="h-4 w-4 flex-shrink-0 text-orange-600" />
        <span className="font-bold text-sm text-gray-900 truncate">
          {property.name || 'Bien sans nom'}
        </span>
      </div>

      {/* Ligne secondaire : Adresse */}
      {addressShort && (
        <div className="text-xs text-gray-600 mb-2 truncate pl-5.5">
          {addressShort}
        </div>
      )}

      {/* Action : Changer */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // ✅ Ouvrir le switcher (100% passif, aucune navigation)
          onOpenSwitcher();
        }}
        className={cn(
          'flex items-center gap-1 text-xs font-medium text-orange-700 hover:text-orange-900 transition-colors',
          'pl-5.5 py-1 -mx-1 px-1 rounded-md hover:bg-orange-200/60 border border-transparent hover:border-orange-300'
        )}
        type="button"
      >
        Changer
        <ChevronDown className="h-3 w-3" />
      </button>
    </div>
  );
}

