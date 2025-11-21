'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type {
  LoyerNonEncaisse,
  IndexationATraiter,
  EcheancePret,
  EcheanceCharge,
  BailAEcheance,
  DocumentAValider,
} from '@/types/dashboard';

export interface TasksPanelProps {
  loyersNonEncaisses: LoyerNonEncaisse[];
  relances: LoyerNonEncaisse[];
  indexations: IndexationATraiter[];
  echeancesPrets: EcheancePret[];
  echeancesCharges: EcheanceCharge[];
  bauxAEcheance: BailAEcheance[];
  documentsAValider: DocumentAValider[];
  layout?: 'vertical' | 'horizontal';
  currentMonth?: string; // Format YYYY-MM (ex: "2025-11")
}

export function TasksPanel({
  loyersNonEncaisses,
  relances,
  indexations,
  echeancesPrets,
  echeancesCharges,
  bauxAEcheance,
  documentsAValider,
  layout = 'vertical',
  currentMonth,
}: TasksPanelProps) {
  // État pour la case à cocher "mois sélectionné"
  const [filterByCurrentMonth, setFilterByCurrentMonth] = useState(false);
  
  // Filtrer les relances par mois sélectionné si la case est cochée
  const filteredRelances = filterByCurrentMonth && currentMonth
    ? relances.filter(r => r.accountingMonth === currentMonth)
    : relances;
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
          'bg-white rounded-lg border border-gray-200 p-3 hover:shadow-sm transition-shadow',
          priorityClasses[priority]
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <Icon className="h-5 w-5 text-gray-400" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {title}
                </p>
                {subtitle && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
              
              {amount !== undefined && (
                <p className="text-sm font-semibold text-gray-900 flex-shrink-0">
                  {formatCurrency(amount)}
                </p>
              )}
            </div>
            
            <div className="flex items-center justify-end mt-2 gap-2">
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
          {/* Panneaux principaux en ligne */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Loyers en retard */}
            {relances.length > 0 && (
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
                    <Badge 
                      variant="danger" 
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setShowAllRelances(true)}
                    >
                      {filteredRelances.length}
                    </Badge>
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
                          <Link href={`/biens/${loyer.propertyId}/transactions`} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost">
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          </Link>
                        </div>
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
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Calendar className="h-5 w-5 text-blue-500" />
                      Échéances du mois
                    </CardTitle>
                    <CardDescription className="text-xs">
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
                        {echeancesPrets.slice(0, 3).map((pret) => (
                          <TaskCard
                            key={pret.id}
                            icon={CreditCard}
                            title={pret.propertyName}
                            subtitle={
                              pret.capital && pret.interets
                                ? `Capital: ${formatCurrency(pret.capital)} | Intérêts: ${formatCurrency(pret.interets)}`
                                : undefined
                            }
                            date={pret.dateEcheance}
                            amount={pret.montantTotal}
                            priority="medium"
                          />
                        ))}
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
        {(loyersNonEncaisses.filter(l => l.statut === 'a_venir').length > 0 ||
          indexations.length > 0 ||
          bauxAEcheance.length > 0 ||
          documentsAValider.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Loyers à venir */}
            {loyersNonEncaisses.filter(l => l.statut === 'a_venir').length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-blue-500" />
                        Loyers à venir
                      </CardTitle>
                    </div>
                    <Badge variant="warning" className="text-xs">
                      {loyersNonEncaisses.filter(l => l.statut === 'a_venir').length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {loyersNonEncaisses
                      .filter(l => l.statut === 'a_venir')
                      .slice(0, 2)
                      .map((loyer) => (
                        <TaskCard
                          key={loyer.id}
                          icon={Calendar}
                          title={`${loyer.tenantName} - ${loyer.propertyName}`}
                          subtitle="À encaisser"
                          date={loyer.dateEcheance}
                          amount={loyer.montant}
                          priority="medium"
                        />
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

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
                  <Badge variant="danger">{filteredRelances.length}</Badge>
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
                          <Link href={`/biens/${loyer.propertyId}/transactions`} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost">
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          </Link>
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
                <Badge 
                  variant="danger"
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setShowAllRelancesVertical(true)}
                >
                  {filteredRelances.length}
                </Badge>
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
                      <Link href={`/biens/${loyer.propertyId}/transactions`} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost">
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  }
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loyers à venir (non payés) */}
      {loyersNonEncaisses.filter(l => l.statut === 'a_venir').length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  Loyers à venir
                </CardTitle>
                <CardDescription>
                  En attente de paiement
                </CardDescription>
              </div>
              <Badge variant="warning">
                {loyersNonEncaisses.filter(l => l.statut === 'a_venir').length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {loyersNonEncaisses
                .filter(l => l.statut === 'a_venir')
                .slice(0, 5)
                .map((loyer) => (
                  <TaskCard
                    key={loyer.id}
                    icon={Calendar}
                    title={`${loyer.tenantName} - ${loyer.propertyName}`}
                    subtitle="À encaisser"
                    date={loyer.dateEcheance}
                    amount={loyer.montant}
                    priority="medium"
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
                    {echeancesPrets.slice(0, 3).map((pret) => (
                      <TaskCard
                        key={pret.id}
                        icon={CreditCard}
                        title={pret.propertyName}
                        subtitle={
                          pret.capital && pret.interets
                            ? `Capital: ${formatCurrency(pret.capital)} | Intérêts: ${formatCurrency(pret.interets)}`
                            : undefined
                        }
                        date={pret.dateEcheance}
                        amount={pret.montantTotal}
                        priority="medium"
                      />
                    ))}
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
        loyersNonEncaisses.filter(l => l.statut === 'a_venir').length === 0 &&
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
                  <Badge variant="danger">{filteredRelances.length}</Badge>
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
                        <Link href={`/biens/${loyer.propertyId}/transactions`} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost">
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
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
    </>
  );
}

