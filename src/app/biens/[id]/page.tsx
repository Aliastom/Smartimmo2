import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { PropertyRepo } from '@/lib/db/PropertyRepo';
import { TransactionRepo } from '@/lib/db/TransactionRepo';
import { DocumentRepo } from '@/lib/db/DocumentRepo';
import { prisma } from '@/lib/prisma';
import BienOverviewClient from './BienOverviewClient';
import PropertyDetailClient from './PropertyDetailClient';

interface PropertyPageProps {
  params: {
    id: string;
  };
  searchParams?: {
    tab?: string;
  };
}

export default async function PropertyPage({ params, searchParams }: PropertyPageProps) {
  // Si pas de tab dans l'URL, rediriger vers la page transactions
  if (!searchParams?.tab) {
    redirect(`/biens/${params.id}/transactions`);
  }

  // Si on a un tab dans l'URL, utiliser l'ancienne interface à onglets
  if (searchParams?.tab) {
  const [property, transactionsResult, documentsResult] = await Promise.all([
    PropertyRepo.findById(params.id),
    TransactionRepo.findMany({ 
      propertyId: params.id, 
      limit: 10, 
      sortBy: 'date', 
      sortOrder: 'desc' 
    }),
    DocumentRepo.findMany({ 
      propertyId: params.id, 
      limit: 10, 
      sortBy: 'createdAt', 
      sortOrder: 'desc' 
    })
  ]);

  if (!property) {
    notFound();
  }

    // Calculer les KPIs basiques pour l'ancien système
  const kpis = [
    {
      title: 'Loyer Moyen',
        value: property.Lease?.length > 0 
          ? `€${(property.Lease.reduce((sum: number, lease: any) => sum + lease.rentAmount, 0) / property.Lease.length).toLocaleString('fr-FR')}`
        : '€0',
      iconName: 'DollarSign',
      trend: { value: 0, label: 'vs mois dernier', period: '30j' },
      color: 'success' as const
    },
    {
      title: 'Baux Actifs',
        value: property.Lease?.filter((l: any) => l.status === 'ACTIF').length.toString() || '0',
      iconName: 'FileText',
      trend: { value: 0, label: 'vs mois dernier', period: '30j' },
      color: 'primary' as const
    }
  ];

  return (
    <PropertyDetailClient 
      property={property}
      kpis={kpis}
      transactions={transactionsResult.data}
      documents={documentsResult.data}
        activeTab={searchParams.tab}
      />
    );
  }

  // Sinon, afficher le nouveau HUB
  // Récupérer les données du bien
  const property = await PropertyRepo.findById(params.id);

  if (!property) {
    notFound();
  }

  // Récupérer toutes les transactions du bien pour les stats
  const allTransactionsResult = await TransactionRepo.findMany({ 
    propertyId: params.id,
    limit: 1000,
    sortBy: 'date', 
    sortOrder: 'desc' 
  });

  const allTransactions = allTransactionsResult.data;

  // Calculer le mois actuel
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1);
  const prevMonthStr = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;

  // Filtrer transactions du mois actuel et précédent
  const currentMonthTransactions = allTransactions.filter(t => {
    const dateStr = typeof t.date === 'string' ? t.date : new Date(t.date).toISOString().split('T')[0];
    return t.accountingMonth === currentMonth || dateStr.startsWith(currentMonth);
  });
  
  const prevMonthTransactions = allTransactions.filter(t => {
    const dateStr = typeof t.date === 'string' ? t.date : new Date(t.date).toISOString().split('T')[0];
    return t.accountingMonth === prevMonthStr || dateStr.startsWith(prevMonthStr);
  });

  // Calculer recettes/dépenses
  const recettesMois = currentMonthTransactions
    .filter(t => t.nature?.type === 'RECETTE')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const depensesMois = currentMonthTransactions
    .filter(t => t.nature?.type === 'DEPENSE')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
  const soldeMois = recettesMois - depensesMois;

  const recettesPrev = prevMonthTransactions
    .filter(t => t.nature?.type === 'RECETTE')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const depensesPrev = prevMonthTransactions
    .filter(t => t.nature?.type === 'DEPENSE')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
  const soldePrev = recettesPrev - depensesPrev;

  // Calculer tendances
  const recettesTrend = recettesPrev > 0 ? ((recettesMois - recettesPrev) / recettesPrev) * 100 : 0;
  const depensesTrend = depensesPrev > 0 ? ((depensesMois - depensesPrev) / depensesPrev) * 100 : 0;
  const soldeTrend = soldePrev !== 0 ? ((soldeMois - soldePrev) / Math.abs(soldePrev)) * 100 : 0;

  // Bail actif
  const bailActif = property.Lease?.find((l: any) => l.status === 'ACTIF');
  const loyerMensuel = bailActif?.rentAmount || 0;

  // Compteurs
  const bauxActifs = property.Lease?.filter((l: any) => l.status === 'ACTIF').length || 0;
  const transactionsNonRapprochees = allTransactions.filter(t => 
    t.rapprochementStatus !== 'rapprochee' && !t.paidAt
  ).length;

  // Documents - Uniquement via DocumentLink (système de liaison)
  const documentLinks = await prisma.documentLink.findMany({
    where: {
      linkedType: 'property',
      linkedId: params.id
    },
    include: {
        Document: {
          select: {
            id: true,
            fileName: true,
            documentTypeId: true,
            createdAt: true,
            deletedAt: true
          }
        }
    }
  });

  // Filtrer les documents non supprimés
  const allDocuments = documentLinks
    .map(link => link.Document)
    .filter(doc => doc && !doc.deletedAt)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  console.log('📄 Documents pour bien', params.id, ':', allDocuments.length);
  
  const docsNonClasses = allDocuments.filter(d => !d.documentTypeId).length;

  // KPIs pour la vue d'ensemble
  const kpis = [
    {
      title: 'Loyer Mensuel',
      value: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(loyerMensuel),
      iconName: 'DollarSign',
      color: 'success' as const
    },
    {
      title: 'Recettes du mois',
      value: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(recettesMois),
      iconName: 'TrendingUp',
      trend: { value: Math.round(recettesTrend), label: 'vs mois dernier' },
      color: 'success' as const
    },
    {
      title: 'Dépenses du mois',
      value: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(depensesMois),
      iconName: 'TrendingDown',
      trend: { value: Math.round(depensesTrend), label: 'vs mois dernier' },
      color: 'danger' as const
    },
    {
      title: 'Solde du mois',
      value: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(soldeMois),
      iconName: 'Activity',
      trend: { value: Math.round(soldeTrend), label: 'vs mois dernier' },
      color: soldeMois >= 0 ? 'success' as const : 'danger' as const
    },
    {
      title: 'Baux Actifs',
      value: bauxActifs.toString(),
      iconName: 'FileCheck',
      color: 'primary' as const
    }
  ];

  // Alertes
  const alerts = {
    retardsPaiement: 0, // À calculer avec la logique métier
    indexations: 0, // À calculer
    bauxFinissant: 0, // À calculer (< 60j)
    docsNonClasses,
    transactionsNonRapprochees
  };

  // Compteurs pour les tuiles
  const counts = {
    transactions: allTransactions.length,
    transactionsNonRapprochees,
    documents: allDocuments.length,
    docsNonClasses,
    photos: 0, // À implémenter
    baux: property.Lease?.length || 0,
    bauxActifs,
    retardsPaiement: 0
  };

  // Récupérer les 3 derniers éléments pour chaque catégorie (BIEN CONCERNÉ uniquement)
  const recentTransactions = allTransactions.slice(0, 3).map(t => t.description || t.label);
  const recentDocuments = allDocuments.slice(0, 3).map(d => d.fileName);
  const unreconciled = allTransactions.filter(t => !t.isReconciled).slice(0, 3).map(t => t.description || t.label);

  // Données pour les graphiques
  // Évolution sur 12 mois
  const evolutionData: Array<{ mois: string; solde: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthTransactions = allTransactions.filter(t => {
      const dateStr = typeof t.date === 'string' ? t.date : new Date(t.date).toISOString().split('T')[0];
      return t.accountingMonth === monthStr || dateStr.startsWith(monthStr);
    });
    const recettes = monthTransactions
      .filter(t => t.nature?.type === 'RECETTE')
      .reduce((sum, t) => sum + t.amount, 0);
    const depenses = monthTransactions
      .filter(t => t.nature?.type === 'DEPENSE')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    evolutionData.push({
      mois: d.toLocaleDateString('fr-FR', { month: 'short' }),
      solde: recettes - depenses
    });
  }

  // Répartition par catégorie (mois courant)
  const categoriesMap = new Map<string, number>();
  currentMonthTransactions.forEach(t => {
    const cat = t.Category?.label || 'Non catégorisé';
    categoriesMap.set(cat, (categoriesMap.get(cat) || 0) + Math.abs(t.amount));
  });
  
  const repartitionData = Array.from(categoriesMap.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Recettes vs Dépenses (3 derniers mois)
  const incomeExpenseData = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthTransactions = allTransactions.filter(t => {
      const dateStr = typeof t.date === 'string' ? t.date : new Date(t.date).toISOString().split('T')[0];
      return t.accountingMonth === monthStr || dateStr.startsWith(monthStr);
    });
    const recettes = monthTransactions
      .filter(t => t.nature?.type === 'RECETTE')
      .reduce((sum, t) => sum + t.amount, 0);
    const depenses = monthTransactions
      .filter(t => t.nature?.type === 'DEPENSE')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    incomeExpenseData.push({
      name: d.toLocaleDateString('fr-FR', { month: 'short' }),
      recettes,
      depenses
    });
  }

  return (
    <BienOverviewClient 
      property={property}
      kpis={kpis}
      alerts={alerts}
      counts={counts}
      evolutionData={evolutionData}
      repartitionData={repartitionData}
      incomeExpenseData={incomeExpenseData}
      recentItems={{
        transactions: recentTransactions,
        documents: recentDocuments,
        unreconciled: unreconciled,
        photos: []
      }}
    />
  );
}