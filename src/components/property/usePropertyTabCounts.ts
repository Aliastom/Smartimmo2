'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { getLocalDB } from '@/lib/offline/db';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import { getEcheanceRepositoryOffline } from '@/lib/offline/repositories/EcheanceRepositoryOffline';
import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import { getLoanRepositoryOffline } from '@/lib/offline/repositories/LoanRepositoryOffline';

export interface PropertyTabCounts {
  transactions: number;
  documents: number;
  deadlines: number;
  lease: number;
  loans: number;
}

export function usePropertyTabCounts(propertyId: string): PropertyTabCounts {
  const { organizationId } = useCurrentOrganization();
  const [counts, setCounts] = useState<PropertyTabCounts>({
    transactions: 0,
    documents: 0,
    deadlines: 0,
    lease: 0,
    loans: 0,
  });

  // Fonction pour charger les compteurs (mémorisée avec useCallback)
  const loadCounts = useCallback(async (orgId: string, propId: string, signal?: AbortSignal) => {
    try {
      const db = await getLocalDB();
      const transRepo = getTransactionRepositoryOffline();
      const echeanceRepo = getEcheanceRepositoryOffline();

      // 1. Transactions : nombre de transactions pour ce bien
      const transactions = await transRepo.getAll(orgId, { propertyId: propId });
      if (signal?.aborted) return;
      const transactionsCount = transactions.length;

      // 2. Documents : nombre total de documents pour ce bien
      // Les documents peuvent être liés via propertyId OU via DocumentLink
      // Récupérer les documents liés via DocumentLink
      let documentIdsForProperty: Set<string> = new Set();
      
      try {
        // Essayer avec l'index composite
        const propertyLinks = await db.DocumentLink
          .where('[linkedType+linkedId]')
          .equals(['property', propId])
          .toArray();
        if (signal?.aborted) return;
        documentIdsForProperty = new Set(propertyLinks.map(link => link.documentId));
      } catch (err) {
        // Fallback: utiliser filter() si l'index composite ne fonctionne pas
        const allLinks = await db.DocumentLink.toArray();
        if (signal?.aborted) return;
        const propertyLinks = allLinks.filter(link => 
          link.linkedType?.toLowerCase() === 'property' && link.linkedId === propId
        );
        documentIdsForProperty = new Set(propertyLinks.map(link => link.documentId));
      }
      
      // Aussi chercher avec 'PROPERTY' en majuscules (au cas où)
      if (documentIdsForProperty.size === 0) {
        try {
          const propertyLinksUpper = await db.DocumentLink
            .where('[linkedType+linkedId]')
            .equals(['PROPERTY', propId])
            .toArray();
          if (signal?.aborted) return;
          documentIdsForProperty = new Set(propertyLinksUpper.map(link => link.documentId));
        } catch (err) {
          // Ignorer si l'index composite ne fonctionne pas
        }
      }
      
      // Récupérer tous les documents de l'organisation
      const allOrgDocuments = await db.Document
        .where('organizationId')
        .equals(orgId)
        .filter(d => !d.deletedAt)
        .toArray();
      if (signal?.aborted) return;
      
      // Filtrer les documents liés à cette propriété (via propertyId OU DocumentLink)
      const documentsForProperty = allOrgDocuments.filter(doc => 
        doc.propertyId === propId || documentIdsForProperty.has(doc.id)
      );
      
      const documentsCount = documentsForProperty.length;

      // 3. Échéances : nombre d'échéances proches (30 jours) ou en retard
      // On considère qu'une échéance est urgente si sa date de début est dans les 30 prochains jours ou en retard
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysFromNow = new Date(today);
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      const allEcheances = await echeanceRepo.getAll(orgId, { 
        propertyId: propId,
        isActive: true 
      });
      if (signal?.aborted) return;

      const urgentEcheances = allEcheances.filter(echeance => {
        if (!echeance.startAt) return false;
        const startDate = new Date(echeance.startAt);
        startDate.setHours(0, 0, 0, 0);
        // En retard (avant aujourd'hui) ou proche (dans les 30 prochains jours)
        return startDate <= thirtyDaysFromNow;
      });
      const deadlinesCount = urgentEcheances.length;

      // 4. Baux : nombre de baux pour ce bien
      const leaseRepo = getLeaseRepositoryOffline();
      const leases = await leaseRepo.getAll(orgId, { propertyId: propId });
      if (signal?.aborted) return;
      const leaseCount = leases.length;

      // 5. Prêts : nombre de prêts actifs pour ce bien
      const loanRepo = getLoanRepositoryOffline();
      const loans = await loanRepo.getAll(orgId, { propertyId: propId, isActive: true });
      if (signal?.aborted) return;
      const loansCount = loans.length;

      if (!signal?.aborted) {
        setCounts({
          transactions: transactionsCount,
          documents: documentsCount,
          deadlines: deadlinesCount,
          lease: leaseCount,
          loans: loansCount,
        });
      }
    } catch (error) {
      console.error('[usePropertyTabCounts] Erreur:', error);
      if (!signal?.aborted) {
        setCounts({
          transactions: 0,
          documents: 0,
          deadlines: 0,
          lease: 0,
          loans: 0,
        });
      }
    }
  }, []); // Pas de dépendances car setCounts est stable

  // Charger les compteurs au montage et quand organizationId ou propertyId change
  useEffect(() => {
    if (!organizationId || !propertyId) {
      return;
    }

    const abortController = new AbortController();
    loadCounts(organizationId, propertyId, abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [organizationId, propertyId, loadCounts]);

  // Ref pour stocker l'AbortController actuel des événements
  const abortControllerRef = useRef<AbortController | null>(null);

  // Écouter les événements de refresh pour mettre à jour les compteurs après les opérations CRUD
  useEffect(() => {
    if (!organizationId || !propertyId) {
      return;
    }

    const handleRefresh = (event: Event) => {
      // Filtrer les événements par propertyId si spécifié dans le payload
      if (event instanceof CustomEvent && event.detail) {
        const detail = event.detail as { scope?: string; propertyId?: string; reason?: string };
        // Si l'événement est ciblé sur une propriété spécifique, vérifier que c'est la bonne
        if (detail.scope === 'property' && detail.propertyId && detail.propertyId !== propertyId) {
          return; // Ignorer les événements pour d'autres propriétés
        }
      }

      // Annuler le chargement précédent s'il existe
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Recharger les compteurs
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      loadCounts(organizationId, propertyId, abortController.signal);
    };

    // Écouter tous les événements pertinents
    window.addEventListener('sync:refresh', handleRefresh);
    window.addEventListener('transactions:refresh', handleRefresh);
    window.addEventListener('documents:refresh', handleRefresh);
    window.addEventListener('deadlines:refresh', handleRefresh);
    window.addEventListener('echeances:refresh', handleRefresh);
    window.addEventListener('leases:refresh', handleRefresh);
    window.addEventListener('loans:refresh', handleRefresh);

    return () => {
      // Annuler le chargement en cours lors du démontage
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      window.removeEventListener('sync:refresh', handleRefresh);
      window.removeEventListener('transactions:refresh', handleRefresh);
      window.removeEventListener('documents:refresh', handleRefresh);
      window.removeEventListener('deadlines:refresh', handleRefresh);
      window.removeEventListener('echeances:refresh', handleRefresh);
      window.removeEventListener('leases:refresh', handleRefresh);
      window.removeEventListener('loans:refresh', handleRefresh);
    };
  }, [organizationId, propertyId, loadCounts]);

  return counts;
}

