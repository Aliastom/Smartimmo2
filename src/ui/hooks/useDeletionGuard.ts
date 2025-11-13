'use client';

import { useState } from 'react';
import BlockingDialog from '../components/BlockingDialog';
import { BlockingPayload, EntityType, HardBlockerItem, SoftInfoItem, ActionItem } from '../../types/deletion-guard';

interface DeletionGuardState {
  open: boolean;
  payload?: BlockingPayload;
  entityId?: string;
}

// Mappings pour chaque entité
const entityConfigs = {
  Property: {
    label: 'bien',
    hardBlockers: {
      leases: (blockers: any): HardBlockerItem => ({
        label: 'Baux',
        count: blockers.Lease?.total || 0,
        details: `Terminer/supprimer les baux en cours, signés ou à venir${
          blockers.Lease?.active > 0 ? ` (actifs: ${blockers.Lease.active})` : ''
        }${
          blockers.Lease?.signed > 0 ? ` (signés: ${blockers.Lease.signed})` : ''
        }${
          blockers.Lease?.upcoming > 0 ? ` (à venir: ${blockers.Lease.upcoming})` : ''
        }${
          blockers.Lease?.draft > 0 ? ` (brouillons: ${blockers.Lease.draft})` : ''
        }`,
        icon: 'Home'
      }),
      loans: (blockers: any): HardBlockerItem => ({
        label: 'Prêts',
        count: blockers.Loan?.active || 0,
        details: `Clôturer ou supprimer le(s) prêt(s) actif(s) (${blockers.Loan?.active})`,
        icon: 'Landmark'
      })
    },
    softInfo: {
      occupants: (info: any): SoftInfoItem => ({
        label: 'Occupants',
        count: info.occupants || 0,
        icon: 'Users'
      }),
      transactions: (info: any): SoftInfoItem => ({
        label: 'Transactions',
        count: info.Transaction || 0,
        icon: 'Receipt'
      }),
      documents: (info: any): SoftInfoItem => ({
        label: 'Documents',
        count: info.Document || 0,
        icon: 'FileText'
      }),
      photos: (info: any): SoftInfoItem => ({
        label: 'Photos',
        count: info.Photo || 0,
        icon: 'Camera'
      })
    },
    actions: (entityId: string, blockers: any): ActionItem[] => {
      const actions: ActionItem[] = [];
      if (blockers.Lease?.total > 0) {
        actions.push({
          label: 'Voir les baux',
          href: `/biens/${entityId}/leases`,
          icon: 'Home'
        });
      }
      if (blockers.Loan?.active > 0) {
        actions.push({
          label: 'Voir les prêts',
          href: `/biens/${entityId}/loans`,
          icon: 'Landmark'
        });
      }
      return actions;
    }
  },
  Tenant: {
    label: 'locataire',
    hardBlockers: {
      leases: (blockers: any): HardBlockerItem => ({
        label: 'Baux',
        count: blockers.Lease?.total || 0,
        details: `Terminer/supprimer les baux actifs ou signés${
          blockers.Lease?.active > 0 ? ` (actifs: ${blockers.Lease.active})` : ''
        }${
          blockers.Lease?.signed > 0 ? ` (signés: ${blockers.Lease.signed})` : ''
        }`,
        icon: 'Home'
      })
    },
    softInfo: {
      transactions: (info: any): SoftInfoItem => ({
        label: 'Transactions',
        count: info.Transaction || 0,
        icon: 'Receipt'
      }),
      documents: (info: any): SoftInfoItem => ({
        label: 'Documents',
        count: info.Document || 0,
        icon: 'FileText'
      })
    },
    actions: (entityId: string, blockers: any): ActionItem[] => {
      const actions: ActionItem[] = [];
      if (blockers.Lease?.total > 0) {
        actions.push({
          label: 'Voir les baux',
          href: `/locataires/${entityId}/leases`,
          icon: 'Home'
        });
      }
      return actions;
    }
  },
  lease: {
    label: 'bail',
    hardBlockers: {
      payments: (blockers: any): HardBlockerItem => ({
        label: 'Paiements',
        count: blockers.payments?.pending || 0,
        details: `Annuler ou traiter les paiements en cours (${blockers.payments?.pending})`,
        icon: 'CreditCard'
      })
    },
    softInfo: {
      documents: (info: any): SoftInfoItem => ({
        label: 'Documents',
        count: info.Document || 0,
        icon: 'FileText'
      })
    },
    actions: (entityId: string, blockers: any): ActionItem[] => {
      const actions: ActionItem[] = [];
      if (blockers.payments?.pending > 0) {
        actions.push({
          label: 'Voir les paiements',
          href: `/baux/${entityId}/payments`,
          icon: 'CreditCard'
        });
      }
      return actions;
    }
  },
  loan: {
    label: 'prêt',
    hardBlockers: {
      installments: (blockers: any): HardBlockerItem => ({
        label: 'Échéances',
        count: blockers.installments?.remaining || 0,
        details: `Clôturer les échéances restantes (${blockers.installments?.remaining})`,
        icon: 'CreditCard'
      })
    },
    softInfo: {
      documents: (info: any): SoftInfoItem => ({
        label: 'Documents',
        count: info.Document || 0,
        icon: 'FileText'
      })
    },
    actions: (entityId: string, blockers: any): ActionItem[] => {
      const actions: ActionItem[] = [];
      if (blockers.installments?.remaining > 0) {
        actions.push({
          label: 'Voir les échéances',
          href: `/prets/${entityId}/installments`,
          icon: 'CreditCard'
        });
      }
      return actions;
    }
  }
};

export function useDeletionGuard(entity: EntityType) {
  const [state, setState] = useState<DeletionGuardState>({ open: false });

  const openWith = (payload: BlockingPayload, entityId: string) => {
    setState({ open: true, payload, entityId });
  };

  const close = () => {
    setState({ open: false });
  };

  const config = entityConfigs[entity];
  if (!config) {
    console.error(`Unknown entity type: ${entity}`);
    return { openWith, dialog: null };
  }

  const dialog = state.payload && (
    <BlockingDialog
      open={state.open}
      onClose={close}
      entityLabel={config.label}
      hardBlockers={Object.entries(config.hardBlockers)
        .filter(([key, _]) => state.payload!.hardBlockers[key])
        .map(([key, mapper]) => mapper(state.payload!.hardBlockers))
        .filter(item => item.count > 0)
      }
      softInfo={Object.entries(config.softInfo)
        .filter(([key, _]) => state.payload!.softInfo[key] > 0)
        .map(([key, mapper]) => mapper(state.payload!.softInfo))
      }
      actions={config.actions(state.entityId!, state.payload!.hardBlockers)}
    />
  );

  return { openWith, dialog };
}

