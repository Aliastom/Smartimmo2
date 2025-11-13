/**
 * Fonctions d'invalidation centralisées pour React Query
 * Garantit que toutes les cartes/stats se rafraîchissent après les mutations
 */

import { QueryClient } from '@tanstack/react-query';
import { qk } from './queryKeys';

// Fonction helper pour invalider avec un QueryClient fourni
async function invalidateWithClient(queryClient: QueryClient, queries: Array<readonly unknown[]>) {
  await Promise.all(queries.map(queryKey => 
    queryClient.invalidateQueries({ queryKey: queryKey as string[] })
  ));
}

/**
 * Invalide TOUTES les données d'une propriété
 * À utiliser après création/suppression de propriété
 */
export async function invalidatePropertyAll(queryClient: QueryClient, pid: string) {
  await invalidateWithClient(queryClient, [
    qk.Property.stats(pid),
    qk.Property.leasesStats(pid),
    qk.Property.tenantsStats(pid),
    qk.Property.docsStats(pid),
    qk.Property.photosStats(pid),
    qk.Property.transactionsStats(pid),
    qk.Property.loansStats(pid),
    qk.Lease.listByProperty(pid),
    qk.Lease.kpis(pid),
    qk.Lease.stats(pid),
    qk.tenants.listByProperty(pid),
    qk.tenants.stats(pid),
    qk.Document.list(pid),
    qk.Document.stats(pid),
    qk.Photo.list(pid),
    qk.Photo.stats(pid),
    qk.Transaction.list(pid),
    qk.Transaction.stats(pid),
    qk.Loan.list(pid),
    qk.Loan.stats(pid),
    qk.Property.list,
    qk.Property.stats(),
    qk.dashboard.summary,
  ]);
}

/**
 * Invalide les données après modification d'un bail
 * Rafraîchit: liste baux, stats baux, stats propriété, dashboard
 */
export async function onLeaseChanged(queryClient: QueryClient, pid: string) {
  await invalidateWithClient(queryClient, [
    qk.Lease.listByProperty(pid),
    qk.Lease.list,
    qk.Lease.kpis(pid),
    qk.Lease.kpis(),
    qk.Lease.stats(pid),
    qk.Lease.stats(),
    qk.Property.leasesStats(pid),
    qk.Property.stats(pid),
    qk.Property.stats(),
    qk.Property.list,
    qk.dashboard.summary,
  ]);
  // Invalider les tenants car les baux affectent leur statut
  await queryClient.invalidateQueries({ queryKey: ['tenants', 'byProperty', { propertyId: pid }] });
  await queryClient.invalidateQueries({ queryKey: ['tenants'] }); // Liste globale des locataires
  await queryClient.invalidateQueries({ queryKey: ['tenant-stats'] }); // Stats globales des locataires
}

/**
 * Invalide les données après modification d'un locataire
 * Rafraîchit: liste locataires, stats locataires, stats propriété, dashboard
 */
export async function onTenantChanged(queryClient: QueryClient, pid: string) {
  await invalidateWithClient(queryClient, [
    qk.tenants.listByProperty(pid),
    qk.tenants.list,
    qk.tenants.stats(pid),
    qk.tenants.stats(),
    qk.Property.tenantsStats(pid),
    qk.Property.stats(pid),
    qk.Property.stats(),
    qk.dashboard.summary,
  ]);
  // Invalider aussi les tenants by property
  await queryClient.invalidateQueries({ queryKey: ['tenants', 'byProperty', { propertyId: pid }] });
}

/**
 * Invalide les données après modification d'une transaction
 * Rafraîchit: liste transactions, stats transactions, stats baux (loyer), dashboard
 */
export async function onTransactionChanged(queryClient: QueryClient, pid: string) {
  await invalidateWithClient(queryClient, [
    qk.Transaction.list(pid),
    qk.Transaction.list(),
    qk.Transaction.stats(pid),
    qk.Transaction.stats(),
    qk.Lease.kpis(pid), // loyer mensuel total peut dépendre des transactions
    qk.Lease.kpis(),
    qk.Property.transactionsStats(pid),
    qk.Property.stats(pid),
    qk.Property.stats(),
    qk.dashboard.summary,
  ]);
}

/**
 * Invalide les données après modification d'un document
 * Rafraîchit: liste documents, stats documents
 */
export async function onDocumentChanged(queryClient: QueryClient, pid: string) {
  await invalidateWithClient(queryClient, [
    qk.Document.list(pid),
    qk.Document.stats(pid),
    qk.Property.docsStats(pid),
  ]);
}

/**
 * Invalide les données après modification d'une photo
 * Rafraîchit: liste photos, stats photos
 */
export async function onPhotoChanged(queryClient: QueryClient, pid: string) {
  await invalidateWithClient(queryClient, [
    qk.Photo.list(pid),
    qk.Photo.stats(pid),
    qk.Property.photosStats(pid),
  ]);
}

/**
 * Invalide les données après modification d'un prêt
 * Rafraîchit: liste prêts, stats prêts, stats propriété
 */
export async function onLoanChanged(queryClient: QueryClient, pid: string) {
  await invalidateWithClient(queryClient, [
    qk.Loan.list(pid),
    qk.Loan.list(),
    qk.Loan.stats(pid),
    qk.Loan.stats(),
    qk.Property.loansStats(pid),
    qk.Property.stats(pid),
    qk.Property.stats(),
    qk.dashboard.summary,
  ]);
}

