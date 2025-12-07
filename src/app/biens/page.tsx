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
import { PropertyRepo } from '@/lib/db/PropertyRepo';
import { PropertyFilters } from '@/lib/db/PropertyRepo';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { 
  Plus, 
  Eye, 
  Edit, 
  Trash2,
  MapPin,
  Building2,
  Euro,
  Users,
  Calendar
} from 'lucide-react';
import Link from 'next/link';
import BiensClientWrapper from './BiensClientWrapper';

// Force dynamic rendering - this page requires database access
export const dynamic = 'force-dynamic';

export default async function BiensPage({
  searchParams,
}: {
  searchParams: { search?: string; page?: string; status?: string; type?: string; includeArchived?: string };
}) {
  // En mode offline, retourner directement des données vides
  // Le composant client chargera depuis IndexedDB
  let user;
  try {
    user = await requireAuth();
  } catch (error: any) {
    // Si l'auth échoue (probablement offline), retourner des données vides
    // Le client utilisera les données depuis IndexedDB
    console.error('[BiensPage] Auth échoué, mode offline probable:', error);
    return (
      <BiensClientWrapper 
        initialData={{
          data: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            pages: 0,
          },
        }}
        stats={[
          {
            title: 'Total Biens',
            value: '0',
            iconName: 'Building2',
            trend: { value: 0, label: 'vs mois dernier', period: '30j' },
            color: 'primary' as const
          },
          {
            title: 'Occupés',
            value: '0',
            iconName: 'Users',
            trend: { value: 0, label: 'vs mois dernier', period: '30j' },
            color: 'success' as const
          },
          {
            title: 'Vacants',
            value: '0',
            iconName: 'Building2',
            trend: { value: 0, label: 'vs mois dernier', period: '30j' },
            color: 'warning' as const
          },
          {
            title: 'Revenus Mensuels',
            value: '€0',
            iconName: 'Euro',
            trend: { value: 0, label: 'vs mois dernier', period: '30j' },
            color: 'success' as const
          }
        ]}
        properties={[]}
        transactions={[]}
      />
    );
  }

  try {
    // Récupérer les données depuis Prisma
    const filters: PropertyFilters = {
      search: searchParams.search,
      status: searchParams.status,
      type: searchParams.type,
      includeArchived: searchParams.includeArchived === 'true',
      page: searchParams.page ? parseInt(searchParams.page) : 1,
      limit: 10,
      sortBy: 'name',
      sortOrder: 'asc'
    };

    const [propertiesResult, stats] = await Promise.all([
      PropertyRepo.findMany(filters, user.organizationId),
      PropertyRepo.getStats(user.organizationId)
    ]);

    // Récupérer toutes les propriétés pour les graphiques
    const allProperties = await prisma.property.findMany({
      where: { organizationId: user.organizationId },
      select: {
        id: true,
        name: true,
        Lease: {
          where: { status: 'ACTIF' },
          select: { id: true }
        }
      }
    });

    // Formater les propriétés pour les graphiques
    const propertiesForCharts = allProperties.map(p => ({
      id: p.id,
      name: p.name,
      status: ((p.Lease?.length || 0) > 0 ? 'occupied' : 'vacant') as 'occupied' | 'vacant'
    }));

    // Récupérer toutes les transactions pour les graphiques (limité aux 2 dernières années)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const allTransactions = await prisma.transaction.findMany({
      where: {
        organizationId: user.organizationId,
        date: { gte: twoYearsAgo }
      },
      select: {
        id: true,
        propertyId: true,
        date: true,
        amount: true,
        nature: true
      },
      orderBy: { date: 'asc' }
    });

    // Récupérer les natures avec leur flow pour déterminer le type
    const natureEntities = await prisma.natureEntity.findMany({
      select: {
        code: true,
        flow: true
      }
    });

    const natureFlowMap = new Map(natureEntities.map(n => [n.code, n.flow]));

    // Formater les transactions pour les graphiques
    const transactionsForCharts = allTransactions.map(t => {
      const flow = natureFlowMap.get(t.nature);
      const kind = flow === 'INCOME' ? 'income' : 'expense';
      
      return {
        id: t.id,
        propertyId: t.propertyId,
        date: t.date.toISOString(),
        amount: t.amount,
        kind: kind as 'income' | 'expense'
      };
    });

    // Formater les stats pour les StatCards
    const formattedStats = [
      {
        title: 'Total Biens',
        value: stats.total.toString(),
        iconName: 'Building2',
        trend: { value: 0, label: 'vs mois dernier', period: '30j' },
        color: 'primary' as const
      },
      {
        title: 'Occupés',
        value: stats.occupied.toString(),
        iconName: 'Users',
        trend: { value: 0, label: 'vs mois dernier', period: '30j' },
        color: 'success' as const
      },
      {
        title: 'Vacants',
        value: stats.vacant.toString(),
        iconName: 'Building2',
        trend: { value: 0, label: 'vs mois dernier', period: '30j' },
        color: 'warning' as const
      },
      {
        title: 'Revenus Mensuels',
        value: `€${stats.monthlyRevenue.toLocaleString('fr-FR')}`,
        iconName: 'Euro',
        trend: { value: 0, label: 'vs mois dernier', period: '30j' },
        color: 'success' as const
      }
    ];

    return (
      <BiensClientWrapper 
        initialData={propertiesResult}
        stats={formattedStats}
        properties={propertiesForCharts}
        transactions={transactionsForCharts}
      />
    );
  } catch (error: any) {
    // En cas d'erreur (notamment hors ligne), retourner des données vides
    // Le composant client chargera depuis IndexedDB
    console.error('[BiensPage] Erreur serveur, chargement offline:', error);
    return (
      <BiensClientWrapper 
        initialData={{
          data: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            pages: 0,
          },
        }}
        stats={[
          {
            title: 'Total Biens',
            value: '0',
            iconName: 'Building2',
            trend: { value: 0, label: 'vs mois dernier', period: '30j' },
            color: 'primary' as const
          },
          {
            title: 'Occupés',
            value: '0',
            iconName: 'Users',
            trend: { value: 0, label: 'vs mois dernier', period: '30j' },
            color: 'success' as const
          },
          {
            title: 'Vacants',
            value: '0',
            iconName: 'Building2',
            trend: { value: 0, label: 'vs mois dernier', period: '30j' },
            color: 'warning' as const
          },
          {
            title: 'Revenus Mensuels',
            value: '€0',
            iconName: 'Euro',
            trend: { value: 0, label: 'vs mois dernier', period: '30j' },
            color: 'success' as const
          }
        ]}
        properties={[]}
        transactions={[]}
      />
    );
  }
}