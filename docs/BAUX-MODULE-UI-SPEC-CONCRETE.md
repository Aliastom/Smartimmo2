# Module BAUX — Spécification UI concrète (Cockpit & Paiements)

> Layout visuel précis, pseudo-JSX, structure réelle.
> Style : Finary / Qonto / Notion (épuré, moderne, cards).

---

## 1. LeaseDetailHeader — Cockpit

### 1.1 Structure visuelle (3 colonnes)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ┌──────────────────┐  ┌─────────────────────────────┐  ┌──────────────────────────┐ │
│ │ IDENTITÉ         │  │ ÉTAT FINANCIER              │  │ ACTIONS                  │ │
│ │                  │  │                             │  │                          │ │
│ │ Jean Dupont      │  │ 870 € / mois                │  │ [Enregistrer paiement]   │ │
│ │ T3 Avenue X      │  │                             │  │ [Générer quittance]      │ │
│ │ ● Actif          │  │ Prochaine échéance          │  │ [Piloter échéance]       │ │
│ │ 01/01/24 → …     │  │ 5 mars · 870 € · À piloter  │  │ (si contexte)            │ │
│ │                  │  │                             │  │                          │ │
│ │                  │  │ Dernier paiement            │  │                          │ │
│ │                  │  │ 12 fév. · 870 € · Voir →    │  │                          │ │
│ └──────────────────┘  └─────────────────────────────┘  └──────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ ⚠️ Alerte : Loyer février en retard · [Enregistrer]                                 │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 JSX concret — LeaseDetailHeader

```tsx
// LeaseDetailHeader.tsx
// Imports: Badge, Button from @/components/ui ; Plus, Receipt, Calendar, AlertCircle from lucide-react

// Props
interface LeaseDetailHeaderProps {
  lease: LeaseWithDetails;
  financialData: LeaseFinancialData | null;
  timeline: {
    nextDue: { month: LeasePaymentsTimelineMonth; status: 'à_piloter' | 'payée' | 'en_retard' } | null;
    lastPayment: { month: LeasePaymentsTimelineMonth; date: string; amount: number } | null;
    alerts: Array<{ type: string; message: string; actionHref?: string }>;
  } | null;
  isActive: boolean;
  onRecordPayment: () => void;
  onGenerateReceipt: () => void;
  onPilotEcheance: () => void;
  onViewLastTransaction: () => void;
  onAlertAction: (alert: any) => void;
}

// Mapping lease.status → Badge
const STATUS_MAP: Record<string, { variant: BadgeVariant; label: string }> = {
  ACTIF: { variant: 'success', label: 'Actif' },
  BROUILLON: { variant: 'gray', label: 'Brouillon' },
  RÉSILIÉ: { variant: 'secondary', label: 'Résilié' },
  // ...
};
const { variant: statusVariant, label: statusLabel } = STATUS_MAP[lease.status] ?? { variant: 'gray', label: lease.status };

// Mapping nextDue.status → Badge
const NEXT_DUE_MAP = {
  'à_piloter': { variant: 'warning' as const, label: 'À piloter' },
  'payée': { variant: 'success' as const, label: 'Payée' },
  'en_retard': { variant: 'danger' as const, label: 'En retard' },
};
const { variant: nextDueBadgeVariant, label: nextDueLabel } =
  timeline?.nextDue ? NEXT_DUE_MAP[timeline.nextDue.status] ?? NEXT_DUE_MAP['à_piloter'] : { variant: 'gray', label: '' };

return (
<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
  {/* Ligne principale : 3 colonnes */}
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
    
    {/* COLONNE 1 : Identité */}
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Bail</p>
      <div>
        <p className="font-semibold text-gray-900">
          {lease.Tenant.firstName} {lease.Tenant.lastName}
        </p>
        <p className="text-sm text-gray-500 mt-0.5">
          {lease.Property.name}
        </p>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <Badge variant={statusVariant} size="sm">
          {statusLabel}
        </Badge>
      </div>
      <p className="text-xs text-gray-500">
        {formatDate(lease.startDate)} → {lease.endDate ? formatDate(lease.endDate) : 'En cours'}
      </p>
    </div>
    
    {/* COLONNE 2 : État financier */}
    <div className="flex flex-col gap-4 lg:border-x lg:border-gray-100 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">État</p>
      
      {/* Total mensuel */}
      <div>
        <p className="text-xs text-gray-500">Total mensuel</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">
          {formatCurrency(financialData?.totalDueByTenant ?? 0)}
        </p>
      </div>
      
      {/* Prochaine échéance */}
      <div>
        <p className="text-xs text-gray-500 mb-1">Prochaine échéance</p>
        {timeline?.nextDue ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900">
              {formatDueDate(timeline.nextDue.month.dueDate)} · {formatCurrency(timeline.nextDue.month.expected)}
            </span>
            <Badge variant={nextDueBadgeVariant} size="sm">
              {nextDueLabel}
            </Badge>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Aucune échéance à venir</p>
        )}
      </div>
      
      {/* Dernier paiement */}
      <div>
        <p className="text-xs text-gray-500 mb-1">Dernier paiement</p>
        {timeline?.lastPayment ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-gray-900">
              {formatDate(timeline.lastPayment.date)} · {formatCurrency(timeline.lastPayment.amount)}
            </span>
            <button
              type="button"
              onClick={onViewLastTransaction}
              className="text-sm font-medium text-orange-600 hover:text-orange-700"
            >
              Voir →
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Aucun paiement</p>
        )}
      </div>
    </div>
    
    {/* COLONNE 3 : Actions primaires */}
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Actions</p>
      <div className="flex flex-col gap-2">
        {isActive && (
          <>
            <Button variant="primary" size="md" onClick={onRecordPayment}>
              <Plus className="h-4 w-4 mr-2" />
              Enregistrer un paiement
            </Button>
            <Button variant="outline" size="md" onClick={onGenerateReceipt}>
              <Receipt className="h-4 w-4 mr-2" />
              Générer quittance
            </Button>
            {timeline?.nextDue?.status === 'à_piloter' && (
              <Button variant="soft" size="md" onClick={onPilotEcheance}>
                <Calendar className="h-4 w-4 mr-2" />
                Piloter échéance
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  </div>
  
  {/* Bandeau alertes (conditionnel) */}
  {timeline?.alerts && timeline.alerts.length > 0 && (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <div className="flex items-center gap-4 flex-wrap">
        {timeline.alerts.map((alert) => (
          <div
            key={alert.type}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200"
          >
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span className="text-sm text-amber-800">{alert.message}</span>
            {alert.actionHref && (
              <button
                type="button"
                onClick={() => onAlertAction(alert)}
                className="text-sm font-medium text-amber-700 hover:text-amber-900"
              >
                {alert.type === 'retard' ? 'Enregistrer' : 'Voir'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )}
</div>
);
```

### 1.3 Labels exacts

| Élément | Label |
|---------|-------|
| Titre colonne 1 | `Bail` |
| Titre colonne 2 | `État` |
| Titre colonne 3 | `Actions` |
| Total mensuel | `Total mensuel` |
| Prochaine échéance | `Prochaine échéance` |
| Dernier paiement | `Dernier paiement` |
| Aucune échéance | `Aucune échéance à venir` |
| Aucun paiement | `Aucun paiement` |
| CTA paiement | `Enregistrer un paiement` |
| CTA quittance | `Générer quittance` |
| CTA piloter | `Piloter échéance` |
| Lien voir | `Voir →` |

### 1.4 Badges statut (nextDue)

| status | Badge variant | Label |
|--------|---------------|-------|
| à_piloter | `warning` | À piloter |
| payée | `success` | Payée |
| en_retard | `danger` | En retard |

---

## 2. LeaseDetailPaymentsSection — Timeline mensuelle

### 2.1 Structure visuelle

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Paiements                                                                           │
│ Suivi des encaissements mois par mois                                               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ Mois        │ Attendu   │ Réalisé    │ Statut      │ Action                        │
├─────────────┼───────────┼────────────┼─────────────┼───────────────────────────────┤
│ Janv. 2025  │ 870,00 €  │ 870,00 €   │ [● Payé]    │ Voir                          │
│ Fév. 2025   │ 870,00 €  │ —          │ [● En retard]│ Enregistrer                   │
│ Mars 2025   │ 870,00 €  │ —          │ [○ En attente]│ Enregistrer                   │
│ Avr. 2025   │ 870,00 €  │ —          │ [○ À venir] │                               │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 JSX concret — LeaseDetailPaymentsSection

```tsx
// LeaseDetailPaymentsSection.tsx
// Hook: const { months, loading } = useLeasePaymentsTimeline(leaseId, propertyId, orgId, { mode });

<div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
  {/* En-tête */}
  <div className="px-6 py-4 border-b border-gray-100">
    <h3 className="text-base font-semibold text-gray-900">Paiements</h3>
    <p className="text-sm text-gray-500 mt-0.5">Suivi des encaissements mois par mois</p>
  </div>
  
  {/* Contenu */}
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
        {/* En-tête tableau (masqué sur mobile) */}
        <div className="hidden sm:flex px-6 py-3 bg-gray-50/80 border-b border-gray-100 text-xs font-medium uppercase tracking-wider text-gray-500">
          <div className="w-24 flex-shrink-0">Mois</div>
          <div className="w-24 flex-shrink-0">Attendu</div>
          <div className="w-24 flex-shrink-0">Réalisé</div>
          <div className="flex-1">Statut</div>
          <div className="w-28 flex-shrink-0 text-right">Action</div>
        </div>
        {months.map((month) => (
        <div
          key={month.yearMonth}
          className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors"
        >
          {/* Mois */}
          <div className="w-24 flex-shrink-0">
            <span className="font-medium text-gray-900">{month.label}</span>
          </div>
          
          {/* Attendu */}
          <div className="w-24 flex-shrink-0">
            <span className="text-sm text-gray-600">
              {month.expected > 0 ? formatCurrency(month.expected) : '—'}
            </span>
          </div>
          
          {/* Réalisé */}
          <div className="w-24 flex-shrink-0">
            <span className={`text-sm font-medium ${
              month.status === 'payé' ? 'text-green-600' :
              month.status === 'en_retard' ? 'text-red-600' :
              'text-gray-900'
            }`}>
              {month.realized > 0 ? formatCurrency(month.realized) : '—'}
            </span>
          </div>
          
          {/* Statut (badge + icône) */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {STATUS_CONFIG[month.status].icon}
              <Badge variant={STATUS_CONFIG[month.status].badgeVariant} size="sm">
                {STATUS_CONFIG[month.status].label}
              </Badge>
            </div>
          </div>
          
          {/* Action */}
          <div className="w-28 flex-shrink-0 text-right">
            {month.status === 'payé' && month.transactionIds.length > 0 && (
              <button
                type="button"
                onClick={() => onViewTransaction(month.transactionIds[0])}
                className="text-sm font-medium text-orange-600 hover:text-orange-700"
              >
                Voir
              </button>
            )}
            {(month.status === 'en_retard' || month.status === 'en_attente') && month.expected > 0 && (
              <Button variant="soft" size="sm" onClick={() => onRecordPayment(month)}>
                Enregistrer
              </Button>
            )}
          </div>
        </div>
      ))}
      </>
    )}
  </div>
</div>
```

### 2.3 Mapping statut → badge + icône

```tsx
// Constante à définir
const STATUS_CONFIG = {
  payé: {
    label: 'Payé',
    badgeVariant: 'success',
    icon: <CheckCircle className="h-4 w-4 text-green-500" />,
  },
  en_retard: {
    label: 'En retard',
    badgeVariant: 'danger',
    icon: <AlertCircle className="h-4 w-4 text-red-500" />,
  },
  en_attente: {
    label: 'En attente',
    badgeVariant: 'warning',
    icon: <Clock className="h-4 w-4 text-amber-500" />,
  },
  'à_venir': {
    label: 'À venir',
    badgeVariant: 'gray',
    icon: <Calendar className="h-4 w-4 text-gray-400" />,
  },
} as const;
```

### 2.4 Informations par ligne (ordre)

| Colonne | Contenu | Largeur | Alignement |
|---------|---------|---------|------------|
| Mois | `month.label` (ex. "Mars 2025") | 24 (w-24) | gauche |
| Attendu | `formatCurrency(month.expected)` ou "—" | 24 | gauche |
| Réalisé | `formatCurrency(month.realized)` ou "—" | 24 | gauche |
| Statut | Icône + Badge | flex-1 | gauche |
| Action | "Voir" ou "Enregistrer" | 28 | droite |

### 2.5 Interactions par statut

| status | Action affichée | Comportement |
|--------|-----------------|--------------|
| payé | Lien "Voir" | Ouvre détail transaction (ou modal) |
| en_retard | Bouton "Enregistrer" | Ouvre TransactionModal pré-rempli (mois, montant) |
| en_attente | Bouton "Enregistrer" | Idem |
| à_venir | (aucune) | Pas d'action |

---

## 3. Variante mobile (responsive)

### 3.1 Cockpit mobile

Sur mobile, les 3 colonnes deviennent 3 blocs empilés verticalement :

```tsx
<div className="flex flex-col gap-6">
  {/* Identité */}
  <div>...</div>
  <div className="border-t border-gray-100 pt-6">...</div>
  {/* État */}
  <div className="border-t border-gray-100 pt-6">...</div>
  {/* Actions */}
  <div className="border-t border-gray-100 pt-6">...</div>
</div>
```

Ou utiliser `grid-cols-1 lg:grid-cols-3` (déjà prévu dans le JSX).

### 3.2 Paiements mobile

Sur mobile, chaque ligne peut devenir une carte compacte :

```tsx
// Variante mobile : carte par mois
<div className="p-4 flex flex-col gap-3 sm:hidden">
  {months.map((month) => (
    <div key={month.yearMonth} className="rounded-xl border border-gray-200 p-4">
      <div className="flex justify-between items-start">
        <span className="font-medium">{month.label}</span>
        <Badge variant={...} size="sm">{...}</Badge>
      </div>
      <div className="mt-2 flex justify-between text-sm text-gray-600">
        <span>Attendu {formatCurrency(month.expected)}</span>
        <span className={...}>Réalisé {formatCurrency(month.realized) || '—'}</span>
      </div>
      <div className="mt-3">
        <Button size="sm" variant="soft">Enregistrer</Button>
      </div>
    </div>
  ))}
</div>
```

---

## 4. Utilitaires requis

```tsx
// formatCurrency(amount: number): string
// "870,00 €"

// formatDate(isoDate: string): string  
// "12 fév. 2025" ou "12/02/2025"

// formatDueDate(dueDate?: string): string
// "5 mars" (jour + mois court)
```

---

## 5. Ordre d'affichage dans LeaseDetailView

```tsx
<div className="flex flex-col gap-6 p-6">
  {/* 1. Cockpit */}
  <LeaseDetailHeader ... />
  
  {/* 2. Paiements */}
  <LeaseDetailPaymentsSection ... />
  
  {/* 3. Configuration financière */}
  <LeaseDetailFinancialConfigSection ... />
  
  {/* 4. Contrat */}
  <LeaseDetailContractSection ... />
  
  {/* 5. Documents */}
  <LeaseDetailDocumentsSection ... />
</div>
```
