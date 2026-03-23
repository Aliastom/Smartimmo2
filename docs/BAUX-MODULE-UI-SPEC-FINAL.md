# Module BAUX — Spécification UI finale (prête à coder)

> Version conclusive. Hiérarchie visuelle optimale, labels métier, règles d'affichage strictes.

---

## Règles d'affichage conditionnel

### Bandeau d'alerte
**Afficher** : uniquement si `timeline?.alerts?.length > 0`.  
**Masquer** : si aucune alerte.

### Bouton "Piloter échéance"
**Afficher** : si `isActive` ET `timeline?.nextDue?.status === 'à_piloter'`.  
**Masquer** : sinon (bail résilié/brouillon, ou prochaine échéance déjà payée/en retard sans action spécifique).

### Bouton "Enregistrer un paiement"
**Afficher** : si `isActive` (bail Actif ou Signé).  
**Masquer** : si bail Brouillon ou Résilié.

### Bouton "Générer quittance"
**Afficher** : si `isActive`.  
**Masquer** : si bail Brouillon ou Résilié.

### Colonne Actions
**Masquer entièrement** : si bail Résilié (aucune action de paiement pertinente).  
**Afficher "Modifier" uniquement** : si bail Brouillon.

---

## 1. LeaseDetailHeader — Version finale

### Hiérarchie visuelle
- **Colonne dominante** : État financier (centre, largeur 1.5x).
- **Statut** : à côté du nom du locataire (même ligne).
- **Bien + période** : secondaires, texte plus petit.

### Structure (ordre des colonnes)
1. Identité (compact)
2. État financier (dominant)
3. Actions

```tsx
// LeaseDetailHeader.tsx — VERSION FINALE
'use client';

import { Badge, Button } from '@/components/ui';
import { Plus, Receipt, Calendar, AlertCircle } from 'lucide-react';
import type { LeaseWithDetails } from '@/lib/services/leasesService';
import type { LeaseFinancialData } from '@/features/leases/hooks/useLeaseFinancialData';
import type { LeasePaymentsTimelineMonth } from '@/features/leases/hooks/useLeasePaymentsTimeline';

const STATUS_MAP: Record<string, { variant: 'success' | 'gray' | 'secondary'; label: string }> = {
  ACTIF: { variant: 'success', label: 'Actif' },
  SIGNE: { variant: 'success', label: 'Signé' },
  BROUILLON: { variant: 'gray', label: 'Brouillon' },
  RÉSILIÉ: { variant: 'secondary', label: 'Résilié' },
  RESILIE: { variant: 'secondary', label: 'Résilié' },
};

const NEXT_DUE_MAP = {
  'à_piloter': { variant: 'warning' as const, label: 'À piloter' },
  'payée': { variant: 'success' as const, label: 'Payée' },
  'en_retard': { variant: 'danger' as const, label: 'En retard' },
};

export interface LeaseDetailHeaderProps {
  lease: LeaseWithDetails;
  financialData: LeaseFinancialData | null;
  timeline: {
    nextDue: { month: LeasePaymentsTimelineMonth; status: 'à_piloter' | 'payée' | 'en_retard' } | null;
    lastPayment: { month: LeasePaymentsTimelineMonth; date: string; amount: number } | null;
    alerts: Array<{ type: string; message: string; actionHref?: string }>;
  } | null;
  onRecordPayment: () => void;
  onGenerateReceipt: () => void;
  onPilotEcheance: () => void;
  onViewLastTransaction: () => void;
  onAlertAction: (alert: { type: string; message: string; actionHref?: string }) => void;
}

export function LeaseDetailHeader({
  lease,
  financialData,
  timeline,
  onRecordPayment,
  onGenerateReceipt,
  onPilotEcheance,
  onViewLastTransaction,
  onAlertAction,
}: LeaseDetailHeaderProps) {
  const statusConfig = STATUS_MAP[lease.status] ?? { variant: 'gray' as const, label: lease.status };
  const isActive = lease.status === 'ACTIF' || lease.status === 'SIGNE' || lease.status === 'ACTIVE' || lease.status === 'SIGNED';
  const isResilie = lease.status === 'RÉSILIÉ' || lease.status === 'RESILIE';
  const showPilotEcheance = isActive && timeline?.nextDue?.status === 'à_piloter';
  const nextDueConfig = timeline?.nextDue ? NEXT_DUE_MAP[timeline.nextDue.status] ?? NEXT_DUE_MAP['à_piloter'] : null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr_1fr] gap-6 lg:gap-8">
        {/* COLONNE 1 : Identité (compact) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900">
              {lease.Tenant?.firstName} {lease.Tenant?.lastName}
            </p>
            <Badge variant={statusConfig.variant} size="sm">
              {statusConfig.label}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            {lease.Property?.name}
          </p>
          <p className="text-xs text-gray-400">
            {formatDateShort(lease.startDate)} → {lease.endDate ? formatDateShort(lease.endDate) : 'En cours'}
          </p>
        </div>

        {/* COLONNE 2 : État financier (dominante) */}
        <div className="flex flex-col gap-5 lg:border-x lg:border-gray-100 lg:px-8">
          <div>
            <p className="text-xs text-gray-500">Montant dû par mois</p>
            <p className="text-3xl font-bold text-gray-900 mt-0.5">
              {formatCurrency(financialData?.totalDueByTenant ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Prochaine échéance</p>
            {timeline?.nextDue ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-900">
                  {formatDueDate(timeline.nextDue.month.dueDate)} · {formatCurrency(timeline.nextDue.month.expected)}
                </span>
                {nextDueConfig && (
                  <Badge variant={nextDueConfig.variant} size="sm">
                    {nextDueConfig.label}
                  </Badge>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Aucune échéance à venir</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Dernier paiement</p>
            {timeline?.lastPayment ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-900">
                  {formatDateShort(timeline.lastPayment.date)} · {formatCurrency(timeline.lastPayment.amount)}
                </span>
                <button
                  type="button"
                  onClick={onViewLastTransaction}
                  className="text-sm font-medium text-orange-600 hover:text-orange-700"
                >
                  Voir
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Aucun paiement</p>
            )}
          </div>
        </div>

        {/* COLONNE 3 : Actions */}
        <div className="flex flex-col gap-2">
          {!isResilie && isActive && (
            <>
              <Button variant="primary" size="md" onClick={onRecordPayment} className="w-full justify-center">
                <Plus className="h-4 w-4 mr-2" />
                Enregistrer un paiement
              </Button>
              <Button variant="outline" size="md" onClick={onGenerateReceipt} className="w-full justify-center">
                <Receipt className="h-4 w-4 mr-2" />
                Générer quittance
              </Button>
              {showPilotEcheance && (
                <Button variant="soft" size="md" onClick={onPilotEcheance} className="w-full justify-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Piloter échéance
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bandeau alertes */}
      {timeline?.alerts && timeline.alerts.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-3 flex-wrap">
            {timeline.alerts.map((alert) => (
              <div
                key={alert.type}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200"
              >
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span className="text-sm text-amber-800">{alert.message}</span>
                <button
                  type="button"
                  onClick={() => onAlertAction(alert)}
                  className="text-sm font-medium text-amber-700 hover:text-amber-900 ml-1"
                >
                  {alert.type === 'retard' ? 'Enregistrer' : 'Voir'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
}
function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' });
}
function formatDueDate(dueDate?: string): string {
  if (!dueDate) return '';
  const d = new Date(dueDate);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}
```

---

## 2. LeaseDetailPaymentsSection — Version finale

### Labels métier (section Paiements)
- "Attendu" → **Montant dû**
- "Réalisé" → **Encaissé**
- Statuts inchangés : Payé, En retard, En attente, À venir

```tsx
// LeaseDetailPaymentsSection.tsx — VERSION FINALE
'use client';

import { Badge, Button } from '@/components/ui';
import { CheckCircle, AlertCircle, Clock, Calendar } from 'lucide-react';
import { useLeasePaymentsTimeline } from '@/features/leases/hooks/useLeasePaymentsTimeline';

const STATUS_CONFIG = {
  payé: {
    label: 'Payé',
    badgeVariant: 'success' as const,
    Icon: CheckCircle,
    iconClass: 'text-green-500',
  },
  en_retard: {
    label: 'En retard',
    badgeVariant: 'danger' as const,
    Icon: AlertCircle,
    iconClass: 'text-red-500',
  },
  en_attente: {
    label: 'En attente',
    badgeVariant: 'warning' as const,
    Icon: Clock,
    iconClass: 'text-amber-500',
  },
  'à_venir': {
    label: 'À venir',
    badgeVariant: 'gray' as const,
    Icon: Calendar,
    iconClass: 'text-gray-400',
  },
} as const;

export interface LeaseDetailPaymentsSectionProps {
  leaseId: string | null;
  propertyId: string | null;
  organizationId: string | null;
  mode?: 'app-shell' | 'normal';
  onViewTransaction: (transactionId: string) => void;
  onRecordPayment: (month: { yearMonth: string; expected: number; dueDate?: string }) => void;
}

export function LeaseDetailPaymentsSection({
  leaseId,
  propertyId,
  organizationId,
  mode = 'app-shell',
  onViewTransaction,
  onRecordPayment,
}: LeaseDetailPaymentsSectionProps) {
  const { months, loading } = useLeasePaymentsTimeline(leaseId, propertyId, organizationId, { mode });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-base font-semibold text-gray-900">Paiements</h3>
        <p className="text-sm text-gray-500 mt-0.5">Suivi des encaissements mois par mois</p>
      </div>

      <div className="divide-y divide-gray-100">
        {loading ? (
          <div className="px-6 py-12 flex justify-center">
            <div className="animate-spin h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full" />
          </div>
        ) : months.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500 text-sm">
            Aucune donnée de paiement
          </div>
        ) : (
          <>
            <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto_1fr_auto] sm:gap-4 px-6 py-3 bg-gray-50/80 border-b border-gray-100 text-xs font-medium uppercase tracking-wider text-gray-500">
              <div>Mois</div>
              <div className="w-24 text-right">Montant dû</div>
              <div className="w-24 text-right">Encaissé</div>
              <div>Statut</div>
              <div className="w-24 text-right">Action</div>
            </div>
            {months.map((month) => {
              const config = STATUS_CONFIG[month.status];
              const Icon = config.Icon;
              return (
                <div
                  key={month.yearMonth}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_1fr_auto] sm:gap-4 gap-2 px-6 py-4 items-center hover:bg-gray-50/50 transition-colors"
                >
                  <div>
                    <span className="font-medium text-gray-900">{month.label}</span>
                  </div>
                  <div className="flex sm:block gap-2 sm:gap-0">
                    <span className="text-xs text-gray-500 sm:hidden">Montant dû </span>
                    <span className="text-sm text-gray-600 sm:text-right sm:w-24 sm:block">
                      {month.expected > 0 ? formatCurrency(month.expected) : '—'}
                    </span>
                  </div>
                  <div className="flex sm:block gap-2 sm:gap-0">
                    <span className="text-xs text-gray-500 sm:hidden">Encaissé </span>
                    <span className={`text-sm font-medium sm:text-right sm:w-24 sm:block ${
                      month.status === 'payé' ? 'text-green-600' :
                      month.status === 'en_retard' ? 'text-red-600' :
                      'text-gray-900'
                    }`}>
                      {month.realized > 0 ? formatCurrency(month.realized) : '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 flex-shrink-0 ${config.iconClass}`} />
                    <Badge variant={config.badgeVariant} size="sm">
                      {config.label}
                    </Badge>
                  </div>
                  <div className="flex justify-end">
                    {month.status === 'payé' && month.transactionIds.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => onViewTransaction(month.transactionIds[0])}
                        className="text-sm font-medium text-orange-600 hover:text-orange-700"
                      >
                        Voir
                      </button>
                    ) : (month.status === 'en_retard' || month.status === 'en_attente') && month.expected > 0 ? (
                      <Button
                        variant="soft"
                        size="sm"
                        onClick={() => onRecordPayment({
                          yearMonth: month.yearMonth,
                          expected: month.expected,
                          dueDate: month.dueDate,
                        })}
                      >
                        Enregistrer
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
}
```

---

## Labels finaux (référence)

| Contexte | Label |
|----------|-------|
| Cockpit — total | Montant dû par mois |
| Cockpit | Prochaine échéance |
| Cockpit | Dernier paiement |
| Cockpit | Aucune échéance à venir |
| Cockpit | Aucun paiement |
| Cockpit | Voir |
| Section Paiements — colonne | Montant dû |
| Section Paiements — colonne | Encaissé |
| Section Paiements | Mois, Statut, Action |
| Statuts | Payé, En retard, En attente, À venir |
| CTA | Enregistrer un paiement, Générer quittance, Piloter échéance, Enregistrer |
