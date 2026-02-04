'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import {
  AlertCircle,
  Calendar,
  CreditCard,
  FileText,
  Home,
  TrendingUp,
  Clock,
  Euro,
  Send,
  ArrowRight,
  X,
  Loader2,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type {
  LoyerNonEncaisse,
  TransactionNonRapprochee,
  IndexationATraiter,
  EcheancePret,
  EcheanceCharge,
  BailAEcheance,
  DocumentAValider,
} from '@/types/dashboard';
import { LoyersRetardChart } from '@/components/dashboard/LoyersRetardChart';
import { useToggleRapprochement } from '@/hooks/useToggleRapprochement';
import { useQueryClient } from '@tanstack/react-query';
import { TransactionReconciliationLoadingOverlay } from '@/components/dashboard/TransactionReconciliationLoadingOverlay';

export interface TasksPanelProps {
  loyersNonEncaisses: LoyerNonEncaisse[];
  relances: LoyerNonEncaisse[];
  transactionsNonRapprochees: TransactionNonRapprochee[];
  indexations: IndexationATraiter[];
  echeancesPrets: EcheancePret[];
  echeancesCharges: EcheanceCharge[];
  bauxAEcheance: BailAEcheance[];
  documentsAValider: DocumentAValider[];
  layout?: 'vertical' | 'horizontal';
  currentMonth?: string; // Format YYYY-MM (ex: "2025-11")
  mode?: 'normal' | 'app-shell'; // Mode pour générer les bons liens
}

export function TasksPanel({
  loyersNonEncaisses,
  relances,
  transactionsNonRapprochees,
  indexations,
  echeancesPrets,
  echeancesCharges,
  bauxAEcheance,
  documentsAValider,
  layout = 'vertical',
  currentMonth,
  mode = 'normal',
}: TasksPanelProps) {
  // Fonction utilitaire pour générer les liens selon le mode
  const getTransactionsLink = (propertyId: string) => {
    if (mode === 'app-shell') {
      return `/app?view=transactions&propertyId=${propertyId}`;
    }
    return `/biens/${propertyId}/transactions`;
  };

  // Gestionnaire de clic pour la navigation en mode app-shell
  const handleAppShellNavigation = (e: React.MouseEvent<HTMLAnchorElement>, propertyId: string) => {
    if (mode === 'app-shell') {
      e.preventDefault();
      const url = `/app?view=transactions&propertyId=${propertyId}`;
      window.history.pushState({}, '', url);
      // Déclencher un événement personnalisé pour notifier AppShellClient du changement
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };
  // État pour la case à cocher "mois sélectionné" (loyers en retard)
  const [filterByCurrentMonth, setFilterByCurrentMonth] = useState(true);
  
  // État pour la case à cocher "mois sélectionné" (transactions non rapprochées)
  const [filterTransactionsByCurrentMonth, setFilterTransactionsByCurrentMonth] = useState(false);
  
  // État pour la modale des transactions non rapprochées
  const [showAllTransactionsNonRapprochees, setShowAllTransactionsNonRapprochees] = useState(false);
  
  // État pour la modale des échéances (prêts + charges)
  const [showAllEcheances, setShowAllEcheances] = useState(false);
  
  // État pour tracker les transactions en cours de rapprochement
  const [transactionsEnCoursRapprochement, setTransactionsEnCoursRapprochement] = useState<Set<string>>(new Set());
  
  const queryClient = useQueryClient();
  const toggleRapprochement = useToggleRapprochement(mode);
  
  // Filtrer les relances par mois sélectionné si la case est cochée
  const filteredRelances = filterByCurrentMonth && currentMonth
    ? relances.filter(r => r.accountingMonth === currentMonth)
    : relances;
  
  // Filtrer les transactions non rapprochées par mois sélectionné si la case est cochée
  const filteredTransactionsNonRapprochees = filterTransactionsByCurrentMonth && currentMonth
    ? transactionsNonRapprochees.filter(t => t.accountingMonth === currentMonth)
    : transactionsNonRapprochees;
  
  // Fonction pour rapprocher une transaction
  const handleRapprocher = async (transactionId: string) => {
    // Marquer la transaction comme en cours de rapprochement
    setTransactionsEnCoursRapprochement(prev => new Set(prev).add(transactionId));
    
    try {
      const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
      console.log('[TasksPanel] handleRapprocher - Début rapprochement transaction:', transactionId, 'mode:', mode, 'isOnline:', isOnline);
      
      // ⚠️ CRITIQUE: Vérifier que toggleRapprochement est bien initialisé
      if (!toggleRapprochement) {
        console.error('[TasksPanel] handleRapprocher - ❌ toggleRapprochement est undefined/null');
        throw new Error('toggleRapprochement hook non initialisé');
      }
      
      if (!toggleRapprochement.mutateAsync) {
        console.error('[TasksPanel] handleRapprocher - ❌ toggleRapprochement.mutateAsync est undefined/null');
        throw new Error('toggleRapprochement.mutateAsync non disponible');
      }
      
      console.log('[TasksPanel] handleRapprocher - ✅ toggleRapprochement.mutateAsync disponible, appel de la mutation...');
      console.log('[TasksPanel] handleRapprocher - Paramètres de la mutation:', {
        id: transactionId,
        status: 'rapprochee',
        mode,
      });
      
      // ⚠️ CRITIQUE: Appeler la mutation même en offline (offline-first)
      // Le hook useToggleRapprochement gère lui-même le mode offline
      const result = await toggleRapprochement.mutateAsync({
        id: transactionId,
        status: 'rapprochee',
        mode, // Passer le mode pour que useToggleRapprochement sache comment gérer
      });
      
      console.log('[TasksPanel] handleRapprocher - ✅ Rapprochement réussi, mode:', mode, 'result:', result);
      
      // En mode app-shell, émettre des événements pour rafraîchir le dashboard ET la vue sync
      if (mode === 'app-shell') {
        console.log('[TasksPanel] handleRapprocher - Mode app-shell, émission des événements de refresh');
        // Émettre dashboard:refresh pour rafraîchir le dashboard
        window.dispatchEvent(new CustomEvent('dashboard:refresh'));
        // Émettre sync:refresh pour rafraîchir la vue sync immédiatement
        window.dispatchEvent(new CustomEvent('sync:refresh'));
        // Petite pause pour laisser le temps à la pendingOp d'être créée et aux événements de se propager
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log('[TasksPanel] handleRapprocher - Événements émis, attente terminée');
      } else {
        // Mode normal : invalider les queries React Query
      queryClient.invalidateQueries({ 
        queryKey: ['dashboard-monthly'],
        exact: false 
      });
      }
      
      // Retirer de la liste des transactions en cours immédiatement pour que le bouton redevienne cliquable
      // (ne pas attendre 500ms car la mutation est déjà terminée)
      setTransactionsEnCoursRapprochement(prev => {
        const newSet = new Set(prev);
        newSet.delete(transactionId);
        console.log('[TasksPanel] handleRapprocher - Transaction retirée de transactionsEnCoursRapprochement');
        return newSet;
      });
    } catch (error) {
      // ⚠️ CRITIQUE: Ne pas masquer l'erreur, la logger complètement
      console.error('[TasksPanel] handleRapprocher - ❌ ERREUR lors du rapprochement:', error);
      console.error('[TasksPanel] handleRapprocher - ❌ Détails de l\'erreur:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        errorType: typeof error,
        errorString: String(error),
      });
      
      // ⚠️ CRITIQUE: Afficher un toast d'erreur pour informer l'utilisateur
      // (notify2 est déjà importé via useToggleRapprochement)
      if (error instanceof Error) {
        console.error('[TasksPanel] handleRapprocher - ❌ Message d\'erreur:', error.message);
      }
      
      // En cas d'erreur, retirer immédiatement de la liste des transactions en cours
      // pour que le bouton redevienne cliquable
      setTransactionsEnCoursRapprochement(prev => {
        const newSet = new Set(prev);
        newSet.delete(transactionId);
        console.log('[TasksPanel] handleRapprocher - Transaction retirée de transactionsEnCoursRapprochement après erreur');
        return newSet;
      });
      
      // ⚠️ CRITIQUE: Re-throw l'erreur pour que l'appelant puisse la gérer si nécessaire
      // (mais on ne bloque pas l'UI car on a déjà retiré la transaction de la liste)
      // Ne pas re-throw pour éviter de casser l'UI, mais logger l'erreur complètement
    }
  };

  // État pour le rapprochement en masse
  const [isReconcilingAll, setIsReconcilingAll] = useState(false);
  const [reconciliationProgress, setReconciliationProgress] = useState({
    processed: 0,
    total: 0,
    current: '',
  });
  
  // Ref pour garder l'état même en cas de re-render
  const isReconcilingRef = useRef(false);

  // Fonction pour rapprocher toutes les transactions
  const handleRapprocherTout = async () => {
    if (filteredTransactionsNonRapprochees.length === 0) return;

    // Sauvegarder la liste des transactions à traiter pour éviter les problèmes de re-render
    const transactionsToProcess = [...filteredTransactionsNonRapprochees];
    const total = transactionsToProcess.length;

    // Initialiser le rapprochement
    isReconcilingRef.current = true;
    setIsReconcilingAll(true);
    setReconciliationProgress({
      processed: 0,
      total,
      current: '',
    });

    // Marquer toutes les transactions comme en cours de rapprochement
    const allIds = transactionsToProcess.map(t => t.id);
    setTransactionsEnCoursRapprochement(prev => new Set([...prev, ...allIds]));

    try {
      let processed = 0;
      const errors: string[] = [];
      
      // Rapprocher toutes les transactions en séquence pour avoir un meilleur suivi
      for (const transaction of transactionsToProcess) {
        try {
          setReconciliationProgress(prev => ({
            ...prev,
            current: transaction.label,
          }));

          // Utiliser fetch directement pour éviter les invalidations automatiques du hook
          const res = await fetch(`/api/transactions/${transaction.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rapprochementStatus: 'rapprochee' })
          });

          if (!res.ok) {
            throw new Error(`Erreur HTTP: ${res.status}`);
          }

          processed++;
          setReconciliationProgress(prev => ({
            ...prev,
            processed,
            current: '',
          }));
        } catch (error) {
          console.error(`Erreur lors du rapprochement de ${transaction.id}:`, error);
          errors.push(transaction.label || transaction.id);
          // Continuer avec les autres transactions même en cas d'erreur
        }
      }

      // Attendre un peu pour que toutes les invalidations de queries soient terminées
      await new Promise(resolve => setTimeout(resolve, 300));

      // Invalider toutes les queries du dashboard pour rafraîchir les données
      await queryClient.invalidateQueries({ 
        queryKey: ['dashboard-monthly'],
        exact: false 
      });

      // Attendre encore un peu pour que les données soient rafraîchies
      await new Promise(resolve => setTimeout(resolve, 200));

      // Mettre la progression à 100% avant de fermer
      setReconciliationProgress(prev => ({
        ...prev,
        processed: total,
        current: '',
      }));

      // Petit délai pour voir la progression à 100%
      setTimeout(() => {
        isReconcilingRef.current = false;
        setIsReconcilingAll(false);
        setReconciliationProgress({ processed: 0, total: 0, current: '' });
      }, 500);

      // Afficher un message si des erreurs sont survenues
      if (errors.length > 0) {
        console.warn('Certaines transactions n\'ont pas pu être rapprochées:', errors);
      }
    } catch (error) {
      console.error('Erreur lors du rapprochement en masse:', error);
      // En cas d'erreur, retirer toutes les transactions de la liste des en cours
      setTransactionsEnCoursRapprochement(prev => {
        const newSet = new Set(prev);
        allIds.forEach(id => newSet.delete(id));
        return newSet;
      });
      isReconcilingRef.current = false;
      setIsReconcilingAll(false);
      setReconciliationProgress({ processed: 0, total: 0, current: '' });
    }
  };
  
  // Retirer les transactions qui ne sont plus dans la liste des transactions non rapprochées
  React.useEffect(() => {
    const transactionIds = new Set(transactionsNonRapprochees.map(t => t.id));
    setTransactionsEnCoursRapprochement(prev => {
      const filtered = Array.from(prev).filter(id => transactionIds.has(id));
      return filtered.length !== prev.size ? new Set(filtered) : prev;
    });
  }, [transactionsNonRapprochees]);
  
  // Calculer les données du graphique à partir des relances (même logique que l'encart)
  const graphDataFromRelances = React.useMemo(() => {
    // Utiliser les relances filtrées (même logique que l'encart)
    const dataToUse = filteredRelances;
    
    // Agrégation par accounting_month
    const monthMap = new Map<string, { count: number; montant: number }>();
    
    for (const relance of dataToUse) {
      let monthKey: string | null = null;
      
      if (relance.accountingMonth) {
        monthKey = relance.accountingMonth;
      } else if (relance.dateEcheance) {
        // Extraire YYYY-MM de la date d'échéance
        const date = new Date(relance.dateEcheance);
        monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      
      if (monthKey) {
        const existing = monthMap.get(monthKey) || { count: 0, montant: 0 };
        existing.count += 1;
        existing.montant += relance.montant;
        monthMap.set(monthKey, existing);
      }
    }
    
    // Convertir en tableau et trier
    const result = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        count: data.count,
      }));
    
    return result;
  }, [filteredRelances]);
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  };

  const formatAccountingMonth = (accountingMonth: string) => {
    // Format YYYY-MM vers "Mois Année" (ex: "2025-06" -> "Juin 2025")
    const [year, month] = accountingMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });
  };

  // Composant pour une tâche individuelle
  function TaskCard({
    icon: Icon,
    title,
    subtitle,
    date,
    amount,
    priority,
    actions,
  }: {
    icon: React.ElementType;
    title: string;
    subtitle?: string;
    date?: string;
    amount?: number;
    priority: 'high' | 'medium' | 'low';
    actions?: React.ReactNode;
  }) {
    const priorityClasses = {
      high: 'border-l-4 border-red-500 bg-red-50',
      medium: 'border-l-4 border-yellow-500 bg-yellow-50',
      low: 'border-l-4 border-blue-500 bg-blue-50',
    };

    return (
      <div
        className={cn(
          'bg-white rounded-lg border border-gray-200 p-2 hover:shadow-sm transition-shadow',
          priorityClasses[priority]
        )}
      >
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 mt-0.5">
            <Icon className="h-4 w-4 text-gray-400" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">
                  {title}
                </p>
                {subtitle && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
              
              {amount !== undefined && (
                <p className="text-xs font-semibold text-gray-900 flex-shrink-0">
                  {formatCurrency(amount)}
                </p>
              )}
            </div>
            
            <div className="flex items-center justify-end mt-1 gap-1">
              {actions && (
                <div className="flex items-center gap-1">
                  {actions}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // État pour la modale des relances
  const [showAllRelances, setShowAllRelances] = useState(false);

  // Layout horizontal : les 3 panneaux principaux côte à côte
  if (layout === 'horizontal') {
    return (
      <>
        <div className="space-y-6">
          {/* Loyers en retard avec graphique */}
          {relances.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Encart loyers en retard */}
              <div className="md:col-span-1">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <AlertCircle className="h-5 w-5 text-red-500" />
                          Loyers en retard
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {filteredRelances.length} loyer{filteredRelances.length > 1 ? 's' : ''} en retard
                          {filterByCurrentMonth && currentMonth && (
                            <span className="ml-1 text-gray-500">
                              ({formatAccountingMonth(currentMonth)})
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="danger" 
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setShowAllRelances(true)}
                        >
                          {filteredRelances.length}
                        </Badge>
                        <Badge 
                          variant="danger" 
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setShowAllRelances(true)}
                        >
                          {formatCurrency(
                            filteredRelances.reduce((sum, r) => sum + r.montant, 0)
                          )}
                        </Badge>
                      </div>
                    </div>
                    {currentMonth && (
                      <div className="mt-2 flex items-center gap-2">
                        <Checkbox
                          id="filter-month-relances-horizontal"
                          checked={filterByCurrentMonth}
                          onCheckedChange={(checked) => setFilterByCurrentMonth(checked === true)}
                        />
                        <label
                          htmlFor="filter-month-relances-horizontal"
                          className="text-xs text-gray-700 cursor-pointer"
                        >
                          Mois sélectionné ({formatAccountingMonth(currentMonth)})
                        </label>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {filteredRelances.slice(0, 3).map((loyer) => (
                        <TaskCard
                          key={loyer.id}
                          icon={Euro}
                          title={`${loyer.tenantName} - ${loyer.propertyName}`}
                          subtitle={loyer.accountingMonth ? formatAccountingMonth(loyer.accountingMonth) : `En retard de ${loyer.retardJours} jour${loyer.retardJours > 1 ? 's' : ''}`}
                          date={loyer.accountingMonth ? undefined : loyer.dateEcheance}
                          amount={loyer.montant}
                          priority="high"
                          actions={
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline">
                                <Send className="h-3 w-3 mr-1" />
                                Relancer
                              </Button>
                              {mode === 'app-shell' ? (
                                <a 
                                  href={getTransactionsLink(loyer.propertyId)}
                                  onClick={(e) => handleAppShellNavigation(e, loyer.propertyId)}
                                  className="inline-block"
                                >
                                  <Button size="sm" variant="ghost">
                                    <ArrowRight className="h-3 w-3" />
                                  </Button>
                                </a>
                              ) : (
                                <Link href={getTransactionsLink(loyer.propertyId)} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="ghost">
                                  <ArrowRight className="h-3 w-3" />
                                </Button>
                              </Link>
                              )}
                            </div>
                          }
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Graphique des loyers en retard par mois */}
              <div className="md:col-span-2">
                <LoyersRetardChart data={graphDataFromRelances} />
              </div>
            </div>
          )}

          {/* Transactions non rapprochées */}
          {transactionsNonRapprochees.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-5 w-5 text-orange-500" />
                      Transactions non rapprochées
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {filteredTransactionsNonRapprochees.length} transaction{filteredTransactionsNonRapprochees.length > 1 ? 's' : ''} non rapprochée{filteredTransactionsNonRapprochees.length > 1 ? 's' : ''}
                      {filterTransactionsByCurrentMonth && currentMonth && (
                        <span className="ml-1 text-gray-500">
                          ({formatAccountingMonth(currentMonth)})
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="warning"
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setShowAllTransactionsNonRapprochees(true)}
                  >
                    {filteredTransactionsNonRapprochees.length}
                  </Badge>
                </div>
                {currentMonth && (
                  <div className="mt-2 flex items-center gap-2">
                    <Checkbox
                      id="filter-month-transactions-horizontal"
                      checked={filterTransactionsByCurrentMonth}
                      onCheckedChange={(checked) => setFilterTransactionsByCurrentMonth(checked === true)}
                    />
                    <label
                      htmlFor="filter-month-transactions-horizontal"
                      className="text-xs text-gray-700 cursor-pointer"
                    >
                      Mois sélectionné ({formatAccountingMonth(currentMonth)})
                    </label>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredTransactionsNonRapprochees.slice(0, 3).map((transaction) => (
                    <TaskCard
                      key={transaction.id}
                      icon={FileText}
                      title={transaction.label}
                      subtitle={
                        transaction.accountingMonth
                          ? `${formatAccountingMonth(transaction.accountingMonth)} - ${transaction.tenantName 
                              ? `${transaction.tenantName} - ${transaction.propertyName}`
                              : transaction.propertyName}`
                          : transaction.tenantName 
                            ? `${transaction.tenantName} - ${transaction.propertyName}`
                            : transaction.propertyName
                      }
                      date={transaction.date}
                      amount={transaction.montant}
                      priority="medium"
                      actions={
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleRapprocher(transaction.id)}
                            disabled={toggleRapprochement.isPending || transactionsEnCoursRapprochement.has(transaction.id)}
                          >
                            Rapprocher
                          </Button>
                          {mode === 'app-shell' ? (
                            <a 
                              href={getTransactionsLink(transaction.propertyId)}
                              onClick={(e) => handleAppShellNavigation(e, transaction.propertyId)}
                              className="inline-block"
                            >
                              <Button size="sm" variant="ghost">
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            </a>
                          ) : (
                            <Link href={getTransactionsLink(transaction.propertyId)} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost">
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          </Link>
                          )}
                        </div>
                      }
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Panneaux principaux en ligne */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Échéances du mois */}
          {(echeancesPrets.length > 0 || echeancesCharges.length > 0) && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Calendar className="h-5 w-5 text-blue-500" />
                      Échéances du mois
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {echeancesPrets.length} prêt{echeancesPrets.length > 1 ? 's' : ''} et {echeancesCharges.length} charge{echeancesCharges.length > 1 ? 's' : ''} récurrente{echeancesCharges.length > 1 ? 's' : ''}{currentMonth ? ` (${formatAccountingMonth(currentMonth)})` : ''}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="info" 
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setShowAllEcheances(true)}
                    >
                      {echeancesPrets.length + echeancesCharges.length}
                    </Badge>
                    <Badge 
                      variant="info" 
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setShowAllEcheances(true)}
                    >
                      {formatCurrency(
                        echeancesPrets.reduce((sum, p) => sum + p.montantTotal, 0) +
                        echeancesCharges.reduce((sum, c) => sum + c.montant, 0)
                      )}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Échéances de prêts */}
                  {echeancesPrets.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 mb-2">Prêts</h4>
                      <div className="space-y-2">
                        {echeancesPrets.slice(0, 3).map((pret) => {
                          // Construire le subtitle avec info co-emprunteurs
                          let subtitle = '';
                          if (pret.capital !== undefined && pret.interets !== undefined) {
                            subtitle = `Capital: ${formatCurrency(pret.capital)} | Intérêts: ${formatCurrency(pret.interets)}${pret.assurance && pret.assurance > 0 ? ` | Assurance: ${formatCurrency(pret.assurance)}` : ''}`;
                          }
                          
                          // Ajouter info co-emprunteurs
                          if (pret.borrowersInfo && pret.borrowersInfo.count > 0) {
                            const totalBorrowers = pret.borrowersInfo.count;
                            const hasShares = pret.borrowersInfo.borrowers.some(b => b.share !== null);
                            
                            if (hasShares) {
                              // Afficher les parts individuelles
                              const sharesText = pret.borrowersInfo.borrowers
                                .map(b => {
                                  const shareAmount = b.share ? (pret.montantTotal * (b.share / 100)) : null;
                                  return shareAmount !== null 
                                    ? `${formatCurrency(shareAmount)} (${b.share}%)` 
                                    : null;
                                })
                                .filter(Boolean)
                                .join(' + ');
                              
                              if (sharesText) {
                                subtitle += `\n${totalBorrowers} co-emprunteur${totalBorrowers > 1 ? 's' : ''}: ${sharesText}`;
                              }
                            } else {
                              // Parts égales par défaut
                              const sharePerBorrower = pret.montantTotal / totalBorrowers;
                              subtitle += `\n${totalBorrowers} co-emprunteur${totalBorrowers > 1 ? 's' : ''}: ${formatCurrency(sharePerBorrower)} chacun`;
                            }
                          }
                          
                          return (
                            <TaskCard
                              key={pret.id}
                              icon={CreditCard}
                              title={pret.propertyName}
                              subtitle={subtitle}
                              date={pret.dateEcheance}
                              amount={pret.montantTotal}
                              priority="medium"
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Échéances de charges */}
                  {echeancesCharges.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 mb-2">Charges récurrentes</h4>
                      <div className="space-y-2">
                        {echeancesCharges.slice(0, 3).map((charge) => (
                          <TaskCard
                            key={charge.id}
                            icon={FileText}
                            title={charge.label}
                            subtitle={charge.propertyName || charge.type}
                            date={charge.dateEcheance}
                            amount={charge.montant}
                            priority="low"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Autres panneaux en dessous si nécessaire */}
        {(indexations.length > 0 ||
          bauxAEcheance.length > 0 ||
          documentsAValider.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Indexations */}
            {indexations.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <TrendingUp className="h-4 w-4 text-indigo-500" />
                        Indexations
                      </CardTitle>
                    </div>
                    <Badge variant="info" className="text-xs">{indexations.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {indexations.slice(0, 2).map((indexation) => (
                      <TaskCard
                        key={indexation.id}
                        icon={TrendingUp}
                        title={`${indexation.tenantName}`}
                        subtitle={`Loyer: ${formatCurrency(indexation.loyerActuel)}`}
                        date={indexation.dateAnniversaire}
                        priority="medium"
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Baux à renouveler */}
            {bauxAEcheance.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Home className="h-4 w-4 text-orange-500" />
                        Baux à renouveler
                      </CardTitle>
                    </div>
                    <Badge variant="warning" className="text-xs">{bauxAEcheance.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {bauxAEcheance.slice(0, 2).map((bail) => (
                      <TaskCard
                        key={bail.id}
                        icon={Home}
                        title={`${bail.tenantName}`}
                        subtitle={`Dans ${bail.joursRestants} j`}
                        date={bail.dateFinBail}
                        priority={bail.joursRestants <= 7 ? 'high' : 'medium'}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Documents à valider */}
            {documentsAValider.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-gray-500" />
                        Documents
                      </CardTitle>
                    </div>
                    <Badge variant="secondary" className="text-xs">{documentsAValider.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {documentsAValider.slice(0, 2).map((doc) => (
                      <TaskCard
                        key={doc.id}
                        icon={FileText}
                        title={doc.fileName}
                        subtitle={doc.ocrStatus}
                        date={doc.dateUpload}
                        priority="low"
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
        </div>

        {/* Modale pour toutes les relances */}
        {showAllRelances && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-6 w-6 text-red-500" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    Tous les loyers en retard
                  </h2>
                  <div className="flex items-center gap-2">
                    <Badge variant="danger">{filteredRelances.length}</Badge>
                    <Badge variant="danger">
                      {formatCurrency(
                        filteredRelances.reduce((sum, r) => sum + r.montant, 0)
                      )}
                    </Badge>
                  </div>
                  {filterByCurrentMonth && currentMonth && (
                    <span className="text-sm text-gray-500">
                      ({formatAccountingMonth(currentMonth)})
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowAllRelances(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-3">
                  {filteredRelances.map((loyer) => (
                    <TaskCard
                      key={loyer.id}
                      icon={Euro}
                      title={`${loyer.tenantName} - ${loyer.propertyName}`}
                      subtitle={loyer.accountingMonth ? formatAccountingMonth(loyer.accountingMonth) : `En retard de ${loyer.retardJours} jour${loyer.retardJours > 1 ? 's' : ''}`}
                      date={loyer.accountingMonth ? undefined : loyer.dateEcheance}
                      amount={loyer.montant}
                      priority="high"
                      actions={
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline">
                            <Send className="h-3 w-3 mr-1" />
                            Relancer
                          </Button>
                          {mode === 'app-shell' ? (
                            <a 
                              href={getTransactionsLink(loyer.propertyId)}
                              onClick={(e) => handleAppShellNavigation(e, loyer.propertyId)}
                              className="inline-block"
                            >
                              <Button size="sm" variant="ghost">
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            </a>
                          ) : (
                            <Link href={getTransactionsLink(loyer.propertyId)} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost">
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          </Link>
                          )}
                        </div>
                      }
                    />
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
                <Button variant="outline" onClick={() => setShowAllRelances(false)}>
                  Fermer
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modale pour toutes les transactions non rapprochées (layout horizontal) */}
        {showAllTransactionsNonRapprochees && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex items-center gap-2">
                  <FileText className="h-6 w-6 text-orange-500" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    Toutes les transactions non rapprochées
                  </h2>
                  <Badge variant="warning">{filteredTransactionsNonRapprochees.length}</Badge>
                  {filterTransactionsByCurrentMonth && currentMonth && (
                    <span className="text-sm text-gray-500">
                      ({formatAccountingMonth(currentMonth)})
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowAllTransactionsNonRapprochees(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-3">
                  {filteredTransactionsNonRapprochees.map((transaction) => (
                    <TaskCard
                      key={transaction.id}
                      icon={FileText}
                      title={transaction.label}
                      subtitle={
                        transaction.accountingMonth
                          ? `${formatAccountingMonth(transaction.accountingMonth)} - ${transaction.tenantName 
                              ? `${transaction.tenantName} - ${transaction.propertyName}`
                              : transaction.propertyName}`
                          : transaction.tenantName 
                            ? `${transaction.tenantName} - ${transaction.propertyName}`
                            : transaction.propertyName
                      }
                      date={transaction.date}
                      amount={transaction.montant}
                      priority="medium"
                      actions={
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleRapprocher(transaction.id)}
                            disabled={toggleRapprochement.isPending || transactionsEnCoursRapprochement.has(transaction.id)}
                          >
                            Rapprocher
                          </Button>
                          {mode === 'app-shell' ? (
                            <a 
                              href={getTransactionsLink(transaction.propertyId)}
                              onClick={(e) => handleAppShellNavigation(e, transaction.propertyId)}
                              className="inline-block"
                            >
                              <Button size="sm" variant="ghost">
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            </a>
                          ) : (
                            <Link href={getTransactionsLink(transaction.propertyId)} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost">
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          </Link>
                          )}
                        </div>
                      }
                    />
                  ))}
                </div>
              </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 p-6 border-t bg-gray-50">
              <Button 
                variant="primary"
                onClick={handleRapprocherTout}
                disabled={filteredTransactionsNonRapprochees.length === 0 || isReconcilingAll}
              >
                {isReconcilingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Rapprochement en cours...
                  </>
                ) : (
                  <>
                    Tout rapprocher ({filteredTransactionsNonRapprochees.length})
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowAllTransactionsNonRapprochees(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modale pour toutes les échéances */}
      {showAllEcheances && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-2">
                <Calendar className="h-6 w-6 text-blue-500" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Toutes les échéances du mois
                </h2>
                <Badge variant="info">{echeancesPrets.length + echeancesCharges.length}</Badge>
              </div>
              <button
                onClick={() => setShowAllEcheances(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Content scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Prêts */}
                {echeancesPrets.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Prêts ({echeancesPrets.length})
                    </h3>
                    <div className="space-y-2">
                      {echeancesPrets.map((pret) => {
                        // Construire le subtitle avec info co-emprunteurs
                        let subtitle = '';
                        if (pret.capital !== undefined && pret.interets !== undefined) {
                          subtitle = `Capital: ${formatCurrency(pret.capital)} | Intérêts: ${formatCurrency(pret.interets)}${pret.assurance && pret.assurance > 0 ? ` | Assurance: ${formatCurrency(pret.assurance)}` : ''}`;
                        }
                        
                        // Ajouter info co-emprunteurs
                        if (pret.borrowersInfo && pret.borrowersInfo.count > 0) {
                          const totalBorrowers = pret.borrowersInfo.count;
                          const hasShares = pret.borrowersInfo.borrowers.some(b => b.share !== null);
                          
                          if (hasShares) {
                            // Afficher les parts individuelles
                            const sharesText = pret.borrowersInfo.borrowers
                              .map(b => {
                                const shareAmount = b.share ? (pret.montantTotal * (b.share / 100)) : null;
                                return shareAmount !== null 
                                  ? `${formatCurrency(shareAmount)} (${b.share}%)` 
                                  : null;
                              })
                              .filter(Boolean)
                              .join(' + ');
                            
                            if (sharesText) {
                              subtitle += `\n${totalBorrowers} co-emprunteur${totalBorrowers > 1 ? 's' : ''}: ${sharesText}`;
                            }
                          } else {
                            // Parts égales par défaut
                            const sharePerBorrower = pret.montantTotal / totalBorrowers;
                            subtitle += `\n${totalBorrowers} co-emprunteur${totalBorrowers > 1 ? 's' : ''}: ${formatCurrency(sharePerBorrower)} chacun`;
                          }
                        }
                        
                        return (
                          <TaskCard
                            key={pret.id}
                            icon={CreditCard}
                            title={pret.propertyName}
                            subtitle={subtitle}
                            date={pret.dateEcheance}
                            amount={pret.montantTotal}
                            priority="medium"
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Charges récurrentes */}
                {echeancesCharges.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Charges récurrentes ({echeancesCharges.length})
                    </h3>
                    <div className="space-y-2">
                      {echeancesCharges.map((charge) => (
                        <TaskCard
                          key={charge.id}
                          icon={FileText}
                          title={charge.label}
                          subtitle={charge.propertyName || charge.type}
                          date={charge.dateEcheance}
                          amount={charge.montant}
                          priority="low"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
              <Button variant="outline" onClick={() => setShowAllEcheances(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de chargement pendant le rapprochement en masse */}
      <TransactionReconciliationLoadingOverlay
        isReconciling={isReconcilingAll}
        totalTransactions={reconciliationProgress.total}
        transactionsProcessed={reconciliationProgress.processed}
        currentTransaction={reconciliationProgress.current}
      />
    </>
  );
}

  // État pour la modale des relances (mode vertical)
  const [showAllRelancesVertical, setShowAllRelancesVertical] = useState(false);

  // Layout vertical : affichage par défaut (empilé)
  return (
    <>
      <div className="space-y-6">
        {/* Loyers en retard */}
        {relances.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    Loyers en retard
                  </CardTitle>
                  <CardDescription>
                    {filteredRelances.length} loyer{filteredRelances.length > 1 ? 's' : ''} en retard
                    {filterByCurrentMonth && currentMonth && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({formatAccountingMonth(currentMonth)})
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="danger"
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setShowAllRelancesVertical(true)}
                  >
                    {filteredRelances.length}
                  </Badge>
                  <Badge 
                    variant="danger"
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setShowAllRelancesVertical(true)}
                  >
                    {formatCurrency(
                      filteredRelances.reduce((sum, r) => sum + r.montant, 0)
                    )}
                  </Badge>
                </div>
              </div>
              {currentMonth && (
                <div className="mt-3 flex items-center gap-2">
                  <Checkbox
                    id="filter-month-relances"
                    checked={filterByCurrentMonth}
                    onCheckedChange={(checked) => setFilterByCurrentMonth(checked === true)}
                  />
                  <label
                    htmlFor="filter-month-relances"
                    className="text-sm text-gray-700 cursor-pointer"
                  >
                    Mois sélectionné ({formatAccountingMonth(currentMonth)})
                  </label>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredRelances.slice(0, 5).map((loyer) => (
                <TaskCard
                  key={loyer.id}
                  icon={Euro}
                  title={`${loyer.tenantName} - ${loyer.propertyName}`}
                  subtitle={loyer.accountingMonth ? formatAccountingMonth(loyer.accountingMonth) : `En retard de ${loyer.retardJours} jour${loyer.retardJours > 1 ? 's' : ''}`}
                  date={loyer.accountingMonth ? undefined : loyer.dateEcheance}
                  amount={loyer.montant}
                  priority="high"
                  actions={
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline">
                        <Send className="h-3 w-3 mr-1" />
                        Relancer
                      </Button>
                      {mode === 'app-shell' ? (
                        <a 
                          href={getTransactionsLink(loyer.propertyId)}
                          onClick={(e) => handleAppShellNavigation(e, loyer.propertyId)}
                          className="inline-block"
                        >
                          <Button size="sm" variant="ghost">
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </a>
                      ) : (
                        <Link href={getTransactionsLink(loyer.propertyId)} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost">
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                      )}
                    </div>
                  }
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions non rapprochées */}
      {transactionsNonRapprochees.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-orange-500" />
                  Transactions non rapprochées
                </CardTitle>
                <CardDescription>
                  {filteredTransactionsNonRapprochees.length} transaction{filteredTransactionsNonRapprochees.length > 1 ? 's' : ''} non rapprochée{filteredTransactionsNonRapprochees.length > 1 ? 's' : ''}
                  {filterTransactionsByCurrentMonth && currentMonth && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({formatAccountingMonth(currentMonth)})
                    </span>
                  )}
                </CardDescription>
              </div>
              <Badge
                variant="warning"
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setShowAllTransactionsNonRapprochees(true)}
              >
                {filteredTransactionsNonRapprochees.length}
              </Badge>
            </div>
            {currentMonth && (
              <div className="mt-3 flex items-center gap-2">
                <Checkbox
                  id="filter-month-transactions"
                  checked={filterTransactionsByCurrentMonth}
                  onCheckedChange={(checked) => setFilterTransactionsByCurrentMonth(checked === true)}
                />
                <label
                  htmlFor="filter-month-transactions"
                  className="text-sm text-gray-700 cursor-pointer"
                >
                  Mois sélectionné ({formatAccountingMonth(currentMonth)})
                </label>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredTransactionsNonRapprochees.slice(0, 3).map((transaction) => (
                <TaskCard
                  key={transaction.id}
                  icon={FileText}
                  title={transaction.label}
                  subtitle={transaction.tenantName 
                    ? `${transaction.tenantName} - ${transaction.propertyName}`
                    : transaction.propertyName}
                  date={transaction.date}
                  amount={transaction.montant}
                  priority="medium"
                  actions={
                    <div className="flex gap-1">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleRapprocher(transaction.id)}
                        disabled={toggleRapprochement.isPending || transactionsEnCoursRapprochement.has(transaction.id)}
                      >
                        Rapprocher
                      </Button>
                          {mode === 'app-shell' ? (
                            <a 
                              href={getTransactionsLink(transaction.propertyId)}
                              onClick={(e) => handleAppShellNavigation(e, transaction.propertyId)}
                              className="inline-block"
                            >
                              <Button size="sm" variant="ghost">
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            </a>
                          ) : (
                            <Link href={getTransactionsLink(transaction.propertyId)} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost">
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                          )}
                    </div>
                  }
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Indexations à traiter */}
      {indexations.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-indigo-500" />
                  Indexations à traiter
                </CardTitle>
                <CardDescription>
                  Anniversaires de baux
                </CardDescription>
              </div>
              <Badge variant="info">{indexations.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {indexations.slice(0, 3).map((indexation) => (
                <TaskCard
                  key={indexation.id}
                  icon={TrendingUp}
                  title={`${indexation.tenantName} - ${indexation.propertyName}`}
                  subtitle={`Indice ${indexation.indiceRequis} - Loyer actuel: ${formatCurrency(indexation.loyerActuel)}`}
                  date={indexation.dateAnniversaire}
                  priority="medium"
                  actions={
                    <Button size="sm" variant="outline">
                      Calculer
                    </Button>
                  }
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Échéances du mois */}
      {(echeancesPrets.length > 0 || echeancesCharges.length > 0) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  Échéances du mois
                </CardTitle>
                <CardDescription>
                  Prêts et charges récurrentes
                </CardDescription>
              </div>
              <Badge variant="info">{echeancesPrets.length + echeancesCharges.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Échéances de prêts */}
              {echeancesPrets.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-600 mb-2">Prêts</h4>
                  <div className="space-y-2">
                    {echeancesPrets.slice(0, 3).map((pret) => {
                      // Construire le subtitle avec info co-emprunteurs
                      let subtitle = '';
                      if (pret.capital !== undefined && pret.interets !== undefined) {
                        subtitle = `Capital: ${formatCurrency(pret.capital)} | Intérêts: ${formatCurrency(pret.interets)}${pret.assurance && pret.assurance > 0 ? ` | Assurance: ${formatCurrency(pret.assurance)}` : ''}`;
                      }
                      
                      // Ajouter info co-emprunteurs
                      if (pret.borrowersInfo && pret.borrowersInfo.count > 0) {
                        const totalBorrowers = pret.borrowersInfo.count;
                        const hasShares = pret.borrowersInfo.borrowers.some(b => b.share !== null);
                        
                        if (hasShares) {
                          // Afficher les parts individuelles
                          const sharesText = pret.borrowersInfo.borrowers
                            .map(b => {
                              const shareAmount = b.share ? (pret.montantTotal * (b.share / 100)) : null;
                              return shareAmount !== null 
                                ? `${formatCurrency(shareAmount)} (${b.share}%)` 
                                : null;
                            })
                            .filter(Boolean)
                            .join(' + ');
                          
                          if (sharesText) {
                            subtitle += `\n${totalBorrowers} co-emprunteur${totalBorrowers > 1 ? 's' : ''}: ${sharesText}`;
                          }
                        } else {
                          // Parts égales par défaut
                          const sharePerBorrower = pret.montantTotal / totalBorrowers;
                          subtitle += `\n${totalBorrowers} co-emprunteur${totalBorrowers > 1 ? 's' : ''}: ${formatCurrency(sharePerBorrower)} chacun`;
                        }
                      }
                      
                      return (
                        <TaskCard
                          key={pret.id}
                          icon={CreditCard}
                          title={pret.propertyName}
                          subtitle={subtitle}
                          date={pret.dateEcheance}
                          amount={pret.montantTotal}
                          priority="medium"
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Échéances de charges */}
              {echeancesCharges.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-600 mb-2">Charges récurrentes</h4>
                  <div className="space-y-2">
                    {echeancesCharges.slice(0, 5).map((charge) => (
                      <TaskCard
                        key={charge.id}
                        icon={FileText}
                        title={charge.label}
                        subtitle={charge.propertyName || charge.type}
                        date={charge.dateEcheance}
                        amount={charge.montant}
                        priority="low"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Baux arrivant à échéance */}
      {bauxAEcheance.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5 text-orange-500" />
                  Baux à renouveler
                </CardTitle>
                <CardDescription>
                  Échéances dans les 3 mois
                </CardDescription>
              </div>
              <Badge variant="warning">{bauxAEcheance.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bauxAEcheance.map((bail) => (
                <TaskCard
                  key={bail.id}
                  icon={Home}
                  title={`${bail.tenantName} - ${bail.propertyName}`}
                  subtitle={`Dans ${bail.joursRestants} jour${bail.joursRestants > 1 ? 's' : ''}`}
                  date={bail.dateFinBail}
                  priority={bail.joursRestants <= 7 ? 'high' : 'medium'}
                  actions={
                    <Button size="sm" variant="outline">
                      Gérer
                    </Button>
                  }
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents à valider */}
      {documentsAValider.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-500" />
                  Documents à valider
                </CardTitle>
                <CardDescription>
                  OCR en attente ou erreur
                </CardDescription>
              </div>
              <Badge variant="secondary">{documentsAValider.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {documentsAValider.slice(0, 5).map((doc) => (
                <TaskCard
                  key={doc.id}
                  icon={FileText}
                  title={doc.fileName}
                  subtitle={`Statut: ${doc.ocrStatus}`}
                  date={doc.dateUpload}
                  priority="low"
                  actions={
                    <Button size="sm" variant="outline">
                      Valider
                    </Button>
                  }
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

                {/* État vide */}
                {relances.length === 0 &&
                  transactionsNonRapprochees.length === 0 &&
                  indexations.length === 0 &&
        echeancesPrets.length === 0 &&
        echeancesCharges.length === 0 &&
        bauxAEcheance.length === 0 &&
        documentsAValider.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Aucune tâche urgente
                </h3>
                <p className="text-sm text-gray-500">
                  Tous vos loyers sont à jour et aucune action n'est requise pour le moment.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modale pour toutes les relances (mode vertical) */}
      {showAllRelancesVertical && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-6 w-6 text-red-500" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    Toutes les relances urgentes
                  </h2>
                  <div className="flex items-center gap-2">
                    <Badge variant="danger">{filteredRelances.length}</Badge>
                    <Badge variant="danger">
                      {formatCurrency(
                        filteredRelances.reduce((sum, r) => sum + r.montant, 0)
                      )}
                    </Badge>
                  </div>
                  {filterByCurrentMonth && currentMonth && (
                    <span className="text-sm text-gray-500">
                      ({formatAccountingMonth(currentMonth)})
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowAllRelancesVertical(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-3">
                  {filteredRelances.map((loyer) => (
                  <TaskCard
                    key={loyer.id}
                    icon={Euro}
                    title={`${loyer.tenantName} - ${loyer.propertyName}`}
                    subtitle={loyer.accountingMonth ? formatAccountingMonth(loyer.accountingMonth) : `En retard de ${loyer.retardJours} jour${loyer.retardJours > 1 ? 's' : ''}`}
                    date={loyer.accountingMonth ? undefined : loyer.dateEcheance}
                    amount={loyer.montant}
                    priority="high"
                    actions={
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline">
                          <Send className="h-3 w-3 mr-1" />
                          Relancer
                        </Button>
                        {mode === 'app-shell' ? (
                          <a 
                            href={getTransactionsLink(loyer.propertyId)}
                            onClick={(e) => handleAppShellNavigation(e, loyer.propertyId)}
                            className="inline-block"
                          >
                            <Button size="sm" variant="ghost">
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          </a>
                        ) : (
                          <Link href={getTransactionsLink(loyer.propertyId)} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost">
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                        )}
                      </div>
                    }
                  />
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
              <Button variant="outline" onClick={() => setShowAllRelancesVertical(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modale pour toutes les transactions non rapprochées */}
      {showAllTransactionsNonRapprochees && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-2">
                <FileText className="h-6 w-6 text-orange-500" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Toutes les transactions non rapprochées
                </h2>
                <Badge variant="warning">{filteredTransactionsNonRapprochees.length}</Badge>
                {filterTransactionsByCurrentMonth && currentMonth && (
                  <span className="text-sm text-gray-500">
                    ({formatAccountingMonth(currentMonth)})
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowAllTransactionsNonRapprochees(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3">
                {filteredTransactionsNonRapprochees.map((transaction) => (
                  <TaskCard
                    key={transaction.id}
                    icon={FileText}
                    title={transaction.label}
                    subtitle={
                      transaction.accountingMonth
                        ? `${formatAccountingMonth(transaction.accountingMonth)} - ${transaction.tenantName 
                            ? `${transaction.tenantName} - ${transaction.propertyName}`
                            : transaction.propertyName}`
                        : transaction.tenantName 
                          ? `${transaction.tenantName} - ${transaction.propertyName}`
                          : transaction.propertyName
                    }
                    date={transaction.date}
                    amount={transaction.montant}
                    priority="medium"
                    actions={
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleRapprocher(transaction.id)}
                          disabled={toggleRapprochement.isPending}
                        >
                          Rapprocher
                        </Button>
                          {mode === 'app-shell' ? (
                            <a 
                              href={getTransactionsLink(transaction.propertyId)}
                              onClick={(e) => handleAppShellNavigation(e, transaction.propertyId)}
                              className="inline-block"
                            >
                              <Button size="sm" variant="ghost">
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            </a>
                          ) : (
                            <Link href={getTransactionsLink(transaction.propertyId)} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost">
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                          )}
                      </div>
                    }
                  />
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 p-6 border-t bg-gray-50">
              <Button 
                variant="primary"
                onClick={handleRapprocherTout}
                disabled={filteredTransactionsNonRapprochees.length === 0 || isReconcilingAll}
              >
                {isReconcilingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Rapprochement en cours...
                  </>
                ) : (
                  <>
                    Tout rapprocher ({filteredTransactionsNonRapprochees.length})
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowAllTransactionsNonRapprochees(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modale pour toutes les échéances */}
      {showAllEcheances && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-2">
                <Calendar className="h-6 w-6 text-blue-500" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Toutes les échéances du mois
                </h2>
                <Badge variant="info">{echeancesPrets.length + echeancesCharges.length}</Badge>
              </div>
              <button
                onClick={() => setShowAllEcheances(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Content scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Prêts */}
                {echeancesPrets.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Prêts ({echeancesPrets.length})
                    </h3>
                    <div className="space-y-2">
                      {echeancesPrets.map((pret) => {
                        // Construire le subtitle avec info co-emprunteurs
                        let subtitle = '';
                        if (pret.capital !== undefined && pret.interets !== undefined) {
                          subtitle = `Capital: ${formatCurrency(pret.capital)} | Intérêts: ${formatCurrency(pret.interets)}${pret.assurance && pret.assurance > 0 ? ` | Assurance: ${formatCurrency(pret.assurance)}` : ''}`;
                        }
                        
                        // Ajouter info co-emprunteurs
                        if (pret.borrowersInfo && pret.borrowersInfo.count > 0) {
                          const totalBorrowers = pret.borrowersInfo.count;
                          const hasShares = pret.borrowersInfo.borrowers.some(b => b.share !== null);
                          
                          if (hasShares) {
                            // Afficher les parts individuelles
                            const sharesText = pret.borrowersInfo.borrowers
                              .map(b => {
                                const shareAmount = b.share ? (pret.montantTotal * (b.share / 100)) : null;
                                return shareAmount !== null 
                                  ? `${formatCurrency(shareAmount)} (${b.share}%)` 
                                  : null;
                              })
                              .filter(Boolean)
                              .join(' + ');
                            
                            if (sharesText) {
                              subtitle += `\n${totalBorrowers} co-emprunteur${totalBorrowers > 1 ? 's' : ''}: ${sharesText}`;
                            }
                          } else {
                            // Parts égales par défaut
                            const sharePerBorrower = pret.montantTotal / totalBorrowers;
                            subtitle += `\n${totalBorrowers} co-emprunteur${totalBorrowers > 1 ? 's' : ''}: ${formatCurrency(sharePerBorrower)} chacun`;
                          }
                        }
                        
                        return (
                          <TaskCard
                            key={pret.id}
                            icon={CreditCard}
                            title={pret.propertyName}
                            subtitle={subtitle}
                            date={pret.dateEcheance}
                            amount={pret.montantTotal}
                            priority="medium"
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Charges récurrentes */}
                {echeancesCharges.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Charges récurrentes ({echeancesCharges.length})
                    </h3>
                    <div className="space-y-2">
                      {echeancesCharges.map((charge) => (
                        <TaskCard
                          key={charge.id}
                          icon={FileText}
                          title={charge.label}
                          subtitle={charge.propertyName || charge.type}
                          date={charge.dateEcheance}
                          amount={charge.montant}
                          priority="low"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
              <Button variant="outline" onClick={() => setShowAllEcheances(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de chargement pendant le rapprochement en masse */}
      <TransactionReconciliationLoadingOverlay
        isReconciling={isReconcilingAll}
        totalTransactions={reconciliationProgress.total}
        transactionsProcessed={reconciliationProgress.processed}
        currentTransaction={reconciliationProgress.current}
      />
    </>
  );
}

