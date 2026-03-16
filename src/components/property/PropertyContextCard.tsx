'use client';

import React, { useState, useEffect } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import { getLoanRepositoryOffline } from '@/lib/offline/repositories/LoanRepositoryOffline';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import type { LocalProperty, LocalLease, LocalLoan } from '@/lib/offline/db';
import { cn } from '@/utils/cn';
import { Badge } from '@/components/ui/Badge';

/** Mensualité d'un prêt (formule standard) */
function monthlyPayment(principal: number, annualRatePct: number, durationMonths: number): number {
  if (durationMonths <= 0 || principal <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r < 1e-10) return principal / durationMonths;
  const n = durationMonths;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

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
  const [leases, setLeases] = useState<LocalLease[]>([]);
  const [loans, setLoans] = useState<LocalLoan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!propertyId || !organizationId) {
      setProperty(null);
      setLeases([]);
      setLoans([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const propRepo = getPropertyRepositoryOffline();
        const leaseRepo = getLeaseRepositoryOffline();
        const loanRepo = getLoanRepositoryOffline();

        const [prop, allLeases, activeLoans] = await Promise.all([
          propRepo.getById(propertyId, organizationId),
          leaseRepo.getAll(organizationId, { propertyId }),
          loanRepo.getActiveByProperty(propertyId, organizationId),
        ]);

        if (!cancelled) {
          setProperty(prop || null);
          setLeases(allLeases || []);
          setLoans(activeLoans || []);
        }
      } catch (error) {
        console.error('[PropertyContextCard] Erreur chargement:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [propertyId, organizationId]);

  const hasActiveLease = leases.some((l) => l.status === 'ACTIF');
  const activeLeases = leases.filter((l) => l.status === 'ACTIF');
  const lotsCount = leases.length;
  const monthlyRent = activeLeases.reduce((s, l) => s + (l.rentAmount || 0), 0);
  const monthlyLoanTotal = loans.reduce(
    (s, loan) => s + monthlyPayment(loan.principal, loan.annualRatePct || 0, loan.durationMonths || 1),
    0
  );
  const cashflowMonthly = monthlyRent - monthlyLoanTotal;
  const value = (property?.currentValue ?? property?.acquisitionPrice ?? 0) || 1;
  const rendementBrut = value > 0 ? (monthlyRent * 12 / value) * 100 : 0;

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

      {/* Indicateurs : lots, cashflow, rendement */}
      <div className="space-y-1 mb-2 pl-5.5 text-xs text-gray-600">
        {lotsCount > 0 && (
          <div>{lotsCount} lot{lotsCount > 1 ? 's' : ''}</div>
        )}
        {monthlyRent > 0 && (
          <div>
            Cashflow :{' '}
            <span className={cashflowMonthly >= 0 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
              {cashflowMonthly >= 0 ? '+' : ''}{Math.round(cashflowMonthly).toLocaleString('fr-FR')} €
            </span>
          </div>
        )}
        {rendementBrut > 0 && value > 0 && (
          <div>Rendement : <span className="font-medium text-gray-700">{rendementBrut.toFixed(1)} %</span></div>
        )}
      </div>

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

