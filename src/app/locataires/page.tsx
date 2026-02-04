import React from 'react';
import { TenantRepo } from '@/lib/db/TenantRepo';
import { TenantFilters } from '@/lib/db/TenantRepo';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { TenantsPageCore } from '@/features/tenants/TenantsPageCore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function LocatairesPage({
  searchParams,
}: {
  searchParams: { search?: string; page?: string; status?: string };
}) {
  // En mode offline, retourner directement des données vides
  // Le composant client chargera depuis IndexedDB
  let user;
  try {
    user = await requireAuth();
  } catch (error: any) {
    // Si l'auth échoue (probablement offline), retourner des données vides
    // Le client utilisera les données depuis IndexedDB
    console.error('[LocatairesPage] Auth échoué, mode offline probable:', error);
    return (
      <TenantsPageCore 
        mode="normal"
        initialData={{
          data: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            pages: 0,
          },
        }}
        initialStats={[
          {
            title: 'Total Locataires',
            value: '0',
            iconName: 'Users',
            trend: { value: 0, label: 'vs mois dernier', period: '30j' },
            color: 'primary' as const
          },
          {
            title: 'Avec Bail Actif',
            value: '0',
            iconName: 'FileText',
            trend: { value: 0, label: 'vs mois dernier', period: '30j' },
            color: 'success' as const
          },
          {
            title: 'Sans Bail',
            value: '0',
            iconName: 'Calendar',
            trend: { value: 0, label: 'vs mois dernier', period: '30j' },
            color: 'warning' as const
          },
        ]}
      />
    );
  }

  try {
    // Récupérer les données depuis Prisma
    const filters: TenantFilters = {
      search: searchParams.search,
      status: searchParams.status as any || 'all',
      page: searchParams.page ? parseInt(searchParams.page) : 1,
      limit: 10,
      sortBy: 'lastName',
      sortOrder: 'asc'
    };

    const [tenantsResult, stats] = await Promise.all([
      TenantRepo.findMany(filters, user.organizationId),
      TenantRepo.getStats(user.organizationId)
    ]);

    // Formater les stats pour les StatCards
    const formattedStats = [
      {
        title: 'Total Locataires',
        value: stats.total.toString(),
        iconName: 'Users',
        trend: { value: 0, label: 'vs mois dernier', period: '30j' },
        color: 'primary' as const
      },
      {
        title: 'Avec Bail Actif',
        value: stats.withActiveLeases.toString(),
        iconName: 'FileText',
        trend: { value: 0, label: 'vs mois dernier', period: '30j' },
        color: 'success' as const
      },
      {
        title: 'Sans Bail',
        value: stats.withoutLeases.toString(),
        iconName: 'Calendar',
        trend: { value: 0, label: 'vs mois dernier', period: '30j' },
        color: 'warning' as const
      },
    ];

    return (
      <TenantsPageCore 
        mode="normal"
        initialData={tenantsResult}
        initialStats={formattedStats}
      />
    );
  } catch (error: any) {
    // En cas d'erreur (notamment hors ligne), retourner des données vides
    // Le composant client chargera depuis IndexedDB
    console.error('[LocatairesPage] Erreur serveur, chargement offline:', error);
    return (
      <TenantsPageCore 
        mode="normal"
        initialData={{
          data: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            pages: 0,
          },
        }}
        initialStats={[
          {
            title: 'Total Locataires',
            value: '0',
            iconName: 'Users',
            trend: { value: 0, label: 'vs mois dernier', period: '30j' },
            color: 'primary' as const
          },
          {
            title: 'Avec Bail Actif',
            value: '0',
            iconName: 'FileText',
            trend: { value: 0, label: 'vs mois dernier', period: '30j' },
            color: 'success' as const
          },
          {
            title: 'Sans Bail',
            value: '0',
            iconName: 'Calendar',
            trend: { value: 0, label: 'vs mois dernier', period: '30j' },
            color: 'warning' as const
          },
        ]}
      />
    );
  }
}