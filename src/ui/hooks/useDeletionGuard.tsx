'use client';

import { useState } from 'react';
import BlockingDialog from '../components/BlockingDialog';
import { BlockingPayload, EntityType, ActionItem } from '../../types/deletion-guard';
import { useGuardTranslations } from '../../hooks/useGuardTranslations';

interface DeletionGuardState {
  open: boolean;
  payload?: BlockingPayload;
  entityId?: string;
}

// Mapping des types vers les icônes
const iconMap: Record<string, string> = {
  leases: 'Home',
  loans: 'Landmark',
  installments: 'CreditCard',
  payments: 'CreditCard',
  occupants: 'Users',
  transactions: 'Receipt',
  documents: 'FileText',
  photos: 'Camera'
};

// Mapping des actions par entité et type de blocker
const createActionsMap = (t: ReturnType<typeof useGuardTranslations>): Record<EntityType, (entityId: string, payload: BlockingPayload) => ActionItem[]> => ({
  property: (entityId, payload) => {
    const actions: ActionItem[] = [];
    if (payload.hardBlockers.some(b => b.type === 'leases')) {
      actions.push({ label: t.actions.seeLeases, href: `/biens/${entityId}/leases`, icon: 'Home' });
    }
    if (payload.hardBlockers.some(b => b.type === 'loans')) {
      actions.push({ label: t.actions.seeLoans, href: `/biens/${entityId}/loans`, icon: 'Landmark' });
    }
    return actions;
  },
  tenant: (entityId, payload) => {
    const actions: ActionItem[] = [];
    if (payload.hardBlockers.some(b => b.type === 'leases')) {
      // Pour un tenant, on va vers la liste des baux avec filtre tenant
      actions.push({ label: t.actions.seeLeases, href: `/baux?tenantId=${entityId}`, icon: 'Home' });
    }
    return actions;
  },
  lease: (entityId, payload) => {
    const actions: ActionItem[] = [];
    if (payload.hardBlockers.some(b => b.type === 'payments')) {
      // Pour un bail, on va vers la liste des transactions avec filtre lease
      actions.push({ label: t.actions.seePayments, href: `/transactions?leaseId=${entityId}`, icon: 'CreditCard' });
    }
    return actions;
  },
  loan: (entityId, payload) => {
    const actions: ActionItem[] = [];
    if (payload.hardBlockers.some(b => b.type === 'installments')) {
      // Pour un prêt, on va vers la page des prêts avec filtre
      actions.push({ label: t.actions.seeInstallments, href: `/loans?loanId=${entityId}`, icon: 'CreditCard' });
    }
    return actions;
  }
});

export function useDeletionGuard(entity: EntityType) {
  const [state, setState] = useState<DeletionGuardState>({ open: false });
  const t = useGuardTranslations();

  const openWith = (payload: BlockingPayload, entityId: string) => {
    console.log('useDeletionGuard.openWith called with:', { payload, entityId });
    setState({ open: true, payload, entityId });
  };

  const close = () => {
    setState({ open: false });
  };

  // Ajouter les icônes aux items si pas déjà présentes
  const enrichedPayload = state.payload ? {
    ...state.payload,
    hardBlockers: state.payload.hardBlockers.map(b => ({
      ...b,
      icon: iconMap[b.type] || 'AlertTriangle'
    })),
    softInfo: state.payload.softInfo.map(s => ({
      ...s,
      icon: iconMap[s.type] || 'Info'
    }))
  } : null;

  const actionsMap = createActionsMap(t);

  const dialog = enrichedPayload && (
    <BlockingDialog
      open={state.open}
      onClose={close}
      hardBlockers={enrichedPayload.hardBlockers}
      softInfo={enrichedPayload.softInfo}
      actions={actionsMap[entity](state.entityId!, state.payload!)}
    />
  );

  return { openWith, close, dialog };
}
