'use client';

/**
 * CompanionActions - Actions rapides contextuelles
 * Affiche 3 actions max selon la page courante
 */

import React from 'react';
import { FileText, Home, PlusCircle, Filter, HelpCircle, FileSearch } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCompanion } from './CompanionProvider';
import { goTo, openModal, openHelp } from './actions';
import type { CompanionAction } from './types';

export function CompanionActions() {
  const { route } = useCompanion();

  // Déterminer les actions selon la route
  const actions = getActionsForRoute(route);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="p-4 border-b">
      <p className="text-xs text-muted-foreground mb-3">Actions rapides</p>
      <div className="flex flex-col gap-2">
        {actions.map((action) => (
          <Button
            key={action.id}
            variant="outline"
            size="sm"
            onClick={action.execute}
            className="justify-start"
            disabled={action.available === false}
          >
            {action.icon && <span className="mr-2">{action.icon}</span>}
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * Retourne les actions contextuelles selon la route
 */
function getActionsForRoute(route: string): CompanionAction[] {
  // Page Baux
  if (route.includes('/baux')) {
    return [
      {
        id: 'create-lease',
        label: 'Créer un bail',
        icon: <PlusCircle className="h-4 w-4" />,
        type: 'openModal',
        execute: () => openModal('CreateLease'),
        description: 'Ouvrir le formulaire de création de bail',
      },
      {
        id: 'guide-baux',
        label: 'Guide des baux',
        icon: <FileText className="h-4 w-4" />,
        type: 'help',
        execute: () => {
          // Scroll vers la question sur les baux
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        description: 'Consulter le guide des baux',
      },
      {
        id: 'filter-active',
        label: 'Filtrer baux actifs',
        icon: <Filter className="h-4 w-4" />,
        type: 'filter',
        execute: () => goTo('/baux?status=active'),
        description: 'Afficher uniquement les baux actifs',
      },
    ];
  }

  // Page Transactions
  if (route.includes('/transactions')) {
    return [
      {
        id: 'create-transaction',
        label: 'Nouvelle transaction',
        icon: <PlusCircle className="h-4 w-4" />,
        type: 'openModal',
        execute: () => openModal('CreateTransaction'),
        description: 'Enregistrer une transaction',
      },
      {
        id: 'guide-transactions',
        label: 'Guide transactions',
        icon: <FileText className="h-4 w-4" />,
        type: 'help',
        execute: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
        description: 'Consulter le guide des transactions',
      },
      {
        id: 'rapprochement',
        label: 'Rapprochement bancaire',
        icon: <FileSearch className="h-4 w-4" />,
        type: 'custom',
        execute: () => goTo('/transactions?view=rapprochement'),
        description: 'Accéder au rapprochement bancaire',
      },
    ];
  }

  // Page Biens
  if (route.includes('/biens')) {
    return [
      {
        id: 'create-property',
        label: 'Ajouter un bien',
        icon: <PlusCircle className="h-4 w-4" />,
        type: 'openModal',
        execute: () => openModal('CreateProperty'),
        description: 'Créer une nouvelle propriété',
      },
      {
        id: 'onboarding',
        label: 'Guide de démarrage',
        icon: <HelpCircle className="h-4 w-4" />,
        type: 'help',
        execute: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
        description: 'Consulter le guide de démarrage',
      },
      {
        id: 'dashboard',
        label: 'Tableau de bord',
        icon: <Home className="h-4 w-4" />,
        type: 'navigate',
        execute: () => goTo('/dashboard'),
        description: 'Accéder au tableau de bord',
      },
    ];
  }

  // Page Documents
  if (route.includes('/documents')) {
    return [
      {
        id: 'upload-document',
        label: 'Uploader un document',
        icon: <PlusCircle className="h-4 w-4" />,
        type: 'openModal',
        execute: () => openModal('UploadDocument'),
        description: 'Téléverser un nouveau document',
      },
      {
        id: 'guide-documents',
        label: 'Aide documents',
        icon: <FileText className="h-4 w-4" />,
        type: 'help',
        execute: () => openHelp('documents'),
        description: 'Consulter l\'aide sur les documents',
      },
    ];
  }

  // Dashboard (page par défaut)
  if (route === '/' || route === '/dashboard') {
    return [
      {
        id: 'onboarding',
        label: 'Guide de démarrage',
        icon: <HelpCircle className="h-4 w-4" />,
        type: 'help',
        execute: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
        description: 'Consulter le guide de démarrage',
      },
      {
        id: 'create-property',
        label: 'Ajouter un bien',
        icon: <PlusCircle className="h-4 w-4" />,
        type: 'openModal',
        execute: () => goTo('/biens'),
        description: 'Créer une nouvelle propriété',
      },
      {
        id: 'create-lease',
        label: 'Créer un bail',
        icon: <PlusCircle className="h-4 w-4" />,
        type: 'openModal',
        execute: () => goTo('/baux'),
        description: 'Créer un nouveau bail',
      },
    ];
  }

  // Aucune action par défaut
  return [];
}

