'use client';

/**
 * Vue Biens Offline pour l'App Shell
 * 
 * Version 100% offline qui charge depuis IndexedDB uniquement.
 * Parité visuelle avec /biens en ligne.
 */

import { useEffect, useState, useMemo } from 'react';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import { getLocalDB } from '@/lib/offline/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { SearchInput } from '@/components/ui/SearchInput';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Loader2, Plus, Edit, Trash2, MapPin, Building2, Home, Warehouse, Store, Mountain, Archive, UserCheck, UserX } from 'lucide-react';
import type { LocalProperty, LocalTransaction, CachedNature } from '@/lib/offline/db';
import { NetCumulativeChart } from '@/features/analytics/components/NetCumulativeChart';
import { RevenueExpenseCard } from '@/features/analytics/components/RevenueExpenseCard';
import { OccupancyDonut } from '@/features/analytics/components/OccupancyDonut';
import type { Transaction, Property } from '@/features/analytics/types';
import { NewPropertyModalOffline } from './NewPropertyModalOffline';

interface BiensOfflineViewProps {
  organizationId: string;
}

type PropertyStatus = 'total' | 'occupied' | 'vacant';

export function BiensOfflineView({ organizationId }: BiensOfflineViewProps) {
  const [properties, setProperties] = useState<LocalProperty[]>([]);
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [natures, setNatures] = useState<Map<string, CachedNature>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propertyFormOpen, setPropertyFormOpen] = useState(false);
  
  // Filtres et pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PropertyStatus>('total');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Charger les biens et transactions depuis IndexedDB
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const db = await getLocalDB();
        const propRepo = getPropertyRepositoryOffline();
        const transRepo = getTransactionRepositoryOffline();

        // Charger en parallèle : biens, transactions, natures
        const [propertiesData, transactionsData, naturesData] = await Promise.all([
          propRepo.getAll(organizationId, { includeArchived, search: search || undefined }),
          transRepo.getAll(organizationId),
          db.NatureEntity.toArray(),
        ]);

        // Créer un Map des natures par key (code)
        const natureMap = new Map<string, CachedNature>();
        naturesData.forEach(nature => {
          natureMap.set(nature.key, nature);
        });

        if (!cancelled) {
          setProperties(propertiesData);
          setTransactions(transactionsData);
          setNatures(natureMap);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error('[BiensOfflineView] Erreur chargement:', e);
          setError('Impossible de charger les biens. Vérifiez votre connexion ou réessayez plus tard.');
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [organizationId, includeArchived, search]);

  // Convertir LocalProperty vers Property pour les graphiques
  const propertiesForCharts: Property[] = useMemo(() => {
    return properties.filter(p => !p.isArchived).map(p => ({
      id: p.id,
      status: p.occupation === 'OCCUPIED' ? 'occupied' : 'vacant',
    }));
  }, [properties]);

  // Convertir LocalTransaction vers Transaction pour les graphiques
  const transactionsForCharts: Transaction[] = useMemo(() => {
    return transactions.map(t => {
      // Déterminer le kind (income/expense) depuis la nature
      const nature = t.nature ? natures.get(t.nature) : null;
      const flow = nature?.flow?.toUpperCase();
      // Déterminer le kind : INCOME/RECETTE = income, sinon expense (par défaut)
      // Si pas de nature, utiliser le signe du montant
      let kind: 'income' | 'expense' = 'expense';
      if (flow === 'INCOME' || flow === 'RECETTE') {
        kind = 'income';
      } else if (t.amount > 0 && !nature) {
        // Si montant positif et pas de nature, considérer comme income par défaut
        kind = 'income';
      }
      
      return {
        id: t.id,
        propertyId: t.propertyId || '',
        date: t.date,
        amount: Math.abs(t.amount), // Toujours positif pour les graphiques
        kind,
      };
    });
  }, [transactions, natures]);

  // Filtrer par statut (occupied/vacant) côté client
  const filteredProperties = useMemo(() => {
    let filtered = [...properties];

    if (statusFilter === 'occupied') {
      filtered = filtered.filter(p => p.occupation === 'OCCUPIED' && !p.isArchived);
    } else if (statusFilter === 'vacant') {
      filtered = filtered.filter(p => p.occupation === 'VACANT' || p.isArchived);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.address.toLowerCase().includes(searchLower) ||
        p.city.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [properties, statusFilter, search]);

  // Pagination
  const totalPages = Math.ceil(filteredProperties.length / itemsPerPage);
  const paginatedProperties = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredProperties.slice(start, end);
  }, [filteredProperties, currentPage, itemsPerPage]);

  // Calcul des stats
  const stats = useMemo(() => {
    const nonArchived = properties.filter(p => !p.isArchived);
    const total = nonArchived.length;
    const occupied = nonArchived.filter(p => p.occupation === 'OCCUPIED').length;
    const vacant = total - occupied;

    return { total, occupied, vacant };
  }, [properties]);

  // Handlers
  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleStatusFilter = (filter: PropertyStatus) => {
    setStatusFilter(filter);
    setCurrentPage(1);
  };

  const handleToggleArchived = () => {
    setIncludeArchived(!includeArchived);
    setCurrentPage(1);
  };

  const handlePropertyCreated = () => {
    // Recharger les propriétés après création
    const propRepo = getPropertyRepositoryOffline();
    propRepo.getAll(organizationId, { includeArchived, search: search || undefined })
      .then(setProperties)
      .catch(console.error);
    setPropertyFormOpen(false);
  };

  // Helpers
  const getPropertyTypeIcon = (type: string) => {
    switch (type) {
      case 'house':
        return <Home className="h-4 w-4 text-blue-600" />;
      case 'apartment':
        return <Building2 className="h-4 w-4 text-purple-600" />;
      case 'garage':
        return <Warehouse className="h-4 w-4 text-orange-600" />;
      case 'commercial':
        return <Store className="h-4 w-4 text-red-600" />;
      case 'land':
        return <Mountain className="h-4 w-4 text-green-600" />;
      default:
        return <Home className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (property: LocalProperty) => {
    if (property.isArchived) {
      return <Badge variant="warning" size="sm" className="bg-gray-100 text-gray-800 border-gray-300">
        <Archive className="h-3 w-3 mr-1" />
        Archivé
      </Badge>;
    }
    
    if (property.occupation === 'OCCUPIED') {
      return <Badge variant="success">Occupé</Badge>;
    } else {
      return <Badge variant="warning">Vacant</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
          <span className="ml-3 text-gray-600">Chargement des biens...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <p className="font-medium">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Biens Immobiliers</h1>
            <p className="text-gray-600 mt-1">Gestion de votre patrimoine immobilier</p>
          </div>
          <Button onClick={() => setPropertyFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau Bien
          </Button>
        </div>

        {/* Rangée 1 - Graphiques dynamiques */}
        {(transactionsForCharts.length > 0 || propertiesForCharts.length > 0) && (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <div className="md:col-span-2">
              <NetCumulativeChart 
                transactions={transactionsForCharts} 
                properties={propertiesForCharts} 
              />
            </div>
            <RevenueExpenseCard 
              transactions={transactionsForCharts} 
              properties={propertiesForCharts} 
              year={new Date().getFullYear()} 
            />
            <OccupancyDonut properties={propertiesForCharts} />
          </div>
        )}

        {/* Rangée 2 - Cartes filtrantes (cliquables) */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
          <StatCard
            title="Biens totaux"
            value={stats.total.toString()}
            iconName="Home"
            color="indigo"
            trendValue={0}
            trendLabel="% vs mois dernier"
            trendDirection="flat"
            rightIndicator="chevron"
            onClick={() => handleStatusFilter('total')}
            isActive={statusFilter === 'total'}
          />
          
          <StatCard
            title="Occupés"
            value={stats.occupied.toString()}
            iconName="UserCheck"
            color="green"
            trendValue={0}
            trendLabel="% vs mois dernier"
            trendDirection="flat"
            rightIndicator="chevron"
            onClick={() => handleStatusFilter('occupied')}
            isActive={statusFilter === 'occupied'}
          />
          
          <StatCard
            title="Vacants"
            value={stats.vacant.toString()}
            iconName="UserX"
            color="amber"
            trendValue={0}
            trendLabel="% vs mois dernier"
            trendDirection="flat"
            rightIndicator="chevron"
            onClick={() => handleStatusFilter('vacant')}
            isActive={statusFilter === 'vacant'}
          />
        </div>

        {/* Liste des biens */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des Biens</CardTitle>
            <CardDescription>Recherchez et gérez vos biens immobiliers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 space-y-4">
              <SearchInput
                placeholder="Rechercher un bien..."
                defaultValue={search}
                onSearch={handleSearch}
              />
              
              {/* Toggle Inclure archivés */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeArchived}
                    onChange={handleToggleArchived}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Inclure les biens archivés
                  </span>
                </label>
                {includeArchived && (
                  <Badge variant="info" size="sm">
                    Actif
                  </Badge>
                )}
              </div>
            </div>

            {/* Table */}
            {paginatedProperties.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="Aucun bien trouvé"
                description={search || statusFilter !== 'total' 
                  ? "Essayez de modifier vos critères de recherche ou vos filtres."
                  : "Commencez par ajouter votre premier bien immobilier."}
              />
            ) : (
              <>
                <Table hover>
                  <TableHeader>
                    <TableRow>
                      <TableHeaderCell>Bien</TableHeaderCell>
                      <TableHeaderCell>Surface</TableHeaderCell>
                      <TableHeaderCell>Loyer</TableHeaderCell>
                      <TableHeaderCell>Statut</TableHeaderCell>
                      <TableHeaderCell>Actions</TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProperties.map((property) => (
                      <TableRow 
                        key={property.id}
                        className={`cursor-pointer ${property.isArchived ? 'bg-gray-50 opacity-70 border-l-4 border-l-gray-400' : ''}`}
                        onClick={() => {
                          // TODO: Ouvrir drawer ou modal de détail du bien
                          console.log('Ouvrir détail du bien:', property.id);
                        }}
                      >
                        <TableCell>
                          <div>
                            <div className="flex items-center gap-2">
                              {getPropertyTypeIcon(property.type)}
                              <span className={property.isArchived ? 'font-medium text-gray-500 line-through' : 'font-medium text-gray-900'}>
                                {property.name}
                              </span>
                              {property.isArchived && (
                                <Badge variant="warning" size="sm" className="bg-orange-100 text-orange-800 border-orange-300">
                                  <Archive className="h-3 w-3 mr-1" />
                                  Archivé
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {property.address}, {property.postalCode} {property.city}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">{property.surface || 'N/A'} m²</div>
                            {property.rooms && (
                              <div className="text-gray-500">{property.rooms} pièce{property.rooms > 1 ? 's' : ''}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {/* TODO: Afficher le loyer depuis la lease active */}
                          <span className="text-gray-400">-</span>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(property)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // TODO: Éditer le bien
                                console.log('Éditer:', property.id);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // TODO: Supprimer/archiver le bien
                                console.log('Supprimer:', property.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-6">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

      {/* Modal "Nouveau bien" */}
      <NewPropertyModalOffline
        isOpen={propertyFormOpen}
        onClose={() => setPropertyFormOpen(false)}
        onSuccess={handlePropertyCreated}
        organizationId={organizationId}
      />
    </div>
  );
}
