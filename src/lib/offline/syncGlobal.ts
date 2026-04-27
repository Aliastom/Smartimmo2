/**
 * Service de synchronisation global pour toutes les entités
 * Gère la sync distante → locale et locale → distante pour toutes les tables
 */

import { getLocalDB } from './db';
import { PendingOperation, SyncMeta } from './types';
import type { SyncResult } from './sync';
import { logToServer } from '@/lib/utils/logger';
import { notify2 } from '@/lib/notify2';
import {
  classifySmartimmoId,
  getLeaseSignatureDiagLeaseId,
  logLeaseSignWorkflowDiag,
  setLeaseSignatureDiagRemoteLeaseMapping,
  summarizeFkPair,
} from './leaseSignatureWorkflowDiag';

export interface EntitySyncConfig {
  entity: string; // 'property', 'lease', 'tenant', etc.
  tableName: keyof ReturnType<typeof getLocalDB>; // Table IndexedDB
  apiRoute: string; // Route API de base
  apiRouteById?: string; // Route API pour un item spécifique (ex: '/api/properties/:id')
  transformToLocal?: (item: any) => any; // Transformation API → Local
  transformToRemote?: (item: any) => any; // Transformation Local → API
}

/**
 * Configuration de synchronisation pour chaque entité
 */
const ENTITY_CONFIGS: EntitySyncConfig[] = [
  {
    entity: 'property',
    tableName: 'Property',
    apiRoute: '/api/properties',
    apiRouteById: '/api/properties/:id',
    transformToLocal: (item: any) => ({
      ...item,
      acquisitionDate: item.acquisitionDate ? new Date(item.acquisitionDate).toISOString() : new Date().toISOString(),
      archivedAt: item.archivedAt ? new Date(item.archivedAt).toISOString() : null,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
      evalDate: item.evalDate ? new Date(item.evalDate).toISOString() : null,
    }),
    transformToRemote: (item: any) => {
      // Nettoyer le payload pour correspondre EXACTEMENT au schéma Zod de l'API
      // Le schéma accepte uniquement :
      // name, type, address, postalCode, city, surface, rooms, acquisitionDate,
      // acquisitionPrice, notaryFees, currentValue, status (optional), occupation (optional),
      // notes (optional), managementCompanyId (optional), fiscalTypeId (optional),
      // fiscalRegimeId (optional), rentalMode (optional), airbnbListingId (optional)
      
      // Retirer TOUS les champs qui ne sont pas dans le schéma
      const {
        _localUpdatedAt,
        _syncedAt,
        organizationId,
        id, // Retirer l'ID (sera exclu ensuite dans createRemote)
        statusMode,
        statusManual,
        evalSource,
        evalDate,
        exitFeesRate,
        isArchived,
        archivedAt,
        createdAt,
        updatedAt,
        ...rest
      } = item;
      
      // Construire le payload EXACTEMENT comme PropertyForm le fait quand il envoie à l'API
      // PropertyForm envoie les données validées par propertySchema qui correspondent au createPropertySchema de l'API
      const cleanItem: any = {
        name: rest.name || '',
        type: rest.type || 'apartment',
        address: rest.address || '',
        postalCode: rest.postalCode || '',
        city: rest.city || '',
        surface: Number(rest.surface || 0),
        rooms: Number(rest.rooms || 0),
        // acquisitionDate doit être une string ISO (comme PropertyForm le fait)
        acquisitionDate: typeof rest.acquisitionDate === 'string' 
          ? rest.acquisitionDate 
          : new Date(rest.acquisitionDate || new Date()).toISOString(),
        acquisitionPrice: Number(rest.acquisitionPrice || 0),
        notaryFees: Number(rest.notaryFees || 0),
        currentValue: Number(rest.currentValue || 0),
      };
      
      // Ajouter les champs optionnels (exactement comme dans le schéma Zod)
      // IMPORTANT: En Zod, `.optional()` signifie que le champ peut être `undefined` ou omis,
      // mais PAS `null`. Si on envoie `null`, Zod rejette avec "Expected string, received null".
      // Solution: omettre complètement les champs qui seraient `null` au lieu de les inclure.
      
      // status: z.string().optional()
      if (rest.status !== undefined && rest.status !== null && rest.status !== '') {
        cleanItem.status = String(rest.status);
      }
      
      // occupation: z.string().optional()
      if (rest.occupation !== undefined && rest.occupation !== null && rest.occupation !== '') {
        cleanItem.occupation = String(rest.occupation);
      }
      
      // notes: z.string().optional()
      if (rest.notes !== undefined && rest.notes !== null && rest.notes !== '') {
        cleanItem.notes = String(rest.notes);
      }
      
      // managementCompanyId: z.string().optional()
      // OMETTRE si null/undefined/vide (ne JAMAIS envoyer null)
      if (rest.managementCompanyId && rest.managementCompanyId !== '') {
        cleanItem.managementCompanyId = String(rest.managementCompanyId);
      }
      // Sinon, on n'inclut pas le champ (undefined = omis en JSON)
      
      // fiscalTypeId: z.string().optional()
      // OMETTRE si null/undefined/vide (ne JAMAIS envoyer null)
      if (rest.fiscalTypeId && rest.fiscalTypeId !== '') {
        cleanItem.fiscalTypeId = String(rest.fiscalTypeId);
      }
      
      // fiscalRegimeId: z.string().optional()
      // OMETTRE si null/undefined/vide (ne JAMAIS envoyer null)
      if (rest.fiscalRegimeId && rest.fiscalRegimeId !== '') {
        cleanItem.fiscalRegimeId = String(rest.fiscalRegimeId);
      }

      // lmnpActivityId: z.string().optional()
      // OMETTRE si null/undefined/vide (ne JAMAIS envoyer null)
      if (rest.lmnpActivityId && rest.lmnpActivityId !== '') {
        cleanItem.lmnpActivityId = String(rest.lmnpActivityId);
      }
      
      // rentalMode: z.enum(['LONG_TERM', 'SEASONAL_AIRBNB']).optional()
      // Valeur par défaut 'LONG_TERM' comme dans l'API (ligne 76)
      cleanItem.rentalMode = (rest.rentalMode === 'LONG_TERM' || rest.rentalMode === 'SEASONAL_AIRBNB')
        ? rest.rentalMode
        : 'LONG_TERM';
      
      // airbnbListingId: z.string().optional()
      // OMETTRE si null/undefined/vide (ne JAMAIS envoyer null)
      if (rest.airbnbListingId && rest.airbnbListingId !== '') {
        cleanItem.airbnbListingId = String(rest.airbnbListingId);
      }
      
      return cleanItem;
    },
  },
  {
    entity: 'lease',
    tableName: 'Lease',
    apiRoute: '/api/leases',
    apiRouteById: '/api/leases/:id',
    transformToLocal: (item: any) => ({
      ...item,
      startDate: item.startDate ? new Date(item.startDate).toISOString() : new Date().toISOString(),
      endDate: item.endDate ? new Date(item.endDate).toISOString() : null,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
    }),
    transformToRemote: (item: any) => {
      // ✅ Nettoyer le payload pour correspondre EXACTEMENT au schéma Zod de l'API
      // ⚠️ IMPORTANT: Pour UPDATE, le payload contient seulement les champs modifiés
      // Le schéma updateLeaseSchema accepte TOUS les champs comme optionnels
      // On doit donc construire un objet avec seulement les champs présents dans le payload
      
      const { 
        id, 
        organizationId, 
        createdAt, 
        updatedAt, 
        signedPdfUrl,
        _localUpdatedAt,
        _syncedAt,
        ...rest 
      } = item;
      
      // ⚠️ CRITIQUE: Construire un objet vide et ajouter seulement les champs présents
      // (comme pour document) pour supporter les updates partiels (ex: seulement status)
      const cleanItem: any = {};
      
      // Champs qui peuvent être présents dans un UPDATE
      if (rest.propertyId !== null && rest.propertyId !== undefined) {
        cleanItem.propertyId = rest.propertyId;
      }
      
      if (rest.tenantId !== null && rest.tenantId !== undefined) {
        cleanItem.tenantId = rest.tenantId;
      }
      
      if (rest.type !== null && rest.type !== undefined) {
        cleanItem.type = rest.type;
      }
      
      if (rest.startDate !== null && rest.startDate !== undefined) {
        cleanItem.startDate = typeof rest.startDate === 'string' 
          ? rest.startDate 
          : new Date(rest.startDate).toISOString().split('T')[0];
      }
      
      if (rest.rentAmount !== null && rest.rentAmount !== undefined) {
        cleanItem.rentAmount = Number(rest.rentAmount);
      }
      
      if (rest.furnishedType !== null && rest.furnishedType !== undefined) {
        cleanItem.furnishedType = rest.furnishedType;
      }
      
      if (rest.endDate !== null && rest.endDate !== undefined) {
        cleanItem.endDate = typeof rest.endDate === 'string' 
          ? rest.endDate 
          : new Date(rest.endDate).toISOString().split('T')[0];
      }
      
      if (rest.deposit !== null && rest.deposit !== undefined) {
        cleanItem.deposit = Number(rest.deposit);
      }
      
      if (rest.paymentDay !== null && rest.paymentDay !== undefined) {
        cleanItem.paymentDay = Number(rest.paymentDay);
      }
      
      if (rest.indexationType !== null && rest.indexationType !== undefined && rest.indexationType !== 'AUCUNE') {
        // Convertir 'AUCUNE' en 'none' pour correspondre au schéma Zod
        cleanItem.indexationType = rest.indexationType === 'AUCUNE' ? 'none' : rest.indexationType;
      }
      
      if (rest.notes !== null && rest.notes !== undefined && rest.notes.trim() !== '') {
        cleanItem.notes = rest.notes;
      }
      
      if (rest.status !== null && rest.status !== undefined) {
        cleanItem.status = rest.status;
      }
      
      if (rest.chargesRecupMensuelles !== null && rest.chargesRecupMensuelles !== undefined) {
        cleanItem.chargesRecupMensuelles = Number(rest.chargesRecupMensuelles);
      }
      
      if (rest.chargesNonRecupMensuelles !== null && rest.chargesNonRecupMensuelles !== undefined) {
        cleanItem.chargesNonRecupMensuelles = Number(rest.chargesNonRecupMensuelles);
      }

      if (rest.pilotageIgnored !== null && rest.pilotageIgnored !== undefined) {
        cleanItem.pilotageIgnored = Boolean(rest.pilotageIgnored);
      }
      
      return cleanItem;
    },
  },
  {
    entity: 'tenant',
    tableName: 'Tenant',
    apiRoute: '/api/tenants',
    apiRouteById: '/api/tenants/:id',
    transformToLocal: (item: any) => ({
      ...item,
      birthDate: item.birthDate ? new Date(item.birthDate).toISOString() : null,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
    }),
  },
  {
    entity: 'userProfile',
    tableName: 'UserProfile',
    apiRoute: '/api/profiles',
    apiRouteById: '/api/profiles/:id',
    transformToLocal: (item: any) => ({
      ...item,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
    }),
    transformToRemote: (item: any) => {
      // Nettoyer le payload pour correspondre au schéma de l'API
      const { _localUpdatedAt, _syncedAt, organizationId, id, createdAt, updatedAt, ...rest } = item;
      
      // Construire le payload avec seulement les champs modifiables
      // ⚠️ IMPORTANT: Le schéma Zod attend string | undefined, pas null
      // Pour les champs optionnels, on envoie undefined si null/vide, ou la string si présente
      const cleanItem: any = {};
      
      if (rest.firstName !== undefined) cleanItem.firstName = rest.firstName || '';
      if (rest.lastName !== undefined) cleanItem.lastName = rest.lastName || '';
      if (rest.email !== undefined) cleanItem.email = rest.email || '';
      
      // Champs optionnels : convertir null/undefined en omettant la propriété (Zod attend string | undefined, pas null)
      // JSON.stringify() omet automatiquement les propriétés undefined, ce qui est parfait pour Zod .optional()
      if (rest.phone !== undefined && rest.phone !== null) cleanItem.phone = rest.phone;
      if (rest.address !== undefined && rest.address !== null) cleanItem.address = rest.address;
      if (rest.city !== undefined && rest.city !== null) cleanItem.city = rest.city;
      if (rest.postalCode !== undefined && rest.postalCode !== null) cleanItem.postalCode = rest.postalCode;
      if (rest.company !== undefined && rest.company !== null) cleanItem.company = rest.company;
      if (rest.siret !== undefined && rest.siret !== null) cleanItem.siret = rest.siret;
      if (rest.signature !== undefined && rest.signature !== null) cleanItem.signature = rest.signature;
      if (rest.logo !== undefined && rest.logo !== null) cleanItem.logo = rest.logo;
      
      return cleanItem;
    },
  },
  {
    entity: 'loan',
    tableName: 'Loan',
    apiRoute: '/api/loans',
    apiRouteById: '/api/loans/:id',
    transformToLocal: (item: any) => ({
      ...item,
      principal: typeof item.principal === 'object' ? parseFloat(item.principal.toString()) : item.principal,
      annualRatePct: typeof item.annualRatePct === 'object' ? parseFloat(item.annualRatePct.toString()) : item.annualRatePct,
      insurancePct: typeof item.insurancePct === 'object' && item.insurancePct ? parseFloat(item.insurancePct.toString()) : item.insurancePct,
      feesUpfront: typeof item.feesUpfront === 'object' && item.feesUpfront ? parseFloat(item.feesUpfront.toString()) : item.feesUpfront,
      startDate: item.startDate ? new Date(item.startDate).toISOString() : new Date().toISOString(),
      endDate: item.endDate ? new Date(item.endDate).toISOString() : null,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
    }),
    transformToRemote: (item: any) => {
      // ✅ Nettoyer le payload pour correspondre EXACTEMENT au schéma Zod de l'API
      // Le schéma createLoanSchema attend :
      // - startDate: z.string().datetime() (ISO datetime string)
      // - Les autres champs selon le schéma
      // ⚠️ IMPORTANT: Conserver stagedDocumentIds et stagedLinkItemIds si présents (venant du payload de la pendingOp)
      
      const {
        id,
        organizationId,
        createdAt,
        updatedAt,
        _localUpdatedAt,
        _syncedAt,
        endDate, // endDate est calculé, pas dans le schéma de création
        stagedDocumentIds, // ✅ Conserver pour l'API
        stagedLinkItemIds, // ✅ Conserver pour l'API
        ...rest
      } = item;
      
      // Construire le payload EXACTEMENT comme le schéma Zod l'attend
      const cleanItem: any = {
        propertyId: rest.propertyId || '',
        label: rest.label || '',
        principal: Number(rest.principal || 0),
        annualRatePct: Number(rest.annualRatePct || 0),
        durationMonths: Number(rest.durationMonths || 0),
        defermentMonths: Number(rest.defermentMonths || 0),
        isActive: rest.isActive !== undefined ? Boolean(rest.isActive) : true,
      };
      
      // ✅ Conserver stagedDocumentIds et stagedLinkItemIds si présents (venant du payload de la pendingOp)
      if (stagedDocumentIds && Array.isArray(stagedDocumentIds) && stagedDocumentIds.length > 0) {
        cleanItem.stagedDocumentIds = stagedDocumentIds;
      }
      if (stagedLinkItemIds && Array.isArray(stagedLinkItemIds) && stagedLinkItemIds.length > 0) {
        cleanItem.stagedLinkItemIds = stagedLinkItemIds;
      }
      
      // startDate doit être une string ISO datetime (z.string().datetime())
      if (rest.startDate) {
        // Si c'est déjà une string ISO, l'utiliser telle quelle
        // Sinon, convertir en ISO datetime string
        if (typeof rest.startDate === 'string') {
          // Vérifier si c'est déjà au format ISO datetime
          if (rest.startDate.includes('T')) {
            cleanItem.startDate = rest.startDate;
          } else {
            // Si c'est juste une date (YYYY-MM-DD), convertir en datetime
            cleanItem.startDate = new Date(rest.startDate).toISOString();
          }
        } else {
          cleanItem.startDate = new Date(rest.startDate).toISOString();
        }
      } else {
        cleanItem.startDate = new Date().toISOString();
      }
      
      // Champs optionnels (omettre si null/undefined)
      if (rest.insurancePct !== null && rest.insurancePct !== undefined) {
        cleanItem.insurancePct = Number(rest.insurancePct);
      }
      
      if (rest.feesUpfront !== null && rest.feesUpfront !== undefined) {
        cleanItem.feesUpfront = Number(rest.feesUpfront);
      }
      
      if (rest.paymentDay !== null && rest.paymentDay !== undefined) {
        cleanItem.paymentDay = Number(rest.paymentDay);
      }
      
      if (rest.rateType !== null && rest.rateType !== undefined) {
        cleanItem.rateType = rest.rateType;
      }
      
      if (rest.loanType !== null && rest.loanType !== undefined && rest.loanType !== '') {
        cleanItem.loanType = rest.loanType;
      }
      
      if (rest.repaymentType !== null && rest.repaymentType !== undefined && rest.repaymentType !== '') {
        cleanItem.repaymentType = rest.repaymentType;
      }
      
      if (rest.amortizationProfile !== null && rest.amortizationProfile !== undefined && rest.amortizationProfile !== '') {
        cleanItem.amortizationProfile = rest.amortizationProfile;
      }
      
      if (rest.notes !== null && rest.notes !== undefined && rest.notes !== '') {
        cleanItem.notes = rest.notes;
      }
      
      // borrowers est optionnel (array)
      if (rest.borrowers && Array.isArray(rest.borrowers) && rest.borrowers.length > 0) {
        cleanItem.borrowers = rest.borrowers.map((borrower: any) => ({
          firstName: borrower.firstName || '',
          lastName: borrower.lastName || '',
          birthDate: borrower.birthDate || null,
          email: borrower.email || null,
          phone: borrower.phone || null,
          responsibilityPct: borrower.responsibilityPct ? Number(borrower.responsibilityPct) : null,
        }));
      }
      
      return cleanItem;
    },
  },
  {
    entity: 'loanBorrower',
    tableName: 'LoanBorrower',
    apiRoute: '/api/loans/:loanId/borrowers',
    apiRouteById: '/api/loans/borrowers/:id',
    transformToLocal: (item: any) => ({
      ...item,
      birthDate: item.birthDate ? new Date(item.birthDate).toISOString() : null,
      responsibilityPct: typeof item.responsibilityPct === 'object' && item.responsibilityPct ? parseFloat(item.responsibilityPct.toString()) : item.responsibilityPct,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
    }),
    transformToRemote: (item: any) => {
      const {
        id,
        organizationId,
        createdAt,
        updatedAt,
        _localUpdatedAt,
        _syncedAt,
        loanId, // loanId est dans l'URL, pas dans le payload
        ...rest
      } = item;

      const cleanItem: any = {
        firstName: rest.firstName,
        lastName: rest.lastName,
      };

      // Optional fields
      if (rest.birthDate !== undefined && rest.birthDate !== null) {
        cleanItem.birthDate = new Date(rest.birthDate).toISOString();
      }
      if (rest.email !== undefined && rest.email !== null && rest.email !== '') {
        cleanItem.email = rest.email;
      }
      if (rest.phone !== undefined && rest.phone !== null && rest.phone !== '') {
        cleanItem.phone = rest.phone;
      }
      if (rest.responsibilityPct !== undefined && rest.responsibilityPct !== null) {
        cleanItem.responsibilityPct = Number(rest.responsibilityPct);
      }

      return cleanItem;
    },
  },
  {
    entity: 'marketInvestmentSettings',
    tableName: 'InvestmentSettings',
    apiRoute: '/api/market/settings',
    apiRouteById: '/api/market/settings/:id',
    transformToLocal: (item: any) => ({
      ...item,
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
      _syncedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
    }),
    transformToRemote: (item: any) => {
      const { _localUpdatedAt, _syncedAt, createdAt, organizationId, ...rest } = item;
      return {
        ...rest,
        updatedAt: rest.updatedAt ? new Date(rest.updatedAt).toISOString() : new Date().toISOString(),
      };
    },
  },
  {
    entity: 'marketInvestmentActionLog',
    tableName: 'InvestmentActionLog',
    apiRoute: '/api/market/actions',
    apiRouteById: '/api/market/actions/:id',
    transformToLocal: (item: any) => ({
      ...item,
      date: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
      _syncedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
    }),
    transformToRemote: (item: any) => {
      const { _localUpdatedAt, _syncedAt, createdAt, organizationId, ...rest } = item;
      return {
        ...rest,
        date: rest.date ? new Date(rest.date).toISOString() : new Date().toISOString(),
        updatedAt: rest.updatedAt ? new Date(rest.updatedAt).toISOString() : new Date().toISOString(),
      };
    },
  },
  // Payment table removed - replaced by Transaction table
  // {
  //   entity: 'payment',
  //   tableName: 'Payment',
  //   apiRoute: '/api/payments',
  //   apiRouteById: '/api/payments/:id',
  //   transformToLocal: (item: any) => ({
  //     ...item,
  //     date: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
  //     createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
  //     updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
  //   }),
  // },
  {
    entity: 'transaction',
    tableName: 'Transaction',
    apiRoute: '/api/transactions',
    apiRouteById: '/api/transactions/:id',
    transformToLocal: (item: any) => {
      // Extraire la clé de la nature depuis l'objet nature (si présent)
      let natureKey = item.nature;
      if (item.nature && typeof item.nature === 'object') {
        natureKey = item.nature.id || item.nature.code || item.nature.key || item.nature;
      }
      
      // ⚙️ NORMALISATION paidAt: Supabase peut renvoyer un format timestamp SQL "2025-12-22 00:00:00"
      // Il faut le convertir en ISO string pour IndexedDB
      let normalizedPaidAt: string | null = null;
      if (item.paidAt) {
        try {
          if (typeof item.paidAt === 'string') {
            // Si c'est déjà une string ISO avec 'T', utiliser directement
            if (item.paidAt.includes('T')) {
              normalizedPaidAt = new Date(item.paidAt).toISOString();
            } else {
              // Format timestamp SQL "2025-12-22 00:00:00" ou "2025-12-22 00:00:00.000"
              // Remplacer l'espace par 'T' et ajouter 'Z' si pas de timezone
              let isoString = item.paidAt.trim().replace(' ', 'T');
              // Si pas de timezone (pas de + ou Z), ajouter Z
              if (!isoString.includes('+') && !isoString.includes('Z') && !isoString.includes('-', 10)) {
                isoString = isoString + 'Z';
              }
              const dateObj = new Date(isoString);
              // Vérifier que la date est valide
              if (!isNaN(dateObj.getTime())) {
                normalizedPaidAt = dateObj.toISOString();
              } else {
                console.warn('[GlobalSync] paidAt invalide après conversion:', item.paidAt, '->', isoString);
                normalizedPaidAt = null;
              }
            }
          } else if (item.paidAt instanceof Date) {
            normalizedPaidAt = item.paidAt.toISOString();
          } else {
            // Autre type, essayer de parser
            normalizedPaidAt = new Date(item.paidAt).toISOString();
          }
        } catch (e) {
          console.error('[GlobalSync] Erreur conversion paidAt:', item.paidAt, e);
          normalizedPaidAt = null;
        }
      }
      
      // ⚙️ NORMALISATION dateRapprochement: Même traitement que paidAt
      let normalizedDateRapprochement: string | null = null;
      if (item.dateRapprochement) {
        try {
          if (typeof item.dateRapprochement === 'string') {
            if (item.dateRapprochement.includes('T')) {
              normalizedDateRapprochement = new Date(item.dateRapprochement).toISOString();
            } else {
              let isoString = item.dateRapprochement.trim().replace(' ', 'T');
              if (!isoString.includes('+') && !isoString.includes('Z') && !isoString.includes('-', 10)) {
                isoString = isoString + 'Z';
              }
              const dateObj = new Date(isoString);
              if (!isNaN(dateObj.getTime())) {
                normalizedDateRapprochement = dateObj.toISOString();
              }
            }
          } else if (item.dateRapprochement instanceof Date) {
            normalizedDateRapprochement = item.dateRapprochement.toISOString();
          } else {
            normalizedDateRapprochement = new Date(item.dateRapprochement).toISOString();
          }
        } catch (e) {
          console.error('[GlobalSync] Erreur conversion dateRapprochement:', item.dateRapprochement, e);
          normalizedDateRapprochement = null;
        }
      }

      return {
        ...item,
        // Champs string (copier tel quel, avec gestion null)
        id: item.id,
        organizationId: item.organizationId,
        propertyId: item.propertyId,
        leaseId: item.leaseId || null,
        bailId: item.bailId || null,
        categoryId: item.categoryId || null,
        label: item.label || '',
        reference: item.reference || null,
        notes: item.notes || null,
        source: item.source || 'MANUAL',
        idempotencyKey: item.idempotencyKey || null,
        externalId: item.externalId || null,
        externalType: item.externalType || null,
        bankRef: item.bankRef || null,
        autoSource: item.autoSource || null,
        method: item.method || null,
        managementCompanyId: item.managementCompanyId || null,
        // Champs numériques (conserver le type)
        amount: typeof item.amount === 'number' ? item.amount : parseFloat(item.amount || '0'),
        month: item.month !== null && item.month !== undefined ? Number(item.month) : null,
        year: item.year !== null && item.year !== undefined ? Number(item.year) : null,
        moisIndex: item.moisIndex !== null && item.moisIndex !== undefined ? Number(item.moisIndex) : null,
        moisTotal: item.moisTotal !== null && item.moisTotal !== undefined ? Number(item.moisTotal) : null,
        montantLoyer: item.montantLoyer !== null && item.montantLoyer !== undefined ? Number(item.montantLoyer) : null,
        chargesRecup: item.chargesRecup !== null && item.chargesRecup !== undefined ? Number(item.chargesRecup) : null,
        chargesNonRecup: item.chargesNonRecup !== null && item.chargesNonRecup !== undefined ? Number(item.chargesNonRecup) : null,
        // Champs booléens (conserver le type)
        isRecurring: item.isRecurring !== null && item.isRecurring !== undefined ? Boolean(item.isRecurring) : null,
        isAutoAmount: item.isAutoAmount !== null && item.isAutoAmount !== undefined ? Boolean(item.isAutoAmount) : null,
        isAuto: item.isAuto !== null && item.isAuto !== undefined ? Boolean(item.isAuto) : false,
        // Champs string spéciaux
        nature: natureKey, // ⚠️ CRITIQUE: S'assurer que nature est une string (clé), pas un objet
        accounting_month: item.accounting_month || item.accountingMonth || null, // ⚠️ CRITIQUE: Mapper accountingMonth (camelCase API) vers accounting_month (snake_case IndexedDB)
        monthsCovered: item.monthsCovered || null,
        rapprochementStatus: item.rapprochementStatus || item.status || 'non_rapprochee', // ⚠️ CRITIQUE: Ajouté pour les KPI Dashboard
        parentTransactionId: item.parentTransactionId || null,
        // Champs dates (convertir en ISO string)
        date: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
        paidAt: normalizedPaidAt, // ✅ Normalisé en format ISO string
        dateRapprochement: normalizedDateRapprochement, // ✅ Normalisé en format ISO string
        createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
      };
    },
    transformToRemote: (item: any) => {
      // ⚠️ CRITIQUE: Transformer accounting_month (snake_case IndexedDB) vers accountingMonth (camelCase API)
      // ⚠️ Exclure serverId (champ local uniquement, jamais envoyé au serveur)
      const { accounting_month, createdAt, updatedAt, _syncedAt, _localUpdatedAt, serverId, monthsCovered, paidAt, ...rest } = item;
      
      // ⚙️ NORMALISATION: Convertir paidAt en format ISO-8601 complet si c'est une string date (YYYY-MM-DD)
      // Prisma attend un format ISO-8601 DateTime complet (ex: "2025-12-17T00:00:00.000Z")
      let normalizedPaidAt = paidAt;
      if (paidAt !== null && paidAt !== undefined) {
        if (typeof paidAt === 'string' && paidAt.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Si c'est une date au format YYYY-MM-DD, ajouter l'heure pour en faire un ISO-8601 complet
          normalizedPaidAt = `${paidAt}T00:00:00.000Z`;
        } else if (typeof paidAt === 'string') {
          // Si c'est déjà une string ISO, s'assurer qu'elle est valide
          try {
            new Date(paidAt).toISOString(); // Vérifier que c'est valide
            normalizedPaidAt = paidAt;
          } catch {
            // Si invalide, essayer de la convertir
            normalizedPaidAt = new Date(paidAt).toISOString();
          }
        } else if (paidAt instanceof Date) {
          normalizedPaidAt = paidAt.toISOString();
        }
      }
      
      const isSeriesTransaction =
        (item.moisTotal !== null && item.moisTotal !== undefined && Number(item.moisTotal) > 1) ||
        (item.moisIndex !== null && item.moisIndex !== undefined && Number(item.moisIndex) > 1);

      return {
        ...rest,
        accountingMonth: accounting_month || null, // Mapper vers camelCase pour l'API
        // ⚠️ CRITIQUE: Si la transaction est déjà une occurrence d'une série (moisIndex/moisTotal),
        // ne pas redéclencher la création multi-mois côté serveur.
        monthsCovered: isSeriesTransaction
          ? '1'
          : (monthsCovered != null ? String(monthsCovered) : null),
        paidAt: normalizedPaidAt, // Normaliser paidAt en format ISO-8601 complet
        // Exclure les métadonnées de sync et serverId (local uniquement)
      };
    },
  },
  {
    entity: 'echeance',
    tableName: 'EcheanceRecurrente',
    apiRoute: '/api/echeances',
    apiRouteById: '/api/echeances/:id',
    transformToLocal: (item: any) => ({
      ...item,
      montant: typeof item.montant === 'object' ? parseFloat(item.montant.toString()) : item.montant,
      startAt: item.startAt ? new Date(item.startAt).toISOString() : new Date().toISOString(),
      endAt: item.endAt ? new Date(item.endAt).toISOString() : null,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
    }),
    transformToRemote: (item: any) => {
      // ✅ Nettoyer le payload pour l'API (enlever les champs internes)
      const { _localUpdatedAt, _syncedAt, organizationId, id, createdAt, updatedAt, ...rest } = item;
      
      // Pour UPDATE, l'API PATCH attend seulement les champs modifiés
      // Le payload de pendingOp contient déjà seulement les champs modifiés (isActive, etc.)
      // Mais on nettoie quand même pour être sûr
      return rest;
    },
  },
  // Tables de référence (admin/globales) - pas de transformToRemote car en lecture seule
  {
    entity: 'nature',
    tableName: 'NatureEntity',
    apiRoute: '/api/admin/natures',
    apiRouteById: '/api/admin/natures/:id',
    transformToLocal: (item: any) => ({
      ...item,
      cachedAt: new Date().toISOString(),
    }),
  },
  {
    entity: 'category',
    tableName: 'Category',
    apiRoute: '/api/accounting/categories',
    apiRouteById: '/api/accounting/categories/:id',
    transformToLocal: (item: any) => ({
      ...item,
      cachedAt: new Date().toISOString(),
    }),
  },
  {
    entity: 'signal',
    tableName: 'Signal',
    apiRoute: '/api/admin/signals',
    apiRouteById: '/api/admin/signals/:id',
    transformToLocal: (item: any) => ({
      id: item.id || item.code,
      code: item.code || item.id,
      label: item.label || item.name,
      category: item.category || null,
      isActive: item.isActive !== false,
      cachedAt: new Date().toISOString(),
    }),
  },
  {
    entity: 'documentType',
    tableName: 'DocumentType',
    apiRoute: '/api/document-types',
    apiRouteById: '/api/document-types/:id',
    transformToLocal: (item: any) => ({
      id: item.id || item.code,
      code: item.code || item.id,
      label: item.label || item.name,
      category: item.category || item.scope || null,
      isActive: item.isActive !== false,
      openTransaction: item.openTransaction || false, // ✅ Récupérer le champ openTransaction depuis l'API
      cachedAt: new Date().toISOString(),
    }),
  },
  {
    entity: 'fiscalType',
    tableName: 'FiscalType',
    apiRoute: '/api/admin/tax/types?active=true',
    apiRouteById: '/api/admin/tax/types/:id',
    transformToLocal: (item: any) => ({
      ...item,
      cachedAt: new Date().toISOString(),
    }),
  },
  {
    entity: 'fiscalRegime',
    tableName: 'FiscalRegime',
    apiRoute: '/api/admin/tax/regimes?active=true',
    apiRouteById: '/api/admin/tax/regimes/:id',
    transformToLocal: (item: any) => ({
      ...item,
      cachedAt: new Date().toISOString(),
    }),
  },
  {
    entity: 'fiscalCompatibility',
    tableName: 'FiscalCompatibility',
    apiRoute: '/api/admin/tax/compat',
    apiRouteById: '/api/admin/tax/compat/:id',
    transformToLocal: (item: any) => ({
      ...item,
      cachedAt: new Date().toISOString(),
    }),
  },
  {
    entity: 'managementCompany',
    tableName: 'ManagementCompany',
    apiRoute: '/api/gestion/societes',
    apiRouteById: '/api/gestion/societes/:id',
    transformToLocal: (item: any) => ({
      ...item,
      cachedAt: new Date().toISOString(),
    }),
  },
  {
    entity: 'fiscalSimulation',
    tableName: 'FiscalSimulation',
    apiRoute: '/api/fiscal/simulations',
    apiRouteById: '/api/fiscal/simulations/:id',
    transformToLocal: (item: any) => ({
      ...item,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
    }),
  },
  {
    entity: 'document',
    tableName: 'Document',
    apiRoute: '/api/documents',
    apiRouteById: '/api/documents/:id',
    transformToLocal: (item: any) => ({
      ...item,
      uploadedAt: item.uploadedAt ? new Date(item.uploadedAt).toISOString() : new Date().toISOString(),
      deletedAt: item.deletedAt ? new Date(item.deletedAt).toISOString() : null,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
    }),
    transformToRemote: (item: any) => {
      // ⚠️ DOCUMENT : Pour UPDATE, l'API attend seulement les champs modifiés
      // (filenameOriginal, chosenTypeId, etc.) - pas besoin de tout l'objet
      // Le payload de pendingOp contient déjà seulement les champs modifiés
      // Note: Le payload arrive directement depuis DocumentService.updateDocument
      // qui ne contient que les champs modifiés (filenameOriginal, documentTypeId, tags)
      // ⚠️ CRITIQUE: Le payload peut aussi contenir status='active' lors de la finalisation draft→active
      const { _localUpdatedAt, _syncedAt, organizationId, id, createdAt, updatedAt, ...rest } = item;
      
      // Ne garder que les champs modifiables via l'API
      // L'API attend chosenTypeId (pas documentTypeId) pour la mise à jour du type
      const cleanItem: any = {};
      if (rest.filenameOriginal !== undefined) {
        cleanItem.filenameOriginal = rest.filenameOriginal;
      }
      // ⚠️ IMPORTANT: L'API attend chosenTypeId (pas documentTypeId)
      if (rest.documentTypeId !== undefined || rest.chosenTypeId !== undefined) {
        cleanItem.chosenTypeId = rest.documentTypeId || rest.chosenTypeId;
      }
      if (rest.tags !== undefined) {
        cleanItem.tags = rest.tags;
      }
      // ⚠️ CRITIQUE: Inclure le status si présent dans le payload (draft→active)
      // Même si l'API PATCH ne le gère pas actuellement, on l'envoie pour cohérence
      // TODO: Vérifier si l'API PATCH doit gérer le status ou si on doit utiliser /api/documents/finalize
      if (rest.status !== undefined) {
        cleanItem.status = rest.status;
      }
      if (rest.isFavorite !== undefined) {
        cleanItem.isFavorite = rest.isFavorite;
      }
      
      return cleanItem;
    },
  },
  {
    entity: 'documentLink',
    tableName: 'DocumentLink',
    apiRoute: '/api/document-links',
    transformToLocal: (item: any) => ({
      documentId: item.documentId,
      linkedType: item.linkedType,
      linkedId: item.linkedId,
      entityName: item.entityName || null,
      _syncedAt: new Date().toISOString(),
    }),
    transformToRemote: (item: any) => {
      // ✅ Nettoyer le payload pour correspondre au schéma de l'API
      const { _localUpdatedAt, _syncedAt, ...rest } = item;
      
      return {
        documentId: rest.documentId,
        linkedType: rest.linkedType,
        linkedId: rest.linkedId,
      };
    },
  },
];

const SYNC_OVERWRITE_LOG_KEY = 'sync_overwrite_events';
const SYNC_OVERWRITE_LOG_LIMIT = 50;
const MARKET_SYNC_LWW_TOLERANCE_MS = 1_000;

type SyncOverwriteEvent = {
  timestamp: string;
  table: string;
  entity: string;
  pendingOpsCount: number;
  diffCount: number;
  sampleSize: number;
};

function recordSyncOverwriteEvent(event: SyncOverwriteEvent) {
  if (typeof window === 'undefined') return;
  try {
    const existingRaw = localStorage.getItem(SYNC_OVERWRITE_LOG_KEY);
    const existing: SyncOverwriteEvent[] = existingRaw ? JSON.parse(existingRaw) : [];
    const next = [event, ...existing].slice(0, SYNC_OVERWRITE_LOG_LIMIT);
    localStorage.setItem(SYNC_OVERWRITE_LOG_KEY, JSON.stringify(next));
  } catch {
    // Erreur silencieuse (ne pas bloquer la sync)
  }
}

/** Ms UTC pour comparer updatedAt local vs remote (ISO string, Date, nombre). */
function coerceEntityTimestampMs(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/**
 * Service de synchronisation global
 */
export class GlobalSyncService {
  private _dbPromise: Promise<any> | null = null;
  private _overwriteWarnings: Record<string, number> | null = null;
  /** >0 pendant syncAllFromRemote : évite un flush toast après chaque entité. */
  private _syncAllFromRemoteDepth = 0;

  private async getDb() {
    if (!this._dbPromise) {
      this._dbPromise = getLocalDB();
    }
    const db = await this._dbPromise;
    
    // ⚠️ CRITIQUE: Si la DB est indisponible, throw une erreur typée pour que la sync échoue rapidement
    if (!db) {
      throw new Error('DB_UNAVAILABLE: La base de données locale n\'est pas accessible');
    }
    
    return db;
  }

  private extractArrayPayload(data: any, entityKey: string): any[] {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.[entityKey])) return data[entityKey];
    return [];
  }

  /**
   * PR4 Marché — bootstrap migration local-only -> pendingOps.
   * Règle: si local est plus récent (LWW updatedAt), on push vers serveur ; sinon pull serveur gagne.
   */
  private async bootstrapMarketPendingOpsIfNeeded(organizationId: string): Promise<void> {
    const db = await this.getDb();

    const existingMarketOps = (
      await db.pendingOperations.where('status').anyOf(['pending', 'syncing', 'error']).toArray()
    ).filter(
      (op: PendingOperation) =>
        op.organizationId === organizationId &&
        (op.entity === 'marketInvestmentSettings' || op.entity === 'marketInvestmentActionLog')
    );
    if (existingMarketOps.length > 0) return;

    const [localSettings, localActions] = await Promise.all([
      db.InvestmentSettings.where('organizationId').equals(organizationId).toArray(),
      db.InvestmentActionLog.where('organizationId').equals(organizationId).toArray(),
    ]);

    if (localSettings.length === 0 && localActions.length === 0) return;

    const [remoteSettingsRes, remoteActionsRes] = await Promise.all([
      fetch('/api/market/settings'),
      fetch('/api/market/actions?limit=10000'),
    ]);
    if (!remoteSettingsRes.ok || !remoteActionsRes.ok) {
      // Non bloquant: la sync normale gère déjà les erreurs réseau/API.
      return;
    }

    const [remoteSettingsJson, remoteActionsJson] = await Promise.all([
      remoteSettingsRes.json(),
      remoteActionsRes.json(),
    ]);
    const remoteSettings = this.extractArrayPayload(remoteSettingsJson, 'marketInvestmentSettings').filter(
      (item: any) => item?.organizationId === organizationId
    );
    const remoteActions = this.extractArrayPayload(remoteActionsJson, 'marketInvestmentActionLog').filter(
      (item: any) => item?.organizationId === organizationId
    );

    const remoteSettingsById = new Map(remoteSettings.map((item: any) => [String(item.id), item]));
    const remoteActionsById = new Map(remoteActions.map((item: any) => [String(item.id), item]));

    const now = new Date().toISOString();
    const opsToCreate: PendingOperation[] = [];

    const enqueueIfNeeded = (
      entity: 'marketInvestmentSettings' | 'marketInvestmentActionLog',
      entityId: string,
      operation: 'create' | 'update',
      payload: Record<string, unknown>
    ) => {
      opsToCreate.push({
        id: crypto.randomUUID(),
        entity,
        entityId,
        operation,
        payload,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        retryCount: 0,
        organizationId,
      });
    };

    for (const local of localSettings) {
      const localId = String(local.id);
      const remote = remoteSettingsById.get(localId);
      if (!remote) {
        enqueueIfNeeded('marketInvestmentSettings', localId, 'create', local as Record<string, unknown>);
        continue;
      }
      const localMs = coerceEntityTimestampMs(local.updatedAt);
      const remoteMs = coerceEntityTimestampMs(remote.updatedAt);
      if (localMs != null && (remoteMs == null || localMs > remoteMs + MARKET_SYNC_LWW_TOLERANCE_MS)) {
        enqueueIfNeeded('marketInvestmentSettings', localId, 'update', local as Record<string, unknown>);
      }
    }

    for (const local of localActions) {
      const localId = String(local.id);
      const remote = remoteActionsById.get(localId);
      if (!remote) {
        enqueueIfNeeded('marketInvestmentActionLog', localId, 'create', local as Record<string, unknown>);
        continue;
      }
      const localMs = coerceEntityTimestampMs(local.updatedAt);
      const remoteMs = coerceEntityTimestampMs(remote.updatedAt);
      if (localMs != null && (remoteMs == null || localMs > remoteMs + MARKET_SYNC_LWW_TOLERANCE_MS)) {
        enqueueIfNeeded('marketInvestmentActionLog', localId, 'update', local as Record<string, unknown>);
      }
    }

    if (opsToCreate.length > 0) {
      await db.pendingOperations.bulkAdd(opsToCreate);
      logToServer(
        `[APP-SHELL][SYNC][MARKET][BOOTSTRAP] pendingOps ajoutées=${opsToCreate.length} (settings local=${localSettings.length}, actions local=${localActions.length}, settings remote=${remoteSettings.length}, actions remote=${remoteActions.length})`
      );
    }
  }

  private async markMarketEntitySyncedLocally(
    config: EntitySyncConfig,
    organizationId: string,
    entityId: string
  ): Promise<void> {
    const db = await this.getDb();
    const syncedAt = new Date().toISOString();

    if (config.entity === 'marketInvestmentSettings') {
      const row =
        (await db.InvestmentSettings.get([organizationId, entityId])) ??
        (await db.InvestmentSettings.get(entityId));
      if (!row || row.organizationId !== organizationId) return;
      await db.InvestmentSettings.put({ ...row, _syncedAt: syncedAt });
      return;
    }

    if (config.entity === 'marketInvestmentActionLog') {
      const row = await db.InvestmentActionLog.get(entityId);
      if (!row || row.organizationId !== organizationId) return;
      await db.InvestmentActionLog.put({ ...row, _syncedAt: syncedAt });
    }
  }

  private registerOverwriteWarning(tableName: string, count: number) {
    if (count <= 0) return;
    // Toujours accumuler ; le toast unique est émis par flushOverwriteWarnings (évite une alerte à chaque pull isolé).
    if (!this._overwriteWarnings) {
      this._overwriteWarnings = {};
    }
    this._overwriteWarnings[tableName] = (this._overwriteWarnings[tableName] || 0) + count;
  }

  private flushOverwriteWarnings() {
    if (!this._overwriteWarnings) return;
    const entries = Object.entries(this._overwriteWarnings).filter(([, count]) => count > 0);
    if (entries.length === 0) {
      this._overwriteWarnings = null;
      return;
    }

    const tableList = entries.map(([table]) => table).join(', ');
    if (typeof window !== 'undefined') {
      notify2.warning(
        'Certaines données locales ont été remplacées par une version plus récente du serveur.',
        tableList ? `Tables concernées: ${tableList}` : undefined
      );
    }
    this._overwriteWarnings = null;
  }

  private async detectOverwriteRisk(
    config: EntitySyncConfig,
    organizationId: string,
    itemsToSave: any[],
    tableOverride?: any
  ): Promise<{ pendingOpsCount: number; diffCount: number; sampleSize: number }> {
    const db = await this.getDb();
    const table = tableOverride || db[config.tableName];

    const isReferenceTable = [
      'NatureEntity',
      'Category',
      'Signal',
      'DocumentType',
      'FiscalType',
      'FiscalRegime',
      'FiscalCompatibility',
      'ManagementCompany',
    ].includes(config.tableName);

    if (isReferenceTable || config.entity === 'documentLink' || config.entity === 'loanBorrower') {
      return { pendingOpsCount: 0, diffCount: 0, sampleSize: 0 };
    }

    // Pull GET /transactions + bulkPut : l’écrasement est voulu (source serveur). Un échantillon local
    // peut contenir une ligne transitoire sans match (!remote) ou des timestamps bruités → faux toasts en boucle.
    // Le toast « données remplacées » ne doit pas être déclenché sur ce flux ; les vrais conflits métier se voient ailleurs (sync ciblée, file d’ops).
    if (config.entity === 'transaction') {
      return { pendingOpsCount: 0, diffCount: 0, sampleSize: 0 };
    }

    const pendingOpsCount = await db.pendingOperations
      .where('entity')
      .equals(config.entity)
      .and((op: PendingOperation) => {
        if (!op) return false;
        if (op.organizationId && op.organizationId !== organizationId) return false;
        return ['pending', 'error', 'syncing'].includes(op.status);
      })
      .count();

    const maxCompare = 200;
    let localSample: any[] = [];
    try {
      if (table && typeof table.where === 'function') {
        localSample = await table
          .where('organizationId')
          .equals(organizationId)
          .limit(maxCompare)
          .toArray();
      }
    } catch {
      return { pendingOpsCount, diffCount: 0, sampleSize: 0 };
    }

    if (!localSample.length) {
      return { pendingOpsCount, diffCount: 0, sampleSize: 0 };
    }
    if (!itemsToSave.length) {
      return { pendingOpsCount, diffCount: localSample.length, sampleSize: localSample.length };
    }

    const remoteById = new Map<string, any>();
    for (const item of itemsToSave) {
      if (item && item.id) {
        remoteById.set(item.id, item);
      }
    }

    /** Tolérance horloge / formats Prisma vs ISO ; au-delà = serveur réellement plus récent. */
    const SERVER_AHEAD_MS = 1500;

    let diffCount = 0;
    for (const local of localSample) {
      if (!local || !local.id) continue;
      const sid = (local as any).serverId as string | undefined;
      const remote =
        remoteById.get(local.id) || (sid && sid !== local.id ? remoteById.get(sid) : undefined);

      // Ne pas traiter « touché localement après dernier pull » comme un écrasement serveur :
      // ce cas est couvert par pendingOpsCount ; comparer ici uniquement divergence métier serveur > local.

      if (!remote) {
        diffCount += 1;
        continue;
      }

      const localMs =
        coerceEntityTimestampMs(local.updatedAt) ??
        coerceEntityTimestampMs((local as any)._localUpdatedAt) ??
        coerceEntityTimestampMs(local.createdAt);
      const remoteMs =
        coerceEntityTimestampMs(remote.updatedAt) ?? coerceEntityTimestampMs(remote.createdAt);

      if (localMs != null && remoteMs != null && remoteMs > localMs + SERVER_AHEAD_MS) {
        diffCount += 1;
        continue;
      }
    }

    return { pendingOpsCount, diffCount, sampleSize: localSample.length };
  }

  /**
   * Après sync serveur, la ligne Transaction peut passer id local → id serveur (serverId).
   * Les DocumentLink créés en local pointent encore vers l'ancien linkedId : on les remappe avant delete.
   */
  private async remapDocumentLinksForTransactionIdChange(
    db: any,
    oldLinkedId: string,
    newLinkedId: string
  ): Promise<void> {
    if (!oldLinkedId || !newLinkedId || oldLinkedId === newLinkedId) return;
    const linkTable = db.DocumentLink;
    if (!linkTable || typeof linkTable.toArray !== 'function') return;

    const allLinks: any[] = await linkTable.toArray();
    const hits = allLinks.filter(
      (link: any) =>
        String(link.linkedType || '').toLowerCase() === 'transaction' && link.linkedId === oldLinkedId
    );
    for (const link of hits) {
      try {
        await linkTable.delete([link.documentId, link.linkedType, link.linkedId]);
      } catch {
        /* clé composite absente */
      }
      const next = {
        ...link,
        linkedId: newLinkedId,
        _syncedAt: link._syncedAt,
      };
      try {
        await linkTable.put(next);
      } catch (e) {
        console.warn('[GlobalSync] remap DocumentLink transaction:', oldLinkedId, '→', newLinkedId, e);
      }
    }
  }

  /**
   * Synchronise toutes les entités depuis Supabase vers IndexedDB
   */
  async syncAllFromRemote(organizationId: string): Promise<Record<string, SyncResult>> {
    logToServer(`[APP-SHELL][SYNC] Démarrage syncAllFromRemote pour organizationId=${organizationId}`);
    const results: Record<string, SyncResult> = {};
    this._overwriteWarnings = {};
    this._syncAllFromRemoteDepth++;

    try {
      for (const config of ENTITY_CONFIGS) {
        try {
          const result = await this.syncEntityFromRemote(config, organizationId);
          results[config.entity] = result;
        } catch (error: any) {
          console.error(`[GlobalSync] Erreur sync ${config.entity}:`, error);
          results[config.entity] = {
            success: false,
            synced: 0,
            errors: 0,
            error: error.message,
          };
        }
      }

      // Log récapitulatif
      const totalSynced = Object.values(results).reduce((sum, r) => sum + r.synced, 0);
      const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors, 0);
      logToServer(`[APP-SHELL][SYNC] syncAllFromRemote terminé: totalSynced=${totalSynced}, totalErrors=${totalErrors}`);

      return results;
    } finally {
      this._syncAllFromRemoteDepth--;
      if (this._syncAllFromRemoteDepth === 0) {
        this.flushOverwriteWarnings();
      }
    }
  }

  /**
   * Synchronise une entité spécifique depuis Supabase vers IndexedDB
   * Utilisé pour un pull immédiat après un push (ex: commissions auto créées côté serveur)
   * @param entityName Nom de l'entité (ex: 'transaction', 'property', etc.)
   * @param organizationId ID de l'organisation
   */
  async syncEntityFromRemoteByName(entityName: string, organizationId: string): Promise<SyncResult> {
    const config = ENTITY_CONFIGS.find(c => c.entity === entityName);
    if (!config) {
      throw new Error(`Entité inconnue: ${entityName}`);
    }
    logToServer(`[APP-SHELL][SYNC] Pull immédiat de l'entité ${entityName} pour organizationId=${organizationId}`);
    return this.syncEntityFromRemote(config, organizationId);
  }

  /**
   * Synchronise une entité depuis Supabase vers IndexedDB
   * OVERWRITE TOTAL : Supabase = source de vérité absolue
   */
  private async syncEntityFromRemote(
    config: EntitySyncConfig,
    organizationId: string
  ): Promise<SyncResult> {
    const db = await this.getDb();
    this._overwriteWarnings = this._overwriteWarnings ?? {};
    try {
      // ⚠️ GESTION SPÉCIALE POUR loanBorrower : l'API nécessite un loanId dans l'URL
      // Les co-emprunteurs sont récupérés via les prêts (dans le payload borrowers lors de la création)
      // On ne peut pas faire un pull direct de tous les co-emprunteurs
      if (config.entity === 'loanBorrower') {
        // Récupérer tous les prêts et leurs co-emprunteurs
        const loansResponse = await fetch(`/api/loans?limit=10000`);
        if (!loansResponse.ok) {
          throw new Error(`Erreur API: ${loansResponse.status}`);
        }
        const loansData = await loansResponse.json();
        const loans = Array.isArray(loansData) ? loansData : (loansData.items || []);
        
        // Pour chaque prêt, récupérer ses co-emprunteurs
        const allBorrowers: any[] = [];
        for (const loan of loans) {
          if (loan.organizationId !== organizationId) continue;
          try {
            const borrowersResponse = await fetch(`/api/loans/${loan.id}/borrowers`);
            if (borrowersResponse.ok) {
              const borrowersData = await borrowersResponse.json();
              const borrowers = borrowersData.borrowers || [];
              allBorrowers.push(...borrowers.map((b: any) => ({
                ...b,
                loanId: loan.id,
                organizationId,
              })));
            }
          } catch (err) {
            console.warn(`[GlobalSync] Erreur récupération co-emprunteurs pour prêt ${loan.id}:`, err);
          }
        }
        
        // Transformer et sauvegarder en localDB
        const transformed = allBorrowers.map(item => 
          config.transformToLocal ? config.transformToLocal(item) : item
        );
        
        // Overwrite total : supprimer tous les co-emprunteurs de cette organisation
        await db.LoanBorrower.where('organizationId').equals(organizationId).delete();
        
        // Insérer les nouveaux
        if (transformed.length > 0) {
          await db.LoanBorrower.bulkPut(transformed);
        }
        
        return { success: true, synced: transformed.length, errors: 0 };
      }
      
      // Récupérer TOUTES les données depuis l'API (overwrite total)
      // Pour les tables de référence, ne pas ajouter ?limit=10000 si l'URL contient déjà des paramètres
      let url = config.apiRoute.includes('?') 
        ? config.apiRoute 
        : `${config.apiRoute}?limit=10000`;
      
      // ⚠️ CRITIQUE: Pour les properties, ajouter includeArchived=true si pas déjà présent
      // (même logique que fullSync pour avoir TOUS les biens)
      if (config.entity === 'property' && !url.includes('includeArchived')) {
        url = url.includes('?') 
          ? `${url}&includeArchived=true`
          : `${url}?includeArchived=true`;
      }
      
      // ⚠️ CRITIQUE: Pour les documents, ajouter includeDeleted=true pour récupérer TOUS les documents
      // (y compris les brouillons/draft et ceux sans DocumentLink)
      // Le filtrage sur status se fait côté client/UI
      if (config.entity === 'document' && !url.includes('includeDeleted')) {
        url = url.includes('?') 
          ? `${url}&includeDeleted=true`
          : `${url}?includeDeleted=true`;
      }
      
      const response = await fetch(url);

      if (!response.ok) {
        // Pour les tables de référence, une erreur 404 n'est pas critique (peut ne pas exister)
        const isReferenceTable = [
          'NatureEntity',
          'Category',
          'Signal',
          'DocumentType',
          'FiscalType',
          'FiscalRegime',
          'FiscalCompatibility',
          'ManagementCompany',
        ].includes(config.tableName);
        
        if (response.status === 404 && isReferenceTable) {
          logToServer(`[APP-SHELL][SYNC] ⚠️ Table ${config.tableName}: endpoint non disponible (404), ignoré`);
          return { success: true, synced: 0, errors: 0 };
        }
        
        throw new Error(`Erreur API: ${response.status}`);
      }

      const data = await response.json();
      let items: any[] = [];
      
      // Gérer différents formats de réponse
      if (Array.isArray(data)) {
        items = data;
      } else if (data.simulations && Array.isArray(data.simulations)) {
        // Format spécifique pour les simulations fiscales
        items = data.simulations;
      } else if (data.items && Array.isArray(data.items)) {
        // Format pour leases, loans, payments (retournent { items: [...] })
        items = data.items;
      } else if (data.data && Array.isArray(data.data)) {
        items = data.data;
      } else if (data.leases && Array.isArray(data.leases)) {
        // Format spécifique pour les baux
        items = data.leases;
      } else if (data.documents && Array.isArray(data.documents)) {
        // Format spécifique pour les documents
        items = data.documents;
      } else if (data.transactions && Array.isArray(data.transactions)) {
        // Format spécifique pour les transactions
        items = data.transactions;
      } else if (data.societes && Array.isArray(data.societes)) {
        // Format spécifique pour les sociétés de gestion
        items = data.societes;
      } else if (data.documentTypes && Array.isArray(data.documentTypes)) {
        // Format spécifique pour les types de documents
        items = data.documentTypes;
      } else if (data.signals && Array.isArray(data.signals)) {
        // Format spécifique pour les signaux
        items = data.signals;
      } else if (data[config.entity] && Array.isArray(data[config.entity])) {
        items = data[config.entity];
      } else if (data[config.tableName] && Array.isArray(data[config.tableName])) {
        // Essayer aussi avec le nom de table (pluriel)
        items = data[config.tableName];
      } else if (config.entity === 'nature' && data.data && Array.isArray(data.data)) {
        // Format spécifique pour les natures : { success: true, data: [...] }
        items = data.data;
      } else if (config.entity === 'documentLink' && data.data && Array.isArray(data.data)) {
        // Format pour documentLinks : { data: [...], total: number }
        items = data.data;
      } else if (config.entity === 'userProfile' && 'data' in data) {
        // Format pour userProfile : { data: {...} } - un seul profil par organisation
        // Convertir en tableau pour le traitement uniforme (même si data.data est null)
        items = data.data ? [data.data] : [];
      } else {
        console.warn(`[GlobalSync] Format de réponse inattendu pour ${config.entity}:`, Object.keys(data));
      }

      // Déterminer si c'est une table de référence (pas de filtre organizationId)
      const isReferenceTable = [
        'NatureEntity',
        'Category',
        'Signal',
        'DocumentType',
        'FiscalType',
        'FiscalRegime',
        'FiscalCompatibility',
        'ManagementCompany',
      ].includes(config.tableName);

      // Filtrer par organizationId (uniquement pour les tables métier)
      let filteredItems: any[];
      if (config.entity === 'documentLink') {
        // documentLinks : filtrer via les documents de l'organisation
        // Récupérer tous les documentIds de l'organisation
        const orgDocuments = await db.Document
          .where('organizationId')
          .equals(organizationId)
          .toArray();
        const orgDocumentIds = new Set(orgDocuments.map(doc => doc.id));
        filteredItems = items.filter((item: any) => orgDocumentIds.has(item.documentId));
      } else if (isReferenceTable) {
        // Tables de référence globales : pas de filtre organizationId
        filteredItems = items;
      } else {
        // Tables métier : filtrer par organizationId
        filteredItems = items.filter((item: any) => item.organizationId === organizationId);
      }

      // ⚠️ POINT 1 : Logs pour compter transactions récupérées + détecter commissions (après filtrage)
      if (config.entity === 'transaction') {
        const totalTransactions = filteredItems.length;
        const commissionsCount = filteredItems.filter((item: any) => item.parentTransactionId).length;
        const mothersCount = totalTransactions - commissionsCount;
        console.log(`[GlobalSync] 📊 Pull transactions: ${totalTransactions} récupérée(s) (${mothersCount} mère(s), ${commissionsCount} commission(s))`);
        if (commissionsCount > 0) {
          const commissionIds = filteredItems
            .filter((item: any) => item.parentTransactionId)
            .map((item: any) => ({ id: item.id, parentId: item.parentTransactionId }));
          console.log(`[GlobalSync] ✅ Commissions détectées:`, commissionIds);
        } else {
          console.log(`[GlobalSync] ℹ️ Aucune commission détectée dans les transactions récupérées`);
        }
      }

      // ✅ CRITIQUE: Logs pour les échéances récupérées (vérifier qu'aucune supprimée ne revient)
      if (config.entity === 'echeance') {
        const totalEcheances = filteredItems.length;
        const activeEcheances = filteredItems.filter((item: any) => item.isActive !== false).length;
        const inactiveEcheances = filteredItems.filter((item: any) => item.isActive === false).length;
        console.log(`[GlobalSync] 📊 Pull échéances: ${totalEcheances} récupérée(s) (${activeEcheances} active(s), ${inactiveEcheances} inactive(s))`);
        if (inactiveEcheances > 0) {
          console.warn(`[GlobalSync] ⚠️ ATTENTION: ${inactiveEcheances} échéance(s) inactive(s) récupérée(s) lors du pull. Si elles ont été hard delete, elles ne devraient pas exister.`);
          const inactiveIds = filteredItems
            .filter((item: any) => item.isActive === false)
            .map((item: any) => ({ id: item.id, label: item.label, isActive: item.isActive }));
          console.warn(`[GlobalSync] ⚠️ Échéances inactives récupérées:`, inactiveIds);
        }
      }

      // OVERWRITE TOTAL : Transformer toutes les données Supabase
      // ⚠️ GESTION SPÉCIALE POUR TRANSACTION : db.Transaction est une fonction au lieu d'un objet Table
      let table: any;
      if (config.tableName === 'Transaction') {
        table = (db as any).Transaction;
        // Si ce n'est pas valide (fonction au lieu de Table), utiliser db.tables
        if (!table || typeof table === 'function' || typeof table.where !== 'function') {
          const transactionTable = db.tables.find(t => t.name === 'Transaction');
          if (transactionTable && typeof transactionTable.where === 'function') {
            table = transactionTable;
          } else {
            throw new Error('Table Transaction non accessible dans IndexedDB');
          }
        }
      } else {
        table = db[config.tableName] as any;
      }
      
      // Vérifier que c'est bien une table Dexie valide
      if (!table || typeof table.where !== 'function') {
        throw new Error(`Table ${config.tableName} n'est pas une table Dexie valide (type: ${typeof table})`);
      }
      
      const now = new Date().toISOString();
      let synced = 0;
      let errors = 0;

              // Compter les items locaux avant suppression
              let localCount: number;
              if (config.entity === 'documentLink') {
                // documentLinks : compter via les documents de l'organisation
                const orgDocuments = await db.Document
                  .where('organizationId')
                  .equals(organizationId)
                  .toArray();
                const orgDocumentIds = new Set(orgDocuments.map(doc => doc.id));
                const allLinks = await table.toArray();
                localCount = allLinks.filter(link => orgDocumentIds.has(link.documentId)).length;
              } else if (isReferenceTable) {
                // Tables de référence : compter tous les items
                localCount = await table.count();
              } else {
                // Tables métier : filtrer par organizationId
                localCount = await table.where('organizationId').equals(organizationId).count();
              }

      // Log spécifique pour transactions pour debug
      if (config.entity === 'transaction') {
        // Log détaillé avant filtrage
        if (items.length > 0) {
          const firstItem = items[0];
          logToServer(`[APP-SHELL][SYNC][DEBUG][transactions] exemple=`, JSON.stringify({
            id: firstItem.id,
            organizationId: firstItem.organizationId,
            propertyId: firstItem.propertyId,
            label: firstItem.label,
            amount: firstItem.amount,
            hasOrgId: 'organizationId' in firstItem,
            orgIdType: typeof firstItem.organizationId,
            orgIdValue: firstItem.organizationId,
          }, null, 2));
        }
        logToServer(`[APP-SHELL][SYNC] transactions: items bruts=${items.length}, après filtre orgId=${filteredItems.length}, organizationId=${organizationId}`);
      }

      // Transformer toutes les données Supabase
      const itemsToSave = filteredItems.map((item: any) => {
        try {
          const transformed = config.transformToLocal
            ? config.transformToLocal(item)
            : item;
          
          // Supabase = source de vérité absolue : toujours écraser les données locales
          return {
            ...transformed,
            _syncedAt: now,
          };
        } catch (error) {
          console.error(`[GlobalSync] Erreur transformation item ${config.entity}:`, error);
          errors++;
          return null;
        }
      }).filter((item: any) => item !== null);

      // Détection best-effort d'écrasement potentiel (avant suppression locale)
      const overwriteRisk = await this.detectOverwriteRisk(config, organizationId, itemsToSave, table);
      const pendingPlusDiff = overwriteRisk.pendingOpsCount + overwriteRisk.diffCount;
      // Pull « transaction » répété (ex. polling commission) : des pendingOps en file (error legacy, etc.)
      // ne sont pas un « serveur plus récent a écrasé vos données » — ne pas lier au toast sous peine de boucle infinie.
      const overwriteCountForToast =
        config.entity === 'transaction' ? overwriteRisk.diffCount : pendingPlusDiff;
      if (overwriteCountForToast > 0) {
        this.registerOverwriteWarning(config.tableName, overwriteCountForToast);
      }
      if (pendingPlusDiff > 0) {
        recordSyncOverwriteEvent({
          timestamp: now,
          table: config.tableName,
          entity: config.entity,
          pendingOpsCount: overwriteRisk.pendingOpsCount,
          diffCount: overwriteRisk.diffCount,
          sampleSize: overwriteRisk.sampleSize,
        });
      }

      // ⚠️ OPTION B IMPLÉMENTÉE : Déduplication retirée car les commissions auto ne sont plus créées en app-shell offline
      // Les commissions sont créées uniquement côté serveur lors de la sync (server-only creation)
      // Plus de doublon possible, donc plus besoin de déduplication

              // OVERWRITE TOTAL : Supprimer tous les items
              // ⚠️ IMPORTANT : Pour les transactions, on doit préserver celles qui ont une pendingOp CREATE en cours
              // pour éviter qu'elles soient supprimées avant d'être synchronisées
              if (config.entity === 'transaction') {
                // Récupérer les IDs des transactions qui ont une pendingOp CREATE en cours
                // Note: l'index [entity+status] existe, mais pas [entity+operation+status], donc on filtre après
                const allPendingOps = await db.pendingOperations
                  .where('[entity+status]')
                  .equals(['transaction', 'pending'])
                  .toArray();
                const pendingCreateOps = allPendingOps.filter(op => op.operation === 'create');
                const pendingCreateIds = new Set(pendingCreateOps.map(op => op.entityId));
                
                // Récupérer aussi celles en cours de sync
                const allSyncingOps = await db.pendingOperations
                  .where('[entity+status]')
                  .equals(['transaction', 'syncing'])
                  .toArray();
                const syncingCreateOps = allSyncingOps.filter(op => op.operation === 'create');
                const syncingCreateIds = new Set(syncingCreateOps.map(op => op.entityId));
                
                // Union des IDs à préserver
                const idsToPreserve = new Set([...pendingCreateIds, ...syncingCreateIds]);
                
                if (idsToPreserve.size > 0) {
                  console.log(`[GlobalSync] ⚠️ Préservation de ${idsToPreserve.size} transaction(s) avec pendingOp CREATE en cours`);
                }
                
                // Supprimer uniquement les transactions qui n'ont pas de pendingOp CREATE
                const allTransactions = await table.where('organizationId').equals(organizationId).toArray();
                const transactionsToDelete = allTransactions.filter((t: any) => !idsToPreserve.has(t.id));

                if (transactionsToDelete.length > 0) {
                  for (const t of transactionsToDelete) {
                    const sid = (t as any).serverId as string | undefined;
                    if (sid && sid !== t.id) {
                      await this.remapDocumentLinksForTransactionIdChange(db, t.id, sid);
                    }
                  }
                  await Promise.all(transactionsToDelete.map((t: any) => table.delete(t.id)));
                }
              } else if (config.entity === 'documentLink') {
                // documentLinks : clé composite, filtrer via les documents de l'organisation
                // Récupérer tous les documentIds de l'organisation
                const orgDocuments = await db.Document
                  .where('organizationId')
                  .equals(organizationId)
                  .toArray();
                const orgDocumentIds = new Set(orgDocuments.map(doc => doc.id));
                
                // Supprimer uniquement les liens des documents de cette organisation
                const allLinks = await table.toArray();
                const linksToDelete = allLinks.filter(link => orgDocumentIds.has(link.documentId));
                if (linksToDelete.length > 0) {
                  // Pour les clés composites, on doit supprimer individuellement
                  await Promise.all(
                    linksToDelete.map(link => 
                      table.delete([link.documentId, link.linkedType, link.linkedId])
                    )
                  );
                }
              } else if (isReferenceTable) {
                // Tables de référence : supprimer tous les items (pas de filtre organizationId)
                await table.clear();
              } else {
                // Tables métier : supprimer uniquement les items de cette organisation
                await table.where('organizationId').equals(organizationId).delete();
              }

      // Puis bulkPut toutes les données Supabase
      if (itemsToSave.length > 0) {
        if (config.entity === 'documentLink') {
          // documentLinks : utiliser bulkPut avec clé composite
          await table.bulkPut(itemsToSave);
        } else {
          await table.bulkPut(itemsToSave);
        }
        synced = itemsToSave.length;
      }

      // Log propre pour vérification (terminal)
      logToServer(
        `[APP-SHELL][SYNC] table=${config.tableName} local=${localCount} remote=${filteredItems.length} synced=${synced} overwriteToast=${overwriteCountForToast > 0} pendingOps=${overwriteRisk.pendingOpsCount} diff=${overwriteRisk.diffCount}`
      );

      // Mettre à jour syncMeta (pour tracking, mais pas utilisé pour la logique de sync)
      // ⚠️ IMPORTANT: Utiliser le nom de table (PascalCase) au lieu du nom d'entité (camelCase)
      // pour cohérence avec PendingSyncView qui cherche par nom de table
      await db.syncMeta.put({
        table: config.tableName,
        lastSyncAt: now,
      });

      return { success: errors === 0, synced, errors };
    } catch (error: any) {
      console.error(`[GlobalSync] Erreur syncFromRemote ${config.entity}:`, error);
      return {
        success: false,
        synced: 0,
        errors: 0,
        error: error.message,
      };
    } finally {
      if (this._syncAllFromRemoteDepth === 0) {
        this.flushOverwriteWarnings();
      }
    }
  }

  /**
   * Synchronise toutes les opérations en attente vers Supabase
   * Inclut aussi les opérations en erreur pour permettre de les réessayer
   */
  async syncAllPendingToRemote(organizationId: string): Promise<Record<string, SyncResult>> {
    logToServer(`[APP-SHELL][SYNC] Démarrage syncAllPendingToRemote pour organizationId=${organizationId}`);
    const results: Record<string, SyncResult> = {};
    const db = await this.getDb();
    const normalizeDay = (v: unknown) => {
      const s = String(v ?? '');
      return s.length >= 10 ? s.slice(0, 10) : s;
    };

    // PR4 Marché : migration local-only -> queue globale avant le push standard.
    await this.bootstrapMarketPendingOpsIfNeeded(organizationId);

    // Snapshot diagnostic complet de la queue au refresh (pending/syncing/error).
    const queueSnapshotRaw = await db.pendingOperations
      .where('status')
      .anyOf(['pending', 'syncing', 'error'])
      .toArray();
    const queueSnapshot = queueSnapshotRaw.filter(
      (op: PendingOperation) => op.organizationId === organizationId || op.organizationId == null
    );
    logToServer(
      `[APP-SHELL][SYNC][QUEUE] Snapshot ops=${queueSnapshot.length} org=${organizationId}`
    );
    for (const op of queueSnapshot) {
      const payload = op.payload || {};
      logToServer(
        `[APP-SHELL][SYNC][QUEUE_OP] ${JSON.stringify({
          id: op.id,
          entity: op.entity,
          operation: op.operation,
          entityId: op.entityId,
          status: op.status,
          propertyId: payload.propertyId ?? null,
          tenantId: payload.tenantId ?? null,
          startDate: payload.startDate ?? null,
          rentAmount: payload.rentAmount ?? null,
        })}`
      );
    }

    // Pré-nettoyage: lease:create fantômes (bail déjà remote localement).
    if (queueSnapshot.length > 0) {
      const orgLeases = await db.Lease.where('organizationId').equals(organizationId).toArray();
      const staleLeaseCreateOpIds: string[] = [];
      for (const op of queueSnapshot) {
        if (op.entity !== 'lease' || op.operation !== 'create') continue;
        const payload = op.payload || {};
        let hasRemoteLeaseAlready = false;

        // Cas 1: entityId est déjà un cuid -> vérifier existence serveur.
        if (classifySmartimmoId(op.entityId) === 'cuid_remote') {
          try {
            const check = await fetch(`/api/leases/${encodeURIComponent(op.entityId)}`, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            });
            hasRemoteLeaseAlready = check.ok;
          } catch {
            // ignore (on continue avec détection locale)
          }
        }

        // Cas 2: une ligne locale Lease cuid matche la signature métier du payload.
        if (!hasRemoteLeaseAlready) {
          const signatureMatch = orgLeases.find((l: any) => {
            if (classifySmartimmoId(l.id) !== 'cuid_remote') return false;
            return (
              l.propertyId === payload.propertyId &&
              l.tenantId === payload.tenantId &&
              normalizeDay(l.startDate) === normalizeDay(payload.startDate) &&
              Math.abs(Number(l.rentAmount ?? 0) - Number(payload.rentAmount ?? 0)) < 0.01
            );
          });
          hasRemoteLeaseAlready = !!signatureMatch;
        }

        if (hasRemoteLeaseAlready) {
          staleLeaseCreateOpIds.push(op.id);
          logToServer(
            `[APP-SHELL][SYNC][LEASE_GHOST_CREATE] suppress op=${op.id} entityId=${op.entityId} reason=remote_lease_already_exists`
          );
        }
      }
      if (staleLeaseCreateOpIds.length > 0) {
        await Promise.all(staleLeaseCreateOpIds.map((id) => db.pendingOperations.delete(id)));
      }
    }

    // Récupérer les opérations en attente ET en erreur (pour permettre de les réessayer)
    const allPendingOps = await db.pendingOperations
      .where('status')
      .anyOf(['pending', 'error'])
      .toArray();
    // ✅ Filtrer par organizationId : ne traiter que les ops de l'org courante (et les ops sans org pour rétrocompatibilité)
    const pendingOps = allPendingOps.filter(
      op => op.organizationId === organizationId || op.organizationId == null
    );

    logToServer(`[APP-SHELL][SYNC] Opérations en attente: ${pendingOps.length} (org ${organizationId}, total brut: ${allPendingOps.length})`);

    // Remettre les opérations en erreur à "pending" pour les réessayer
    // Réinitialiser le retryCount à 0 pour permettre un nouveau cycle de tentatives
    const errorOps = pendingOps.filter(op => op.status === 'error');
    if (errorOps.length > 0) {
      await Promise.all(
        errorOps.map(op =>
          db.pendingOperations.update(op.id, {
            status: 'pending',
            retryCount: 0, // Réinitialiser pour permettre un nouveau cycle de tentatives
            errorMessage: undefined, // Nettoyer le message d'erreur précédent
            updatedAt: new Date().toISOString(),
          })
        )
      );
      console.log(`[GlobalSync] ${errorOps.length} opération(s) en erreur remise(s) à "pending" pour réessai (retryCount réinitialisé)`);
    }

    // Recharger les opérations après la mise à jour (filtrer par org pour ne traiter que l'org courante)
    const rawOps = await db.pendingOperations
      .where('status')
      .anyOf(['pending', 'syncing'])
      .toArray();
    let allOps = rawOps.filter(
      op => op.organizationId === organizationId || op.organizationId == null
    );

    // ✅ OPTIMISATION: Annuler les pendingOps qui s'annulent mutuellement
    // Cas 1: CREATE puis DELETE du même entityId → supprimer les deux (net effect = rien)
    // Cas 2: DELETE puis CREATE du même entityId → supprimer DELETE, garder CREATE (net effect = create)
    const opsToCancel: string[] = [];
    const entityOpsMap = new Map<string, { create?: PendingOperation; delete?: PendingOperation; update?: PendingOperation }>();
    
    for (const op of allOps) {
      const key = `${op.entity}:${op.entityId}`;
      if (!entityOpsMap.has(key)) {
        entityOpsMap.set(key, {});
      }
      const ops = entityOpsMap.get(key)!;
      
      if (op.operation === 'create') {
        ops.create = op;
      } else if (op.operation === 'delete') {
        ops.delete = op;
      } else if (op.operation === 'update') {
        ops.update = op;
      }
    }
    
    // Analyser chaque groupe d'opérations pour le même entityId
    for (const [key, ops] of entityOpsMap.entries()) {
      // Cas 1: CREATE puis DELETE → annuler les deux
      if (ops.create && ops.delete) {
        const createTime = new Date(ops.create.createdAt).getTime();
        const deleteTime = new Date(ops.delete.createdAt).getTime();
        
        if (createTime < deleteTime) {
          // CREATE avant DELETE → les deux s'annulent
          console.log(`[GlobalSync] ✅ Optimisation: annulation CREATE + DELETE pour ${key} (net effect = rien)`);
          opsToCancel.push(ops.create.id);
          opsToCancel.push(ops.delete.id);
        } else {
          // DELETE avant CREATE → garder CREATE seulement (net effect = create)
          console.log(`[GlobalSync] ✅ Optimisation: suppression DELETE avant CREATE pour ${key} (net effect = create)`);
          opsToCancel.push(ops.delete.id);
        }
      }
      
      // Cas 3: UPDATE puis DELETE → garder DELETE seulement (net effect = delete)
      if (ops.update && ops.delete) {
        const updateTime = new Date(ops.update.createdAt).getTime();
        const deleteTime = new Date(ops.delete.createdAt).getTime();
        
        if (updateTime < deleteTime) {
          console.log(`[GlobalSync] ✅ Optimisation: suppression UPDATE avant DELETE pour ${key} (net effect = delete)`);
          opsToCancel.push(ops.update.id);
        }
      }
      
      // Cas 4: CREATE puis UPDATE → fusionner en CREATE avec les données mises à jour
      if (ops.create && ops.update) {
        const createTime = new Date(ops.create.createdAt).getTime();
        const updateTime = new Date(ops.update.createdAt).getTime();
        
        if (createTime < updateTime) {
          console.log(`[GlobalSync] ✅ Optimisation: fusion CREATE + UPDATE pour ${key} (net effect = create avec données mises à jour)`);
          // Merger les payloads
          ops.create.payload = { ...ops.create.payload, ...ops.update.payload };
          opsToCancel.push(ops.update.id);
        }
      }
    }
    
    // Supprimer les opérations annulées
    if (opsToCancel.length > 0) {
      await Promise.all(opsToCancel.map(id => db.pendingOperations.delete(id)));
      console.log(`[GlobalSync] ✅ ${opsToCancel.length} opération(s) annulée(s) pour optimisation`);
      
      // Recharger les opérations après nettoyage
      const cleanedOps = await db.pendingOperations
        .where('status')
        .anyOf(['pending', 'syncing'])
        .toArray();
      
      // Utiliser les opérations nettoyées au lieu de allOps
      allOps = cleanedOps;
    }
    
    const opsByEntity = allOps.reduce((acc, op) => {
      if (!acc[op.entity]) {
        acc[op.entity] = [];
      }
      acc[op.entity].push(op);
      return acc;
    }, {} as Record<string, PendingOperation[]>);
    
    // ✅ Séparer les opérations delete pour les traiter en dernier (ordre inverse des dépendances)
    const deleteOpsByEntity: Record<string, PendingOperation[]> = {};
    const nonDeleteOpsByEntity: Record<string, PendingOperation[]> = {};
    
    for (const [entity, ops] of Object.entries(opsByEntity)) {
      const deleteOps = ops.filter(op => op.operation === 'delete');
      const nonDeleteOps = ops.filter(op => op.operation !== 'delete');
      if (deleteOps.length > 0) deleteOpsByEntity[entity] = deleteOps;
      if (nonDeleteOps.length > 0) nonDeleteOpsByEntity[entity] = nonDeleteOps;
    }

    // ✅ ORDONNER PAR DÉPENDANCES : Push entités racines d'abord, puis DocumentLinks
    // Phase 1 : Entités racines (documents, transactions, etc.) - celles qui ne dépendent pas d'autres entités métier
    // Phase 2 : DocumentLinks (dépendent des documents/transactions)
    // ⚠️ IMPORTANT: 'loan' doit être synchronisé AVANT 'document' car les documents peuvent être liés aux prêts.
    // Marché : settings DOIT être poussé avant actionLog.
    // L'ordre de sync est : property, tenant, lease, loan, settings, actionLog, transaction, ...
    const rootEntities = [
      'property',
      'tenant',
      'lease',
      'loan',
      'marketInvestmentSettings',
      'marketInvestmentActionLog',
      'transaction',
      'echeanceRecurrente',
      'document',
    ];
    const dependencyEntities = ['documentLink'];
    
    // Extraire les entités par phase
    const phase1Entities: string[] = [];
    const phase2Entities: string[] = [];
    const otherEntities: string[] = [];
    
    for (const entity of Object.keys(nonDeleteOpsByEntity)) {
      if (rootEntities.includes(entity)) {
        phase1Entities.push(entity);
      } else if (dependencyEntities.includes(entity)) {
        phase2Entities.push(entity);
      } else {
        otherEntities.push(entity);
      }
    }
    
    // ✅ Trier selon l'ordre de dépendance (pas alphabétique)
    // property → tenant → lease → loan → marketInvestmentSettings → marketInvestmentActionLog → transaction → echeanceRecurrente → document → documentLink
    const entityOrder = [
      'property',
      'tenant',
      'lease',
      'loan',
      'marketInvestmentSettings',
      'marketInvestmentActionLog',
      'transaction',
      'echeanceRecurrente',
      'document',
      'documentLink',
    ];
    const orderedPhase1 = phase1Entities.sort((a, b) => {
      const indexA = entityOrder.indexOf(a);
      const indexB = entityOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b); // Si pas dans l'ordre, tri alphabétique
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
    
    const orderedEntities = [...orderedPhase1, ...phase2Entities.sort(), ...otherEntities.sort()];

    // Synchroniser chaque entité dans l'ordre de dépendance
    for (const entity of orderedEntities) {
      const ops = nonDeleteOpsByEntity[entity];
      if (!ops || ops.length === 0) continue;
      const config = ENTITY_CONFIGS.find(c => c.entity === entity);
      if (!config) {
        console.warn(`[GlobalSync] Config non trouvée pour entity: ${entity}`);
        continue;
      }

      try {
        // ⚠️ NETTOYAGE: Supprimer les opérations pour des entités qui n'existent plus localement
        // (peut arriver si un bien a été supprimé en cascade ou si l'opération est obsolète)
        // ⚠️ CRITIQUE: Pour les opérations DELETE, on NE DOIT PAS vérifier si l'entité existe encore,
        // car c'est normal qu'elle n'existe plus après une suppression en cascade
        let validOps = ops;
        if (entity === 'property') {
          validOps = [];
          for (const op of ops) {
            // Pour les DELETE, on garde toujours l'opération (elle doit être synchronisée vers Supabase)
            if (op.operation === 'delete') {
              validOps.push(op);
              continue;
            }
            
            // Pour les UPDATE/CREATE, vérifier que l'entité existe encore
            const property = await db.Property.get(op.entityId);
            if (!property && (op.operation === 'update' || op.operation === 'create')) {
              console.log(`[GlobalSync] Nettoyage: suppression op ${op.id} pour bien ${op.entityId} qui n'existe plus localement (opération: ${op.operation})`);
              await db.pendingOperations.delete(op.id);
              continue;
            }
            validOps.push(op);
          }
        }

        const result = await this.syncEntityPendingToRemote(config, validOps, organizationId);
        results[entity] = result;
      } catch (error: any) {
        console.error(`[GlobalSync] Erreur sync pending ${entity}:`, error);
        results[entity] = {
          success: false,
          synced: 0,
          errors: ops.length,
          error: error.message,
        };
      }
    }
    
    // ✅ Traitement des DELETE en dernier, dans l'ordre inverse des dépendances
    const deleteEntities = Object.keys(deleteOpsByEntity);
    if (deleteEntities.length > 0) {
      const deleteEntityOrder = [...entityOrder].reverse();
      const orderedDeleteEntities = deleteEntities.sort((a, b) => {
        const indexA = deleteEntityOrder.indexOf(a);
        const indexB = deleteEntityOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
      
      for (const entity of orderedDeleteEntities) {
        const ops = deleteOpsByEntity[entity];
        if (!ops || ops.length === 0) continue;
        const config = ENTITY_CONFIGS.find(c => c.entity === entity);
        if (!config) {
          console.warn(`[GlobalSync] Config non trouvée pour entity: ${entity}`);
          continue;
        }
        
        try {
          const result = await this.syncEntityPendingToRemote(config, ops, organizationId);
          results[entity] = result;
        } catch (error: any) {
          console.error(`[GlobalSync] Erreur sync pending ${entity} (delete):`, error);
          results[entity] = {
            success: false,
            synced: 0,
            errors: ops.length,
            error: error.message,
          };
        }
      }
    }

    // Log récapitulatif
    const totalSynced = Object.values(results).reduce((sum, r) => sum + r.synced, 0);
    const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors, 0);
    logToServer(`[APP-SHELL][SYNC] syncAllPendingToRemote terminé: totalSynced=${totalSynced}, totalErrors=${totalErrors}`);

    return results;
  }

  /**
   * Synchronise les opérations en attente d'une entité vers Supabase
   */
  private async syncEntityPendingToRemote(
    config: EntitySyncConfig,
    ops: PendingOperation[],
    organizationId: string
  ): Promise<SyncResult> {
    const db = await this.getDb();
    let synced = 0;
    let errors = 0;

    for (const op of ops) {
      try {
        // ⚠️ MIGRATION: Convertir les anciennes opérations "update" avec isArchived en "delete" avec mode: 'archive'
        // Ces opérations ont été créées avant la correction et ne peuvent pas être synchronisées
        if (op.operation === 'update' && op.payload && op.payload.isArchived === true && config.entity === 'property') {
          console.log(`[GlobalSync] Migration: conversion op ${op.id} de "update" vers "delete" avec mode: 'archive'`);
          // Mettre à jour l'opération pour la convertir en delete
          await db.pendingOperations.update(op.id, {
            operation: 'delete',
            payload: { mode: 'archive' },
            updatedAt: new Date().toISOString(),
          });
          // Recharger l'opération mise à jour
          const updatedOp = await db.pendingOperations.get(op.id);
          if (!updatedOp) continue;
          op.operation = 'delete';
          op.payload = { mode: 'archive' };
        }

        // Marquer comme "syncing"
        await db.pendingOperations.update(op.id, {
          status: 'syncing',
          updatedAt: new Date().toISOString(),
        });

        let success = false;

        if (op.operation === 'create') {
          // Garde-fou pré-POST: éviter d'appeler /api/leases avec FK locale non résolue.
          if (config.entity === 'lease') {
            const payload = op.payload || {};
            let nextPropertyId = payload.propertyId;
            let nextTenantId = payload.tenantId;

            // Tentative de résolution propertyId local UUID -> remote ID via matching métier.
            if (classifySmartimmoId(nextPropertyId) === 'uuid_local') {
              try {
                const localProperty = await db.Property.get(nextPropertyId);
                if (localProperty) {
                  const remotePropertiesRes = await fetch('/api/properties?limit=10000&includeArchived=true');
                  if (remotePropertiesRes.ok) {
                    const remotePropertiesJson = await remotePropertiesRes.json();
                    const remoteProperties =
                      remotePropertiesJson?.data || remotePropertiesJson?.items || [];
                    const normalize = (v: unknown) => String(v ?? '').trim().toLowerCase();
                    const matched = remoteProperties.find(
                      (p: any) =>
                        normalize(p.name) === normalize(localProperty.name) &&
                        normalize(p.address) === normalize(localProperty.address) &&
                        normalize(p.city) === normalize(localProperty.city) &&
                        normalize(p.postalCode) === normalize(localProperty.postalCode)
                    );
                    if (matched?.id) {
                      nextPropertyId = matched.id;
                    }
                  }
                }
              } catch (resolveErr) {
                console.warn('[GlobalSync] Résolution pre-POST propertyId lease:create échouée:', resolveErr);
              }
            }

            // Tentative légère de résolution tenantId local UUID -> remote ID (email/nom).
            if (classifySmartimmoId(nextTenantId) === 'uuid_local') {
              try {
                const localTenant = await db.Tenant.get(nextTenantId);
                if (localTenant) {
                  const remoteTenantsRes = await fetch('/api/tenants?limit=10000');
                  if (remoteTenantsRes.ok) {
                    const remoteTenantsJson = await remoteTenantsRes.json();
                    const remoteTenants = remoteTenantsJson?.data || remoteTenantsJson?.items || [];
                    const normalize = (v: unknown) => String(v ?? '').trim().toLowerCase();
                    const matched = remoteTenants.find(
                      (t: any) =>
                        (localTenant.email &&
                          t.email &&
                          normalize(t.email) === normalize(localTenant.email)) ||
                        (normalize(t.firstName) === normalize(localTenant.firstName) &&
                          normalize(t.lastName) === normalize(localTenant.lastName))
                    );
                    if (matched?.id) {
                      nextTenantId = matched.id;
                    }
                  }
                }
              } catch (resolveErr) {
                console.warn('[GlobalSync] Résolution pre-POST tenantId lease:create échouée:', resolveErr);
              }
            }

            // Appliquer remap dans la pending op avant createRemote.
            if (nextPropertyId !== payload.propertyId || nextTenantId !== payload.tenantId) {
              const nextPayload = {
                ...payload,
                propertyId: nextPropertyId,
                tenantId: nextTenantId,
              };
              await db.pendingOperations.update(op.id, {
                payload: nextPayload,
                updatedAt: new Date().toISOString(),
              });
              op.payload = nextPayload;
            }

            // Si propertyId reste local, isoler sans polluer le boot avec un POST 404.
            if (classifySmartimmoId(op.payload?.propertyId) === 'uuid_local') {
              await db.pendingOperations.update(op.id, {
                status: 'blocked_permanent',
                errorMessage:
                  `Lease create isolée avant POST: propertyId local non résolu (${op.payload?.propertyId ?? 'null'})`,
                blockReason:
                  `lease_create_unresolved_property_fk: entityId=${op.entityId}, propertyId=${op.payload?.propertyId ?? 'null'}`,
                updatedAt: new Date().toISOString(),
              });
              logToServer(
                `[APP-SHELL][SYNC][LEASE_CREATE_ISOLATED_PREPOST] op=${op.id} entityId=${op.entityId} propertyId=${op.payload?.propertyId ?? 'null'} tenantId=${op.payload?.tenantId ?? 'null'}`
              );
              continue;
            }
          }

          const diagLeaseId = getLeaseSignatureDiagLeaseId();
          if (diagLeaseId && config.entity === 'property') {
            const leaseRow = await db.Lease.get(diagLeaseId);
            if (
              leaseRow &&
              leaseRow.organizationId === organizationId &&
              leaseRow.propertyId === op.entityId
            ) {
              const propRow = await db.Property.get(op.entityId);
              logLeaseSignWorkflowDiag({
                step: '1_before_sync_property',
                organizationId,
                diagLeaseLocalId: diagLeaseId,
                pendingPropertyOpId: op.id,
                localPropertyId: op.entityId,
                localPropertyIdKind: classifySmartimmoId(op.entityId),
                propertyRowPresent: !!propRow,
                /** Si le bien a déjà un id « serveur » (cuid), il est déjà aligné remote */
                propertyRowIdKind: propRow?.id ? classifySmartimmoId(propRow.id) : 'empty',
              });
            }
          }
          if (diagLeaseId && config.entity === 'tenant') {
            const leaseRow = await db.Lease.get(diagLeaseId);
            if (
              leaseRow &&
              leaseRow.organizationId === organizationId &&
              leaseRow.tenantId === op.entityId
            ) {
              const tenantRow = await db.Tenant.get(op.entityId);
              logLeaseSignWorkflowDiag({
                step: '3_before_sync_tenant',
                organizationId,
                diagLeaseLocalId: diagLeaseId,
                pendingTenantOpId: op.id,
                localTenantId: op.entityId,
                localTenantIdKind: classifySmartimmoId(op.entityId),
                tenantRowPresent: !!tenantRow,
                tenantRowIdKind: tenantRow?.id ? classifySmartimmoId(tenantRow.id) : 'empty',
              });
            }
          }

          success = await this.createRemote(config, op.payload, organizationId, {
            pendingOpId: op.id,
          });
        } else if (op.operation === 'update') {
          // ✅ STRATÉGIE PATCH-FIRST : Tenter directement PATCH, fallback 404 → POST
          // Pas de GET de pré-vérification (offline-first, pas de read serveur)
          if (config.entity === 'echeance') {
            try {
              // Tenter directement PATCH
              success = await this.updateRemote(config, op.entityId, op.payload, organizationId);
            } catch (updateError: any) {
              // Vérifier si c'est une erreur 404 (échéance n'existe pas sur le serveur)
              const is404 = (typeof updateError.status === 'number' && updateError.status === 404) ||
                           updateError.message?.includes('404');
              
              if (is404) {
                // Fallback : convertir l'update en create
                console.log(`[GlobalSync] 🔄 Échéance ${op.entityId} n'existe pas sur le serveur (404), conversion update → create`);
                const db = await this.getDb();
                
                // Vérifier s'il y a une pendingOp 'create' pour cette échéance
                const createOp = await db.pendingOperations
                  .where('entityId')
                  .equals(op.entityId)
                  .filter(op => op.operation === 'create')
                  .first();
                
                if (createOp && createOp.status === 'pending') {
                  // Il y a une pendingOp 'create' en attente, on doit attendre qu'elle soit synchronisée
                  console.log(`[GlobalSync] 🔄 Échéance ${op.entityId} : pendingOp 'update' bloquée, attend la création`);
                  await db.pendingOperations.update(op.id, {
                    status: 'pending',
                    errorMessage: `Échéance non synchronisée. La création sera effectuée en premier, puis la mise à jour.`,
                    updatedAt: new Date().toISOString(),
                  });
                  continue; // Skip cette opération pour l'instant, elle sera retentée après la création
                } else {
                  // Pas de pendingOp 'create', convertir l'update en create
                  const localItem = await db.EcheanceRecurrente.get(op.entityId);
                  if (localItem) {
                    // Utiliser l'item local complet pour la création
                    const createPayload = config.transformToLocal 
                      ? config.transformToLocal(localItem)
                      : localItem;
                    // Exclure les métadonnées locales
                    const { _localUpdatedAt, _syncedAt, id, ...cleanPayload } = createPayload;
                    // Appliquer les modifications du payload d'update (ex: isActive: false)
                    if (op.payload && typeof op.payload === 'object') {
                      Object.assign(cleanPayload, op.payload);
                    }
                    success = await this.createRemote(config, cleanPayload, organizationId);
                  } else {
                    // L'échéance n'existe même plus localement, ignorer l'opération
                    console.warn(`[GlobalSync] ⚠️ Échéance ${op.entityId} n'existe plus localement, opération ignorée`);
                    await db.pendingOperations.update(op.id, {
                      status: 'error',
                      errorMessage: 'Échéance supprimée localement avant synchronisation',
                      updatedAt: new Date().toISOString(),
                    });
                    continue;
                  }
                }
              } else {
                // Autre erreur (500, 400, etc.) : log et garder la pending
                console.error(`[GlobalSync] ❌ Erreur PATCH échéance ${op.entityId}:`, updateError);
                throw updateError; // Re-lancer pour être catché plus bas et marquer en error
              }
            }
          } else if (config.entity === 'property') {
            // ✅ GESTION SPÉCIALE POUR PROPERTY : Même logique que pour echeance
            try {
              // Vérifier si la propriété existe sur le serveur en essayant de la récupérer
              const checkResponse = await fetch(`${config.apiRoute}/${op.entityId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
              });
              
              if (checkResponse.status === 404) {
                // La propriété n'existe pas encore sur le serveur
                const db = await this.getDb();
                
                // Vérifier s'il y a une pendingOp 'create' pour cette propriété (même organizationId)
                // ✅ Utiliser entityId (indexé) puis filtrer en mémoire par operation et organizationId
                const createOps = await db.pendingOperations
                  .where('entityId')
                  .equals(op.entityId)
                  .filter(op => op.operation === 'create' && op.organizationId === organizationId)
                  .toArray();
                
                // Chercher une pendingOp 'create' avec status 'pending' ou 'syncing' (pas encore synchronisée)
                const createOp = createOps.find(op => op.status === 'pending' || op.status === 'syncing');
                
                if (createOp) {
                  // Il y a une pendingOp 'create' en attente, on doit attendre qu'elle soit synchronisée
                  console.log(`[GlobalSync] 🔄 Propriété ${op.entityId} : pendingOp 'update' bloquée, attend la création (createOp.id=${createOp.id}, status=${createOp.status})`);
                  await db.pendingOperations.update(op.id, {
                    status: 'pending',
                    errorMessage: `Propriété non synchronisée. La création sera effectuée en premier, puis la mise à jour.`,
                    updatedAt: new Date().toISOString(),
                  });
                  continue; // Skip cette opération pour l'instant, elle sera retentée après la création
                } else {
                  // Pas de pendingOp 'create' active, convertir l'update en create
                  console.log(`[GlobalSync] 🔄 Propriété ${op.entityId} n'existe pas encore sur le serveur, conversion update → create (aucune createOp trouvée)`);
                  const localItem = await db.Property.get(op.entityId);
                  if (localItem && localItem.organizationId === organizationId) {
                    // ✅ Appliquer d'abord les modifications du payload de l'update sur l'item local
                    const updatedItem = { ...localItem, ...op.payload };
                    // ✅ Utiliser transformToRemote pour créer le payload propre pour l'API
                    const createPayload = config.transformToRemote 
                      ? config.transformToRemote(updatedItem)
                      : updatedItem;
                    // Exclure l'ID (sera généré par le serveur)
                    const { id, ...cleanPayload } = createPayload;
                    success = await this.createRemote(config, cleanPayload, organizationId);
                  } else {
                    // La propriété n'existe même plus localement ou appartient à une autre org, ignorer l'opération
                    console.warn(`[GlobalSync] ⚠️ Propriété ${op.entityId} n'existe plus localement ou appartient à une autre org, opération ignorée`);
                    await db.pendingOperations.update(op.id, {
                      status: 'error',
                      errorMessage: 'Propriété supprimée localement avant synchronisation ou appartient à une autre organisation',
                      updatedAt: new Date().toISOString(),
                    });
                    continue;
                  }
                }
              } else {
                // La propriété existe, procéder avec l'update normal
                success = await this.updateRemote(config, op.entityId, op.payload, organizationId);
              }
            } catch (checkError: any) {
              // En cas d'erreur lors de la vérification, essayer quand même l'update
              console.warn(`[GlobalSync] ⚠️ Erreur lors de la vérification de la propriété ${op.entityId}, tentative update:`, checkError);
              success = await this.updateRemote(config, op.entityId, op.payload, organizationId);
            }
          } else if (config.entity === 'userProfile') {
            // ⚠️ SPÉCIAL userProfile : L'API n'a pas de route PUT /api/profiles/:id
            // L'API utilise POST /api/profiles avec une logique upsert (create ou update)
            // L'API POST attend TOUS les champs requis (firstName, lastName, email) même pour un update
            // Donc on doit récupérer l'item local complet et appliquer les modifications
            const db = await this.getDb();
            const localProfile = await db.UserProfile.get(op.entityId);
            if (localProfile) {
              // Appliquer les modifications du payload sur l'item local complet
              const updatedProfile = { ...localProfile, ...op.payload };
              // Utiliser transformToRemote pour créer le payload propre pour l'API
              const createPayload = config.transformToRemote 
                ? config.transformToRemote(updatedProfile)
                : updatedProfile;
              // Exclure l'ID (sera généré/géré par le serveur lors de l'upsert)
              const { id, ...cleanPayload } = createPayload;
              success = await this.createRemote(config, cleanPayload, organizationId);
            } else {
              // Le profil n'existe même plus localement, ignorer l'opération
              console.warn(`[GlobalSync] ⚠️ Profil ${op.entityId} n'existe plus localement, opération ignorée`);
              await db.pendingOperations.update(op.id, {
                status: 'error',
                errorMessage: 'Profil supprimé localement avant synchronisation',
                updatedAt: new Date().toISOString(),
              });
              continue;
            }
          } else if (config.entity === 'transaction') {
            // ⚠️ Transaction : en local l'id peut rester l'UUID ; le serveur attend l'id serveur (serverId)
            // Fusionner la transaction locale avec le payload pour garantir chargesRecup/chargesNonRecup (éviter perte après overwrite)
            let transactionIdForPut = op.entityId;
            let bodyForPut = op.payload;
            try {
              const db = await this.getDb();
              let table: any = (db as any).Transaction;
              if (!table || typeof table === 'function' || typeof table?.get !== 'function') {
                table = db.tables?.find((t: any) => t.name === 'Transaction');
              }
              if (table && typeof table.get === 'function') {
                const localTx = await table.get(op.entityId);
                if (localTx) {
                  if (localTx.serverId) transactionIdForPut = localTx.serverId;
                  // Body complet = local + payload (les champs charges peuvent ne pas être dans le payload partiel)
                  bodyForPut = { ...localTx, ...(op.payload || {}) };
                }
              }
            } catch (_) { /* garder op.entityId et op.payload */ }
            success = await this.updateRemote(config, transactionIdForPut, bodyForPut, organizationId);
          } else {
            // Pour les autres entités, comportement normal
            success = await this.updateRemote(config, op.entityId, op.payload, organizationId);
          }
        } else if (op.operation === 'delete') {
          // ⚠️ CRITIQUE: Vérifier que le payload est bien défini pour les propriétés
          // Si le payload est vide ou undefined, l'API utilisera le mode par défaut 'archive'
          let deletePayload = op.payload;
          if (config.entity === 'property' && (!deletePayload || !deletePayload.mode)) {
            console.warn(`[GlobalSync] ⚠️ Opération DELETE pour property ${op.entityId} sans mode, utilisation de 'cascade' par défaut`);
            deletePayload = { mode: 'cascade' };
          }
          success = await this.deleteRemote(config, op.entityId, organizationId, deletePayload);
        }

        if (success) {
          if (config.entity === 'marketInvestmentSettings' || config.entity === 'marketInvestmentActionLog') {
            await this.markMarketEntitySyncedLocally(config, organizationId, op.entityId);
          }
          // Suppression immédiate : push silencieux, aucune trace "synchronisé" sur la page Sync
          await db.pendingOperations.delete(op.id);
          synced++;
        } else {
          throw new Error('Opération échouée');
        }
      } catch (error: any) {
        console.error(`[GlobalSync] Erreur sync op ${config.entity}:`, error);

        // Isolation robuste: lease:create cassée (FK property introuvable) ne doit pas polluer chaque refresh.
        const isLeaseCreatePropertyNotFound =
          config.entity === 'lease' &&
          op.operation === 'create' &&
          typeof error?.message === 'string' &&
          error.message.includes('Propriété introuvable');
        if (isLeaseCreatePropertyNotFound) {
          const p = op.payload || {};
          const remoteLeaseByIdExists =
            classifySmartimmoId(op.entityId) === 'cuid_remote'
              ? await fetch(`/api/leases/${encodeURIComponent(op.entityId)}`, {
                  method: 'GET',
                  headers: { 'Content-Type': 'application/json' },
                })
                  .then((r) => r.ok)
                  .catch(() => false)
              : false;

          if (remoteLeaseByIdExists) {
            await db.pendingOperations.delete(op.id);
            logToServer(
              `[APP-SHELL][SYNC][LEASE_GHOST_CREATE] delete op=${op.id} entityId=${op.entityId} reason=remote_exists_after_property_not_found`
            );
            continue;
          }

          await db.pendingOperations.update(op.id, {
            status: 'blocked_permanent',
            errorMessage: `Lease create isolée: propriété introuvable (propertyId=${p.propertyId ?? 'null'}, tenantId=${p.tenantId ?? 'null'}, startDate=${p.startDate ?? 'null'}, rentAmount=${p.rentAmount ?? 'null'})`,
            blockReason: `lease_create_property_not_found: entityId=${op.entityId}, propertyId=${p.propertyId ?? 'null'}, tenantId=${p.tenantId ?? 'null'}`,
            updatedAt: new Date().toISOString(),
          });
          logToServer(
            `[APP-SHELL][SYNC][LEASE_CREATE_ISOLATED] op=${op.id} entityId=${op.entityId} propertyId=${p.propertyId ?? 'null'} tenantId=${p.tenantId ?? 'null'}`
          );
          continue;
        }

        // ⚠️ GARDE-FOU 3 : Pour documentLink avec TRANSACTION_NOT_SYNCED, bloquer avec raison explicite
        // Cela se produit quand un DocumentLink référence une transaction locale qui n'a pas encore de serverId
        // La pendingOp reste en 'pending' pour être retentée automatiquement après la sync de la transaction
        const isTransactionNotSynced = config.entity === 'documentLink' && 
                                        error.message && 
                                        error.message.includes('TRANSACTION_NOT_SYNCED');
        
        if (isTransactionNotSynced) {
          const txId = op.payload?.linkedId;
          const docId = op.payload?.documentId;
          // ⚠️ Message explicite avec détails pour diagnostic dans la page Sync
          const blockReason = `DocumentLink bloqué: Transaction ${txId} non synchronisée (serverId manquant). Document: ${docId}. Le DocumentLink sera poussé automatiquement après la synchronisation de la transaction.`;
          console.warn(`[GlobalSync] 🚫 GARDE-FOU 3: DocumentLink bloqué (TRANSACTION_NOT_SYNCED) pour transaction ${txId}, document ${docId}`);
          
          await db.pendingOperations.update(op.id, {
            status: 'pending', // Garder en pending pour retry automatique après sync transaction
            errorMessage: blockReason,
            blockReason: `transaction_not_synced: txId=${txId}, docId=${docId}`,
            updatedAt: new Date().toISOString(),
          });
          // Ne pas compter comme erreur, sera retenté automatiquement après sync transaction
          continue;
        }

        // ⚠️ GARDE-FOU 4 : Pour property DELETE avec mode: 'archive' et ARCHIVE_BLOCKED_WAITING_CREATE
        // La propriété n'existe pas encore sur le serveur, on doit attendre la création
        const isArchiveBlockedWaitingCreate = config.entity === 'property' && 
                                               op.operation === 'delete' &&
                                               op.payload?.mode === 'archive' &&
                                               error.message && 
                                               error.message.includes('ARCHIVE_BLOCKED_WAITING_CREATE');
        
        if (isArchiveBlockedWaitingCreate) {
          console.warn(`[GlobalSync] 🚫 GARDE-FOU 4: Property DELETE (archive) bloqué pour ${op.entityId}, attend la création`);
          
          await db.pendingOperations.update(op.id, {
            status: 'pending', // Garder en pending pour retry automatique après création
            errorMessage: `Archivage bloqué: La propriété n'existe pas encore sur le serveur. L'archivage sera effectué automatiquement après la création.`,
            blockReason: `archive_blocked_waiting_create: propertyId=${op.entityId}`,
            updatedAt: new Date().toISOString(),
          });
          continue; // Skip cette opération pour l'instant, elle sera retentée après la création
        }

        // ⚠️ GESTION SPÉCIALE : Pour documentLink avec 404, gestion robuste avec retry + pull ciblé
        // Le document/transaction n'est pas encore disponible côté serveur
        const isDocumentLink404 = config.entity === 'documentLink' && 
                                   error.message && 
                                   (error.message.includes('404') || error.message.includes('Document non trouvé'));
        
        if (isDocumentLink404) {
          const docId = op.payload?.documentId;
          const currentRetryCount = op.retryCount || 0;
          
          // Si première tentative (retryCount === 0) : faire un pull ciblé et retry une fois
          if (currentRetryCount === 0) {
            console.log(`[GlobalSync] 🔄 DocumentLink 404 (1ère tentative): document ${docId} non trouvé. Pull ciblé document/documentLink puis retry...`);
            
            try {
              // Pull ciblé : document et documentLink
              await this.syncEntityFromRemoteByName('document', organizationId);
              await this.syncEntityFromRemoteByName('documentLink', organizationId);
              
              // Vérifier si le document existe maintenant localement
              const localDoc = await db.Document.get(docId);
              if (localDoc) {
                console.log(`[GlobalSync] ✅ Document ${docId} maintenant présent localement après pull. Retry de la pendingOp...`);
                // Incrémenter retryCount et garder en pending pour retry immédiat
                await db.pendingOperations.update(op.id, {
                  status: 'pending',
                  retryCount: 1,
                  errorMessage: `Dépendance non satisfaite (1ère tentative avec pull): document ${docId} non trouvé. Pull effectué, retry en cours.`,
                  updatedAt: new Date().toISOString(),
                });
                // Ne pas compter comme erreur, sera retenté dans la même boucle
                continue;
              } else {
                console.warn(`[GlobalSync] ⚠️ Document ${docId} toujours absent après pull. Probable problème de scope orgId ou document jamais créé.`);
              }
            } catch (pullError: any) {
              console.error(`[GlobalSync] Erreur lors du pull ciblé pour document ${docId}:`, pullError);
            }
          }
          
          // Si retryCount >= 1 : document toujours introuvable après pull → bloquer permanent
          if (currentRetryCount >= 1) {
            const blockReason = `Document ${docId} introuvable côté serveur après pull ciblé (orgId: ${organizationId}). Possible problème de scope ou document jamais créé.`;
            console.error(`[GlobalSync] 🚫 BLOCKED_PERMANENT DocumentLink pour document ${docId}:`, blockReason);
            
            await db.pendingOperations.update(op.id, {
              status: 'blocked_permanent',
              errorMessage: blockReason,
              blockReason: `docId=${docId}, orgId=${organizationId}, entityType=${op.payload?.linkedType}, entityId=${op.payload?.linkedId}`,
              updatedAt: new Date().toISOString(),
            });
            // Ne pas compter comme erreur normale (c'est un blocage diagnostiqué)
            continue;
          }
          
          // Sinon (retryCount === 0 et pull a échoué ou document toujours absent) : incrémenter et garder en pending pour retry
          await db.pendingOperations.update(op.id, {
            status: 'pending',
            retryCount: 1,
            errorMessage: `Dépendance non satisfaite: document ${docId} non trouvé après pull. Retry en cours.`,
            updatedAt: new Date().toISOString(),
          });
          continue;
        }

        const retryCount = (op.retryCount || 0) + 1;
        await db.pendingOperations.update(op.id, {
          status: retryCount < 3 ? 'pending' : 'error',
          errorMessage: error.message || 'Erreur inconnue',
          retryCount,
          updatedAt: new Date().toISOString(),
        });

        errors++;
      }
    }

    return { success: errors === 0, synced, errors };
  }

  /**
   * Crée un enregistrement sur le serveur
   */
  private async createRemote(
    config: EntitySyncConfig,
    payload: any,
    organizationId: string,
    meta?: { pendingOpId?: string }
  ): Promise<boolean> {
    // ⚠️ GESTION SPÉCIALE POUR documentLink : clé composite
    // L'API utilise POST /api/documents/{documentId}/links avec { entityType, entityId }
    let apiRoute: string;
    let requestBody: any;
    
    if (config.entity === 'documentLink' && payload && payload.documentId && payload.linkedType && payload.linkedId) {
      // Construire la route spéciale pour documentLink
      apiRoute = `/api/documents/${payload.documentId}/links`;
      // L'API attend { entityType, entityId }
      // ⚠️ Normaliser linkedType en minuscules (peut être en majuscules depuis IndexedDB comme 'TRANSACTION')
      const normalizedLinkedType = payload.linkedType.toLowerCase();
      let entityIdToUse = payload.linkedId;
      
      // ⚠️ FIX ROBUSTE : Résolution just-in-time pour les DocumentLinks vers transactions et prêts
      // Si linkedType='transaction' ou 'loan' et linkedId est un UUID local, résoudre le serverId
      if ((normalizedLinkedType === 'transaction' || normalizedLinkedType === 'loan') && payload.linkedId) {
        // Vérifier si linkedId ressemble à un UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
        const isUUIDFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.linkedId);
        
        if (isUUIDFormat) {
          // C'est probablement un UUID local, résoudre le serverId depuis la transaction locale
          const db = await this.getDb();
          try {
            // Chercher la transaction locale avec cet UUID
            let transactionTable: any;
            transactionTable = (db as any).Transaction;
            if (!transactionTable || typeof transactionTable === 'function' || typeof transactionTable.get !== 'function') {
              const foundTable = db.tables.find((t: any) => t.name === 'Transaction');
              if (foundTable && typeof foundTable.get === 'function') {
                transactionTable = foundTable;
              }
            }
            
            if (normalizedLinkedType === 'transaction') {
              if (transactionTable && typeof transactionTable.get === 'function') {
                const localTransaction = await transactionTable.get(payload.linkedId);
                
                if (!localTransaction) {
                  // Transaction non trouvée → bloquer
                  throw new Error(`TRANSACTION_NOT_SYNCED: Transaction ${payload.linkedId} non trouvée localement. Le DocumentLink sera poussé après la synchronisation de la transaction.`);
                }
                
                // ⚠️ FIX ROBUSTE : Utiliser serverId si disponible (résolution just-in-time)
                if (localTransaction.serverId) {
                  entityIdToUse = localTransaction.serverId;
                } else {
                  // Transaction trouvée mais pas encore synchronisée (pas de serverId) → bloquer
                  throw new Error(`TRANSACTION_NOT_SYNCED: Transaction ${payload.linkedId} n'a pas encore été synchronisée (serverId manquant). Le DocumentLink sera poussé après la synchronisation de la transaction.`);
                }
              } else {
                // Table Transaction non accessible → bloquer pour sécurité
                throw new Error(`TRANSACTION_NOT_SYNCED: Impossible d'accéder à la table Transaction pour résoudre ${payload.linkedId}. Le DocumentLink sera poussé après la synchronisation de la transaction.`);
              }
            } else if (normalizedLinkedType === 'loan') {
              // ✅ GESTION SPÉCIALE POUR LOAN : Résolution just-in-time pour les DocumentLinks vers prêts
              const localLoan = await db.Loan.get(payload.linkedId);
              
              if (!localLoan) {
                // Prêt non trouvé → bloquer
                throw new Error(`LOAN_NOT_SYNCED: Prêt ${payload.linkedId} non trouvé localement. Le DocumentLink sera poussé après la synchronisation du prêt.`);
              }
              
              // Pour les prêts, on utilise directement l'ID local (pas de serverId comme pour les transactions)
              // L'ID du prêt est déjà un UUID qui sera accepté par l'API
              entityIdToUse = payload.linkedId;
            }
          } catch (lookupError: any) {
            // Si l'erreur contient TRANSACTION_NOT_SYNCED ou LOAN_NOT_SYNCED, la propager pour bloquer la pendingOp
            if (lookupError.message && (lookupError.message.includes('TRANSACTION_NOT_SYNCED') || lookupError.message.includes('LOAN_NOT_SYNCED'))) {
              throw lookupError;
            }
            // Sinon, continuer avec l'ID original (fallback, mais devrait être rare)
            console.warn(`[GlobalSync] ⚠️ Erreur lors de la résolution de l'entité ${payload.linkedId}:`, lookupError);
          }
        }
      }
      
      const normalizedLinkedId = (entityIdToUse || '').toLowerCase();
      
      requestBody = {
        entityType: normalizedLinkedType,
        // ⚠️ Pour 'global', ne pas envoyer entityId (l'API utilisera entityType.toLowerCase() = 'global' comme linkedId)
        // Pour les autres types, envoyer entityId tel quel (c'est un ID réel d'entité)
        ...(normalizedLinkedType === 'global' || normalizedLinkedId === 'global' 
          ? {} 
          : { entityId: entityIdToUse }),
      };
      // ⚠️ LOG : Juste avant l'appel POST /links (si résolution UUID → serverId)
      if (normalizedLinkedType === 'transaction' && entityIdToUse !== payload.linkedId) {
        console.log(`[GlobalSync] 🔗 DocumentLink: UUID ${payload.linkedId} → serverId ${entityIdToUse} (docId: ${payload.documentId})`);
      } else if (normalizedLinkedType === 'loan') {
        console.log(`[GlobalSync] 🔗 DocumentLink: Prêt ${payload.linkedId} (docId: ${payload.documentId})`);
      }
    } else if (config.entity === 'loanBorrower' && payload && payload.loanId) {
      // ✅ GESTION SPÉCIALE POUR loanBorrower : l'API utilise /api/loans/:loanId/borrowers
      apiRoute = config.apiRoute.replace(':loanId', payload.loanId);
      const transformed = config.transformToRemote
        ? config.transformToRemote(payload)
        : payload;
      // Exclure l'ID et loanId si présent (création)
      const { id, loanId, ...dataWithoutId } = transformed;
      requestBody = dataWithoutId;
    } else {
      // ⚠️ LEASE: relire le payload pending le plus récent juste avant POST.
      // Évite d'envoyer des FK obsolètes (propertyId/tenantId) quand un remapping
      // a été fait en base pendant ce même cycle de synchronisation.
      if (config.entity === 'lease') {
        try {
          const db = await this.getDb();
          // ⚠️ CRITIQUE : pendant la sync l'op courante est en `syncing`, pas `pending`.
          // Préférer pendingOpId (opération exacte) pour relire le payload à jour (FK remappées).
          let latestLeasePending: PendingOperation | undefined;
          if (meta?.pendingOpId) {
            latestLeasePending = (await db.pendingOperations.get(meta.pendingOpId)) || undefined;
          }
          if (!latestLeasePending && payload?.id) {
            latestLeasePending = await db.pendingOperations
              .where('entityId')
              .equals(payload.id)
              .and((op: PendingOperation) =>
                op.entity === 'lease' && (op.status === 'pending' || op.status === 'syncing')
              )
              .first();
          }
          if (latestLeasePending?.payload && typeof latestLeasePending.payload === 'object') {
            payload = { ...payload, ...latestLeasePending.payload };
          }
        } catch (reloadError) {
          console.warn('[GlobalSync] ⚠️ Impossible de relire le payload lease récent:', reloadError);
        }
      }

      // Route normale
      const transformed = config.transformToRemote
        ? config.transformToRemote(payload)
        : payload;
      // Certaines entités (ex. marché) utilisent un id client stable envoyé dès la création.
      const keepClientIdOnCreate =
        config.entity === 'marketInvestmentSettings' || config.entity === 'marketInvestmentActionLog';
      const { id, ...dataWithoutId } = transformed;
      apiRoute = config.apiRoute;
      requestBody = keepClientIdOnCreate ? transformed : dataWithoutId;

      // App-shell : indices pour résolution FK côté API si l'ID local ne correspond pas au serveur
      if (config.entity === 'lease' && payload?.id) {
        try {
          const db = await this.getDb();
          const leaseRow = await db.Lease.get(payload.id);
          if (leaseRow) {
            const [prop, ten] = await Promise.all([
              db.Property.get(leaseRow.propertyId),
              db.Tenant.get(leaseRow.tenantId),
            ]);
            const hints: Record<string, string> = {};
            if (prop) {
              if (prop.name) hints.propertyName = String(prop.name);
              if (prop.address) hints.propertyAddress = String(prop.address);
              if (prop.city) hints.propertyCity = String(prop.city);
              if (prop.postalCode) hints.propertyPostalCode = String(prop.postalCode);
            }
            if (ten) {
              if (ten.email) hints.tenantEmail = String(ten.email);
              if (ten.firstName) hints.tenantFirstName = String(ten.firstName);
              if (ten.lastName) hints.tenantLastName = String(ten.lastName);
            }
            if (Object.keys(hints).length > 0) {
              requestBody = { ...requestBody, __syncHints: hints };
            }
          }
        } catch (hintError) {
          console.warn('[GlobalSync] ⚠️ Impossible d’attacher __syncHints pour lease:', hintError);
        }
      }
    }

    // Logs supprimés pour réduire la verbosité (nécessaire uniquement en debug)

    if (config.entity === 'lease' && requestBody) {
      const diagLeaseId = getLeaseSignatureDiagLeaseId();
      const verboseDiag = process.env.NEXT_PUBLIC_LEASE_SIGN_DIAG === '1';
      if ((diagLeaseId && payload?.id === diagLeaseId) || verboseDiag) {
        try {
          const bodyForLog = JSON.parse(JSON.stringify(requestBody));
          logLeaseSignWorkflowDiag({
            step: '5_before_post_api_leases',
            organizationId,
            pendingOpId: meta?.pendingOpId,
            leaseLocalId: payload?.id,
            apiRoute,
            requestBodyJson: JSON.stringify(bodyForLog),
            ...summarizeFkPair(bodyForLog.propertyId, bodyForLog.tenantId),
            hasSyncHintsFallback: Object.prototype.hasOwnProperty.call(
              bodyForLog,
              '__syncHints'
            ),
          });
        } catch {
          /* ignore */
        }
      }
    }

    let response = await fetch(apiRoute, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    // Fallback robuste App-Shell: si le bail référence une FK locale non résolue,
    // tenter un remap property/tenant par matching métier puis retenter une seule fois.
    if (!response.ok && config.entity === 'lease' && response.status === 404) {
      try {
        const normalize = (v: unknown) => String(v ?? '').trim().toLowerCase();
        const db = await this.getDb();
        const localLease = payload?.id ? await db.Lease.get(payload.id) : null;
        if (localLease) {
          const [propertiesRes, tenantsRes] = await Promise.all([
            fetch('/api/properties?limit=10000&includeArchived=true'),
            fetch('/api/tenants?limit=10000'),
          ]);
          if (propertiesRes.ok && tenantsRes.ok) {
            const propertiesJson = await propertiesRes.json();
            const tenantsJson = await tenantsRes.json();
            const remoteProperties = propertiesJson?.data || propertiesJson?.items || [];
            const remoteTenants = tenantsJson?.data || tenantsJson?.items || [];
            const localProperty = await db.Property.get(localLease.propertyId);
            const localTenant = await db.Tenant.get(localLease.tenantId);

            let remappedPropertyId = localLease.propertyId;
            let remappedTenantId = localLease.tenantId;

            if (!remoteProperties.some((p: any) => p.id === localLease.propertyId) && localProperty) {
              const matched = remoteProperties.find(
                (p: any) =>
                  normalize(p.name) === normalize(localProperty.name) &&
                  normalize(p.address) === normalize(localProperty.address) &&
                  normalize(p.city) === normalize(localProperty.city) &&
                  normalize(p.postalCode) === normalize(localProperty.postalCode)
              );
              if (matched?.id) remappedPropertyId = matched.id;
            }

            if (!remoteTenants.some((t: any) => t.id === localLease.tenantId) && localTenant) {
              const matched = remoteTenants.find(
                (t: any) =>
                  (localTenant.email && t.email && normalize(t.email) === normalize(localTenant.email)) ||
                  (normalize(t.firstName) === normalize(localTenant.firstName) &&
                    normalize(t.lastName) === normalize(localTenant.lastName))
              );
              if (matched?.id) remappedTenantId = matched.id;
            }

            if (remappedPropertyId !== localLease.propertyId || remappedTenantId !== localLease.tenantId) {
              await db.Lease.update(localLease.id, {
                propertyId: remappedPropertyId,
                tenantId: remappedTenantId,
                _localUpdatedAt: new Date().toISOString(),
              } as any);

              const pendingLeaseOps: PendingOperation[] = [];
              if (meta?.pendingOpId) {
                const cur = await db.pendingOperations.get(meta.pendingOpId);
                if (cur && cur.entity === 'lease') pendingLeaseOps.push(cur);
              }
              if (pendingLeaseOps.length === 0) {
                const more = await db.pendingOperations
                  .where('entityId')
                  .equals(localLease.id)
                  .and((op: PendingOperation) =>
                    op.entity === 'lease' && (op.status === 'pending' || op.status === 'syncing')
                  )
                  .toArray();
                pendingLeaseOps.push(...more);
              }

              for (const op of pendingLeaseOps) {
                await db.pendingOperations.update(op.id, {
                  payload: {
                    ...(op.payload || {}),
                    propertyId: remappedPropertyId,
                    tenantId: remappedTenantId,
                  },
                  updatedAt: new Date().toISOString(),
                } as any);
              }

              requestBody = {
                ...(requestBody || {}),
                propertyId: remappedPropertyId,
                tenantId: remappedTenantId,
              };
              // Recalculer les hints après remap
              try {
                const [prop, ten] = await Promise.all([
                  db.Property.get(remappedPropertyId),
                  db.Tenant.get(remappedTenantId),
                ]);
                const hints: Record<string, string> = {};
                if (prop) {
                  if (prop.name) hints.propertyName = String(prop.name);
                  if (prop.address) hints.propertyAddress = String(prop.address);
                  if (prop.city) hints.propertyCity = String(prop.city);
                  if (prop.postalCode) hints.propertyPostalCode = String(prop.postalCode);
                }
                if (ten) {
                  if (ten.email) hints.tenantEmail = String(ten.email);
                  if (ten.firstName) hints.tenantFirstName = String(ten.firstName);
                  if (ten.lastName) hints.tenantLastName = String(ten.lastName);
                }
                if (Object.keys(hints).length > 0) {
                  requestBody.__syncHints = hints;
                }
              } catch {
                /* ignore */
              }

              response = await fetch(apiRoute, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
              });
            }
          }
        }
      } catch (fallbackError) {
        console.warn('[GlobalSync] ⚠️ Fallback remap lease FK échoué:', fallbackError);
      }
    }

    // Logs supprimés pour réduire la verbosité

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // ⚠️ GESTION SPÉCIALE : Si erreur 404 pour documentLink, le document n'existe pas encore côté serveur
      // On lance une erreur spécifique qui sera catchée dans syncEntityPendingToRemote pour garder la pendingOp en pending
      if (response.status === 404 && config.entity === 'documentLink') {
        const errorMsg = `Document non trouvé pour créer le lien (404): ${payload.documentId}`;
        console.warn(`[GlobalSync] ⚠️ ${errorMsg}. Le document sera synchronisé lors de la prochaine sync.`);
        // Lancer une erreur avec un message spécial pour être catchée par syncEntityPendingToRemote
        throw new Error(errorMsg);
      }
      
      // ⚠️ GESTION SPÉCIALE : Formater les erreurs Zod (400) pour userProfile
      if (response.status === 400 && config.entity === 'userProfile' && errorData.error && Array.isArray(errorData.error)) {
        // Les erreurs Zod sont un tableau d'objets avec path et message
        const errorMessages = errorData.error.map((err: any) => {
          const path = err.path ? err.path.join('.') : '';
          return path ? `${path}: ${err.message}` : err.message;
        }).join(', ');
        const errorMsg = `Erreur de validation: ${errorMessages}`;
        const error = new Error(errorMsg) as any;
        error.status = response.status;
        throw error;
      }
      
      // ⚠️ RÉCONCILIATION : Si erreur 400/409 et que la transaction existe déjà sur le serveur,
      // vérifier si elle existe déjà et marquer la pendingOp comme synced
      if ((response.status === 400 || response.status === 409) && config.entity === 'transaction') {
        const db = await this.getDb();
        const localTransaction = await db.Transaction.get(payload.id);
        
        if (localTransaction) {
          // Vérifier si une transaction similaire existe déjà en cherchant par critères
          try {
            const checkResponse = await fetch(
              `${config.apiRoute}?propertyId=${localTransaction.propertyId}&limit=1000`,
              { method: 'GET' }
            );
            
            if (checkResponse.ok) {
              const checkData = await checkResponse.json();
              const transactions = Array.isArray(checkData) 
                ? checkData 
                : (checkData.items || checkData.transactions || checkData.data || []);
              
              // Chercher une transaction correspondante par label, amount, date
              const matching = transactions.find((t: any) => {
                const sameLabel = t.label === localTransaction.label;
                const sameAmount = Math.abs(t.amount - localTransaction.amount) < 0.01;
                const sameDate = new Date(t.date).toISOString().split('T')[0] === 
                                new Date(localTransaction.date).toISOString().split('T')[0];
                return sameLabel && sameAmount && sameDate;
              });
              
              if (matching) {
                console.log(`[GlobalSync] ⚠️ Transaction déjà existante sur le serveur (id: ${matching.id}), réconciliation...`);
                
                // Mettre à jour l'ID local si différent
                if (payload.id !== matching.id) {
                  let table: any;
                  if (config.tableName === 'Transaction') {
                    table = (db as any).Transaction;
                    if (!table || typeof table === 'function' || typeof table.where !== 'function') {
                      const transactionTable = db.tables.find((t: any) => t.name === 'Transaction');
                      if (transactionTable && typeof transactionTable.where === 'function') {
                        table = transactionTable;
                      }
                    }
                  } else {
                    table = db[config.tableName] as any;
                  }
                  
                  if (table && typeof table.update === 'function') {
                    await table.update(payload.id, { id: matching.id });
                  }
                }
                
                // Marquer comme synced (la transaction existe déjà)
                return true; // Indique que la sync a "réussi" (transaction déjà présente)
              }
            }
          } catch (checkError) {
            console.warn(`[GlobalSync] Erreur lors de la vérification d'existence:`, checkError);
          }
        }
      }
      
      console.error(`[GlobalSync] ❌ Erreur ${response.status} - Détails:`, errorData);
      
      // Afficher les détails Zod si présents pour faciliter le débogage
      if (errorData.details && Array.isArray(errorData.details)) {
        console.error(`[GlobalSync] Erreurs de validation Zod:`, errorData.details.map((d: any) => ({
          path: d.path,
          message: d.message,
          expected: d.expected,
          received: d.received,
        })));
      }
      
      throw new Error(errorData.error || `Erreur ${response.status}`);
    }

    const created = await response.json();
    
    // ⚠️ GESTION SPÉCIALE POUR TRANSACTION : L'API retourne { transaction, allTransactions, ... }
    // Extraire l'ID de la transaction créée
    let createdId: string | undefined;
    if (config.entity === 'transaction') {
      // L'API transactions retourne { transaction: Transaction, allTransactions: Transaction[] }
      // Pour les transactions multi-mois, allTransactions contient toutes les transactions créées
      if (created.allTransactions && Array.isArray(created.allTransactions) && created.allTransactions.length > 0) {
        // Si plusieurs transactions créées (multi-mois), prendre la transaction correspondant au payload original
        // (généralement la première, sauf si monthsCovered > 1)
        const matchingTransaction = created.allTransactions.find((t: any) => {
          // Essayer de matcher par label et amount (plus fiable que par index)
          return t.label === payload.label && Math.abs(t.amount - payload.amount) < 0.01;
        }) || created.allTransactions[0];
        createdId = matchingTransaction.id;
      } else if (created.transaction?.id) {
        createdId = created.transaction.id;
      } else if (created.id) {
        // Fallback : si l'API retourne directement un id (format simple)
        createdId = created.id;
      }
    } else if (config.entity === 'documentLink') {
      // ⚠️ GESTION SPÉCIALE POUR documentLink : L'API retourne { success: true, data: DocumentLink }
      // Pour documentLink, on n'a pas besoin de mettre à jour l'ID car c'est une clé composite
      // Le lien existe déjà avec la même clé composite localement
      createdId = undefined; // Pas de mise à jour d'ID nécessaire
    } else {
      createdId = created.id || created.data?.id;
    }
    
    // ⚠️ SÉCURISATION : Sauvegarder l'ancien ID local AVANT toute mise à jour
    const oldLocalEntityId = payload.id;
    
    // ⚠️ Log seulement si transaction avec ID différent (cas important pour serverId)
    if (config.entity === 'transaction' && oldLocalEntityId && createdId && oldLocalEntityId !== createdId) {
      console.log(`[GlobalSync] ✅ Transaction créée: UUID local=${oldLocalEntityId} → serverId=${createdId}`);
    }

    // Mettre à jour l'ID local avec l'ID serveur si nécessaire
    // ⚠️ IMPORTANT : Si createdId est undefined, on garde l'ID local et on continue
    // (cela peut arriver si l'API retourne un format inattendu ou pour documentLink qui a une clé composite)
    // ⚠️ documentLink n'a pas besoin de mise à jour d'ID (clé composite)
    // ⚠️ POINT 3 : Si IDs identiques, désactiver le remapping pour éviter de toucher des pendingOps inutilement
    if (config.entity !== 'documentLink' && oldLocalEntityId && createdId && oldLocalEntityId !== createdId) {
      const db = await this.getDb();
      // ⚠️ GESTION SPÉCIALE POUR TRANSACTION : db.Transaction est une fonction au lieu d'un objet Table
      let table: any;
      if (config.tableName === 'Transaction') {
        table = (db as any).Transaction;
        if (!table || typeof table === 'function' || typeof table.where !== 'function') {
          const transactionTable = db.tables.find(t => t.name === 'Transaction');
          if (transactionTable && typeof transactionTable.where === 'function') {
            table = transactionTable;
          } else {
            console.warn(`[GlobalSync] ⚠️ Table Transaction non accessible pour mise à jour ID, skip`);
            // Ne pas lancer d'exception, juste continuer
          }
        }
        
        if (table && typeof table.update === 'function') {
          try {
            // ⚠️ FIX ROBUSTE : Stocker le serverId au lieu de remplacer l'ID local
            // Cela permet la résolution just-in-time des DocumentLinks sans dépendre du remapping
            await table.update(oldLocalEntityId, { serverId: createdId });
            // ⚠️ NOTE : Les commissions sont server-only (skipAutoCommissions=true en app-shell)
            // Elles seront créées côté serveur et récupérées lors du pull suivant
          } catch (updateError: any) {
            console.error(`[GlobalSync] ❌ Erreur stockage serverId: ${oldLocalEntityId} → ${createdId}:`, updateError);
            // Ne pas bloquer la sync si la mise à jour du serverId échoue
          }
        }
      } else {
        table = db[config.tableName] as any;
        if (table && typeof table.update === 'function') {
          try {
            await table.update(oldLocalEntityId, { id: createdId });
            console.log(`[GlobalSync] 🔄 ID ${config.entity} mis à jour en local: ${oldLocalEntityId} → ${createdId}`);
          } catch (updateError: any) {
            console.error(`[GlobalSync] Erreur lors de la mise à jour de l'ID local ${oldLocalEntityId} → ${createdId}:`, updateError);
            // Ne pas bloquer la sync si la mise à jour de l'ID échoue
          }
        }
      }
      
      // Mettre à jour aussi les opérations en attente
      try {
        // 1. Mettre à jour les pendingOps qui référencent directement cet entityId
        await db.pendingOperations
          .where('entityId')
          .equals(oldLocalEntityId)
          .modify((op: PendingOperation) => {
            op.entityId = createdId;
            if (op.payload && typeof op.payload === 'object') {
              op.payload = { ...op.payload, id: createdId };
            }
          });

        // 1bis. Remapper les clés étrangères dans les payloads lease create/update
        // après sync property/tenant (sinon POST /api/leases peut échouer "Propriété introuvable").
        if (config.entity === 'property' || config.entity === 'tenant') {
          const fkField = config.entity === 'property' ? 'propertyId' : 'tenantId';

          // 1ter. Remapper aussi les données locales déjà persistées (pas seulement les pendingOps)
          // sinon un bail local peut continuer à pointer vers un ancien UUID local inexistant côté API.
          if (fkField === 'propertyId') {
            await db.Lease
              .where('propertyId')
              .equals(oldLocalEntityId)
              .modify((lease: any) => {
                lease.propertyId = createdId;
                lease._localUpdatedAt = new Date().toISOString();
              });
            // Table Transaction peut être exposée différemment selon le runtime Dexie.
            const txTable: any =
              (db as any).Transaction && typeof (db as any).Transaction.where === 'function'
                ? (db as any).Transaction
                : db.tables.find((t: any) => t.name === 'Transaction');
            if (txTable && typeof txTable.where === 'function') {
              await txTable
                .where('propertyId')
                .equals(oldLocalEntityId)
                .modify((tx: any) => {
                  tx.propertyId = createdId;
                  tx._localUpdatedAt = new Date().toISOString();
                });
            }
          } else {
            await db.Lease
              .where('tenantId')
              .equals(oldLocalEntityId)
              .modify((lease: any) => {
                lease.tenantId = createdId;
                lease._localUpdatedAt = new Date().toISOString();
              });
          }

          const leasePendingOps = await db.pendingOperations
            .where('entity')
            .equals('lease')
            .and((op: PendingOperation) => op.status === 'pending' || op.status === 'syncing')
            .toArray();

          for (const op of leasePendingOps) {
            const currentFk = op.payload?.[fkField];
            if (currentFk && currentFk === oldLocalEntityId) {
              const nextPayload = { ...(op.payload || {}), [fkField]: createdId };
              await db.pendingOperations.update(op.id, {
                payload: nextPayload,
                updatedAt: new Date().toISOString(),
              });
              if (process.env.NODE_ENV === 'development') {
                console.log(
                  `[GlobalSync] 🔁 FK remappée pour pending lease ${op.id}: ${fkField} ${oldLocalEntityId} -> ${createdId}`
                );
              }
            }
          }
        }
        
        // 2. ⚠️ CRITIQUE : Mettre à jour les DocumentLink pendingOps qui référencent cette transaction mère
        // Les DocumentLink ont linkedId dans leur payload, pas dans entityId
        // ⚠️ SÉCURISATION : Matcher sur oldLocalEntityId (l'ancien ID local) et non payload.id qui peut avoir changé
        // ⚠️ NOTE : Les commissions sont server-only (skipAutoCommissions=true en app-shell), donc pas de remapping nécessaire pour les commissions
        // Le remapping des DocumentLink pendingOps n'est plus nécessaire avec serverId, mais on le garde pour compatibilité
        // (les DocumentLinks utilisent maintenant la résolution just-in-time via serverId)
      } catch (pendingOpError: any) {
        console.error(`[GlobalSync] Erreur lors de la mise à jour des pendingOps:`, pendingOpError);
        // Ne pas bloquer la sync si la mise à jour des pendingOps échoue
      }
    } else if (!createdId && config.entity !== 'documentLink') {
      console.warn(`[GlobalSync] ⚠️ Aucun ID retourné par l'API pour la création (format réponse:`, Object.keys(created), '), transaction locale garde son ID:', payload.id);
      // ⚠️ CRITIQUE : Même sans ID serveur, on considère la création comme réussie
      // car la transaction existe maintenant sur le serveur (même si on n'a pas son ID)
      // La prochaine sync FROM remote récupérera la transaction avec son ID
    }

    if (config.entity === 'property' && createdId) {
      const lid = getLeaseSignatureDiagLeaseId();
      if (lid) {
        const db = await this.getDb();
        const lease = await db.Lease.get(lid);
        const leasePos = await db.pendingOperations.where('entityId').equals(lid).toArray();
        const leasePo = leasePos.find((p: PendingOperation) => p.entity === 'lease');
        logLeaseSignWorkflowDiag({
          step: '2_after_sync_property',
          organizationId,
          diagLeaseLocalId: lid,
          propertyLocalIdBefore: oldLocalEntityId,
          propertyRemoteIdFromApi: createdId,
          propertyIdMappingApplied: oldLocalEntityId !== createdId,
          leaseRowFk: lease ? summarizeFkPair(lease.propertyId, lease.tenantId) : null,
          pendingLeaseOpSnapshot: leasePo
            ? {
                pendingOpId: leasePo.id,
                status: leasePo.status,
                operation: leasePo.operation,
                ...summarizeFkPair(leasePo.payload?.propertyId, leasePo.payload?.tenantId),
                payloadPropertyIdMatchesRemoteProperty:
                  leasePo.payload?.propertyId === createdId,
              }
            : null,
        });
      }
    }

    if (config.entity === 'tenant' && createdId) {
      const lid = getLeaseSignatureDiagLeaseId();
      if (lid) {
        const db = await this.getDb();
        const lease = await db.Lease.get(lid);
        const leasePos = await db.pendingOperations.where('entityId').equals(lid).toArray();
        const leasePo = leasePos.find((p: PendingOperation) => p.entity === 'lease');
        logLeaseSignWorkflowDiag({
          step: '4_after_sync_tenant',
          organizationId,
          diagLeaseLocalId: lid,
          tenantLocalIdBefore: oldLocalEntityId,
          tenantRemoteIdFromApi: createdId,
          tenantIdMappingApplied: oldLocalEntityId !== createdId,
          leaseRowFk: lease ? summarizeFkPair(lease.propertyId, lease.tenantId) : null,
          pendingLeaseOpSnapshot: leasePo
            ? {
                pendingOpId: leasePo.id,
                status: leasePo.status,
                operation: leasePo.operation,
                ...summarizeFkPair(leasePo.payload?.propertyId, leasePo.payload?.tenantId),
                payloadTenantIdMatchesRemoteTenant:
                  leasePo.payload?.tenantId === createdId,
              }
            : null,
        });
      }
    }

    if (config.entity === 'lease' && createdId) {
      const lid = getLeaseSignatureDiagLeaseId();
      if (lid && oldLocalEntityId === lid) {
        logLeaseSignWorkflowDiag({
          step: '6_after_post_api_leases',
          organizationId,
          pendingOpId: meta?.pendingOpId,
          localLeaseId: oldLocalEntityId,
          remoteLeaseIdCreated: createdId,
          leaseLocalIdKind: classifySmartimmoId(oldLocalEntityId),
          leaseRemoteIdKind: classifySmartimmoId(createdId),
          mappingLocalToRemote: `${oldLocalEntityId} -> ${createdId}`,
        });
        setLeaseSignatureDiagRemoteLeaseMapping(oldLocalEntityId, createdId);
      }
    }

    return true;
  }

  /**
   * Met à jour un enregistrement sur le serveur
   */
  private async updateRemote(
    config: EntitySyncConfig,
    id: string,
    payload: any,
    organizationId: string
  ): Promise<boolean> {
    const transformed = config.transformToRemote
      ? config.transformToRemote(payload)
      : payload;

    const routeById = config.apiRouteById?.replace(':id', id) || `${config.apiRoute}/${id}`;

    // ⚠️ DOCUMENT : L'API documents utilise PATCH, pas PUT
    // ⚠️ ÉCHÉANCE : L'API échéances utilise PATCH, pas PUT
    // ⚠️ LOAN : L'API loans utilise PATCH, pas PUT
    // ⚠️ LOANBORROWER : L'API loanBorrowers utilise PATCH, pas PUT
    const method = (config.entity === 'document' || config.entity === 'echeance' || config.entity === 'loan' || config.entity === 'loanBorrower') ? 'PATCH' : 'PUT';
    
    const response = await fetch(routeById, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transformed),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.error || `Erreur ${response.status}`) as any;
      error.status = response.status; // Attacher le status code pour permettre le fallback 404 → POST
      throw error;
    }

    return true;
  }

  /**
   * Supprime un enregistrement sur le serveur
   */
  private async deleteRemote(
    config: EntitySyncConfig,
    id: string,
    organizationId: string,
    payload?: any
  ): Promise<boolean> {
    // ⚠️ GESTION SPÉCIALE POUR documentLink : clé composite (documentId:linkedType:linkedId)
    // L'API utilise /api/documents/{documentId}/links/{linkedType}:{linkedId}
    let routeById: string;
    if (config.entity === 'documentLink' && payload && payload.documentId && payload.linkedType && payload.linkedId) {
      // Construire la route spéciale pour documentLink
      const linkId = `${payload.linkedType}:${payload.linkedId}`;
      routeById = `/api/documents/${payload.documentId}/links/${linkId}`;
    } else {
      // Route normale avec apiRouteById ou fallback
      routeById = config.apiRouteById?.replace(':id', id) || `${config.apiRoute}/${id}`;
    }

    // ✅ CRITIQUE: Pour les échéances, TOUJOURS ajouter ?hard=1 pour garantir une suppression définitive
    // L'API DELETE /api/echeances/:id fait un soft delete par défaut (isActive=false)
    // Pour un hard delete, il faut TOUJOURS passer ?hard=1 dans l'URL
    // CONTRAT PRODUIT: Toute suppression d'échéance = hard delete définitif
    if (config.entity === 'echeance') {
      routeById = routeById.includes('?') 
        ? `${routeById}&hard=1`
        : `${routeById}?hard=1`;
      console.log(`[GlobalSync] 🗑️ DELETE ECHEANCE (hard delete forcé): entity=${config.entity}, id=${id}, url=${routeById}`);
    }
    
    // ✅ LOAN: suppression définitive uniquement (hard delete)
    if (config.entity === 'loan') {
      routeById = routeById.includes('?')
        ? `${routeById}&hard=1`
        : `${routeById}?hard=1`;
    }

    // Pour les propriétés, le payload peut contenir { mode: 'archive' | 'cascade' | 'reassign', targetPropertyId?: string }
    // Pour documentLink, le payload contient le lien complet mais pas besoin de body pour DELETE
    const body = config.entity === 'documentLink' ? undefined : (payload ? JSON.stringify(payload) : undefined);

    console.log(`[GlobalSync] DELETE ${routeById} avec payload:`, payload);

    const response = await fetch(routeById, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      ...(body && { body }),
    });

    // ✅ CRITIQUE: Logs détaillés pour les échéances
    if (config.entity === 'echeance') {
      console.log(`[GlobalSync] 🗑️ DELETE ECHEANCE response: status=${response.status}, ok=${response.ok}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[GlobalSync] ❌ DELETE ECHEANCE FAILED: entity=${config.entity}, id=${id}, status=${response.status}, error=`, errorData);
      } else {
        const successData = await response.json().catch(() => ({}));
        console.log(`[GlobalSync] ✅ DELETE ECHEANCE SUCCESS: entity=${config.entity}, id=${id}, response=`, successData);
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      
      // ✅ CRITIQUE: Pour les échéances, toute erreur doit être remontée clairement (déjà loggé plus haut)
      // Ne pas traiter les 404 comme succès pour les échéances (contrairement aux autres entités)
      if (config.entity === 'echeance') {
        const errorMsg = error.error || error.message || `Erreur HTTP ${response.status}`;
        throw new Error(`Échec suppression échéance ${id}: ${errorMsg} (HTTP ${response.status})`);
      }
      
      // ⚠️ GESTION SPÉCIALE : Si 404 (Not Found) pour une propriété avec mode: 'archive'
      // Pour le mode 'archive', on ne peut pas archiver une propriété qui n'existe pas encore
      // Il faut vérifier s'il y a une pendingOp 'create' en attente
      if (response.status === 404 && config.entity === 'property' && payload && payload.mode === 'archive') {
        const db = await this.getDb();
        
        // Vérifier s'il y a une pendingOp 'create' pour cette propriété
        const createOp = await db.pendingOperations
          .where('entityId')
          .equals(id)
          .filter(op => op.operation === 'create')
          .first();
        
        if (createOp && createOp.status === 'pending') {
          // Il y a une pendingOp 'create' en attente, on doit attendre qu'elle soit synchronisée
          console.log(`[GlobalSync] 🔄 Propriété ${id} : pendingOp 'delete' (archive) bloquée, attend la création`);
          throw new Error(`ARCHIVE_BLOCKED_WAITING_CREATE: La propriété n'existe pas encore sur le serveur. L'archivage sera effectué après la création.`);
        } else {
          // Pas de pendingOp 'create', la propriété n'existe vraiment pas
          // Pour le mode 'archive', on ne peut pas archiver une propriété inexistante
          console.warn(`[GlobalSync] ⚠️ DELETE ${routeById} (archive) - Propriété non trouvée (404) et pas de pendingOp 'create', impossible d'archiver`);
          throw new Error(`Impossible d'archiver : la propriété n'existe pas sur le serveur et n'est pas en attente de création.`);
        }
      }
      
      // ⚠️ RÉCONCILIATION : Si 404 (Not Found) pour mode 'cascade' ou autres entités
      // L'état désiré (absence de l'entité) est déjà atteint, donc on considère la suppression comme réussie
      if (response.status === 404) {
        console.log(`[GlobalSync] ⚠️ DELETE ${routeById} - Entité non trouvée (404), mais état désiré atteint (absente), marquage comme synced`);
        return true; // Marquer comme succès : l'état désiré est atteint
      }
      
      // Pour les autres erreurs (400, 500, etc.), lancer une exception
      console.error(`[GlobalSync] ❌ Erreur DELETE ${routeById}:`, error);
      throw new Error(error.error || `Erreur ${response.status}`);
    }

    // Vérifier que la réponse est valide (pour debug)
    const responseData = await response.json().catch(() => null);
    if (responseData) {
      console.log(`[GlobalSync] ✅ DELETE ${routeById} réussi:`, responseData);
    } else {
      console.log(`[GlobalSync] ✅ DELETE ${routeById} réussi (pas de réponse JSON)`);
    }

    return true;
  }
}

// Instance singleton
let globalSyncServiceInstance: GlobalSyncService | null = null;

export function getGlobalSyncService(): GlobalSyncService {
  if (typeof window === 'undefined') {
    throw new Error('GlobalSyncService ne peut être utilisé que côté client');
  }

  if (!globalSyncServiceInstance) {
    globalSyncServiceInstance = new GlobalSyncService();
  }

  return globalSyncServiceInstance;
}




