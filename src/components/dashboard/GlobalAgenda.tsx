'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Separator } from '@/components/ui/Separator';
import { AgendaItem } from '@/types/dashboard';
import { Calendar, ChevronRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/utils/cn';

interface GlobalAgendaProps {
  agenda: AgendaItem[];
  isLoading?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  loyer: 'Loyer',
  indexation: 'Indexation',
  pret: 'Prêt',
  impots: 'Impôts',
  copro: 'Copropriété',
  pno: 'PNO',
  cfe: 'CFE',
  entretien: 'Entretien',
  transaction: 'Transaction',
};

const TYPE_COLORS: Record<string, string> = {
  loyer: 'bg-blue-100 text-blue-700 border-blue-200',
  indexation: 'bg-purple-100 text-purple-700 border-purple-200',
  pret: 'bg-red-100 text-red-700 border-red-200',
  impots: 'bg-orange-100 text-orange-700 border-orange-200',
  copro: 'bg-green-100 text-green-700 border-green-200',
  pno: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  cfe: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  entretien: 'bg-gray-100 text-gray-700 border-gray-200',
  transaction: 'bg-slate-100 text-slate-700 border-slate-200',
};

const ITEMS_PER_PAGE = 40;

export function GlobalAgenda({ agenda, isLoading = false }: GlobalAgendaProps) {
  const [showAll, setShowAll] = useState(false);
  const [collapsedYears, setCollapsedYears] = useState<Set<string>>(new Set());

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-gray-200 rounded w-1/3" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Grouper par année
  const groupByYear = (items: AgendaItem[]) => {
    const grouped = new Map<string, AgendaItem[]>();
    items.forEach((item) => {
      const year = new Date(item.date).getFullYear().toString();
      if (!grouped.has(year)) {
        grouped.set(year, []);
      }
      grouped.get(year)!.push(item);
    });
    return grouped;
  };

  // Déterminer le statut d'une échéance
  const getStatus = (dateStr: string): 'a-venir' | 'en-retard' => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const itemDate = new Date(dateStr);
    itemDate.setHours(0, 0, 0, 0);
    
    if (itemDate >= today) return 'a-venir';
    return 'en-retard';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'a-venir':
        return <Badge variant="success" className="text-xs">🟢 À venir</Badge>;
      case 'en-retard':
        return <Badge variant="danger" className="text-xs">🔴 En retard</Badge>;
      default:
        return null;
    }
  };

  const toggleYear = (year: string) => {
    setCollapsedYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  const formatCurrency = (amount?: number) => {
    if (amount === undefined) return '—';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getEntityUrl = (item: AgendaItem) => {
    if (!item.entity) return null;
    const { kind, id } = item.entity;
    switch (kind) {
      case 'property':
        return `/biens/${id}/transactions`;
      case 'lease':
        return `/baux/${id}`;
      case 'transaction':
        return `/transactions?highlight=${id}`;
      default:
        return null;
    }
  };

  const displayedItems = showAll ? agenda : agenda.slice(0, ITEMS_PER_PAGE);
  const groupedByYear = groupByYear(displayedItems);
  const years = Array.from(groupedByYear.keys()).sort((a, b) => parseInt(a) - parseInt(b));

  if (agenda.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Échéancier / Agenda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Calendar className="h-12 w-12 mb-2 opacity-30" />
            <p className="text-sm">Aucune échéance sur cette période</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Échéancier / Agenda</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {agenda.length} échéance{agenda.length > 1 ? 's' : ''}
            </Badge>
            <Link href="/echeances">
              <Button variant="outline" size="sm">
                Voir plus
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {years.map((year) => {
            const yearItems = groupedByYear.get(year) || [];
            const isCollapsed = collapsedYears.has(year);
            
            return (
              <div key={year} className="border border-gray-200 rounded-lg">
                {/* En-tête de l'année (cliquable pour déplier/replier) */}
                <button
                  onClick={() => toggleYear(year)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors rounded-t-lg"
                >
                  <div className="flex items-center gap-2">
                    <ChevronRight className={cn(
                      "h-5 w-5 transition-transform",
                      !isCollapsed && "rotate-90"
                    )} />
                    <h3 className="font-semibold text-gray-900">{year}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {yearItems.length}
                    </Badge>
                  </div>
                </button>

                {/* Items de l'année */}
                {!isCollapsed && (
                  <div className="p-2 space-y-0">
                    {yearItems.map((item, index) => {
                      const entityUrl = getEntityUrl(item);
                      const typeColor = TYPE_COLORS[item.type] || TYPE_COLORS.transaction;
                      const typeLabel = TYPE_LABELS[item.type] || item.type;
                      const status = getStatus(item.date);

                      return (
                        <React.Fragment key={`${item.date}-${item.label}-${index}`}>
                          <div className="flex items-center justify-between py-3 px-2 hover:bg-gray-50 rounded-lg transition-colors">
                            {/* Date (à gauche) */}
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="flex-shrink-0 flex items-center gap-2 text-sm text-gray-600 min-w-[100px]">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <span className="font-medium">{formatDate(item.date)}</span>
                              </div>

                              {/* Libellé */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-gray-900 truncate">{item.label}</p>
                                  <Badge
                                    variant="outline"
                                    className={cn('text-xs border', typeColor)}
                                  >
                                    {typeLabel}
                                  </Badge>
                                  {getStatusBadge(status)}
                                </div>
                              </div>
                            </div>

                            {/* Montant et lien (à droite) */}
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {item.amount !== undefined && (
                                <p className="text-sm font-semibold text-gray-900 min-w-[80px] text-right">
                                  {formatCurrency(item.amount)}
                                </p>
                              )}
                              {entityUrl && (
                                <Link href={entityUrl}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    aria-label="Voir le détail"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </div>
                          {index < yearItems.length - 1 && <Separator />}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bouton "Afficher plus/moins" */}
        {agenda.length > ITEMS_PER_PAGE && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? 'Afficher moins' : `Voir plus d'échéances (${agenda.length - ITEMS_PER_PAGE} de plus)`}
              <ChevronRight className={cn("h-4 w-4 ml-2", showAll && "rotate-90")} />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

