/**
 * Clés de cache centralisées pour React Query
 * Utiliser ces clés partout pour garantir la cohérence des invalidations
 */

export const qk = {
  // Dashboard global
  dashboard: {
    summary: ['dashboard', 'summary'] as const,
  },

  // Propriétés
  properties: {
    list: ['properties', 'list'] as const,
    stats: (propertyId?: string) => 
      propertyId ? ['property', 'stats', propertyId] as const : ['properties', 'stats'] as const,
    leasesStats: (propertyId: string) => ['property', 'leasesStats', propertyId] as const,
    tenantsStats: (propertyId: string) => ['property', 'tenantsStats', propertyId] as const,
    docsStats: (propertyId: string) => ['property', 'docsStats', propertyId] as const,
    photosStats: (propertyId: string) => ['property', 'photosStats', propertyId] as const,
    transactionsStats: (propertyId: string) => ['property', 'txStats', propertyId] as const,
    loansStats: (propertyId: string) => ['property', 'loansStats', propertyId] as const,
  },

  // Baux
  leases: {
    list: ['leases'] as const,
    listByProperty: (pid: string) => ['leases', pid] as const,
    kpis: (pid?: string) => 
      pid ? ['leases', 'kpis', pid] as const : ['leases', 'kpis'] as const,
    stats: (pid?: string) => 
      pid ? ['lease-stats', pid] as const : ['lease-stats'] as const,
  },

  // Locataires
  tenants: {
    list: ['tenants'] as const,
    listByProperty: (pid: string) => ['tenants', 'byProperty', pid] as const,
    stats: (pid?: string) => 
      pid ? (['tenant-stats', pid] as const) : (['tenant-stats'] as const),
  },

  // Documents
  documents: {
    list: (pid: string) => ['documents', 'list', pid] as const,
    stats: (pid: string) => ['documents', 'stats', pid] as const,
  },

  // Photos
  photos: {
    list: (pid: string) => ['photos', 'list', pid] as const,
    stats: (pid: string) => ['photos', 'stats', pid] as const,
  },

  // Transactions
  Transaction_Transaction_leaseIdToLease: {
    list: (pid?: string) => 
      pid ? ['tx', 'list', pid] as const : ['tx', 'list'] as const,
    stats: (pid?: string) => 
      pid ? ['tx', 'stats', pid] as const : ['tx', 'stats'] as const,
  },

  // Prêts
  loans: {
    list: (pid?: string) => 
      pid ? ['loans', 'list', pid] as const : ['loans', 'list'] as const,
    stats: (pid?: string) => 
      pid ? ['loans', 'stats', pid] as const : ['loans', 'stats'] as const,
  },
} as const;

