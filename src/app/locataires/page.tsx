import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { SearchInput } from '@/components/ui/SearchInput';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { TenantRepo } from '@/lib/db/TenantRepo';
import { TenantFilters } from '@/lib/db/TenantRepo';
import LocatairesClient from './LocatairesClient';

export default async function LocatairesPage({
  searchParams,
}: {
  searchParams: { search?: string; page?: string; status?: string };
}) {
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
    TenantRepo.findMany(filters),
    TenantRepo.getStats()
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
    <LocatairesClient 
      initialData={tenantsResult}
      stats={formattedStats}
    />
  );
}