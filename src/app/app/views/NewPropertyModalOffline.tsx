'use client';

/**
 * Modal "Nouveau bien" pour l'App Shell Offline
 * 
 * Utilise PropertyForm mais la soumission passe par le repository offline-first
 * Aucune redirection après création, juste un refresh local
 */

import React, { useState, useEffect } from 'react';
import PropertyForm from '@/components/forms/PropertyForm';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { getLocalDB } from '@/lib/offline/db';
import { useAlert } from '@/hooks/useAlert';

interface NewPropertyModalOfflineProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  organizationId: string;
}

export function NewPropertyModalOffline({ 
  isOpen, 
  onClose, 
  onSuccess,
  organizationId 
}: NewPropertyModalOfflineProps) {
  const { showAlert } = useAlert();

  const handleSubmit = async (data: any) => {
    try {
      const repo = getPropertyRepositoryOffline();
      
      // Créer le bien dans IndexedDB
      // Ne pas ajouter statusMode ici car il n'est pas dans le schéma Zod de l'API
      // Le repository offline l'ajoutera automatiquement pour le stockage local
      const localProperty = await repo.upsert({
        ...data,
        organizationId,
        occupation: data.occupation || 'VACANT',
        status: data.status || 'vacant',
        // statusMode sera ajouté automatiquement par le repository pour le stockage local
      }, organizationId);

      console.log('[NewPropertyModalOffline] Bien créé localement avec ID:', localProperty.id);

      // Afficher un message de succès
      await showAlert({
        type: 'success',
        title: 'Bien créé',
        message: 'Le bien a été créé localement et sera synchronisé avec le serveur dès que la connexion sera rétablie.',
      });

      // Appeler le callback de succès pour rafraîchir la liste
      onSuccess();
    } catch (error: any) {
      console.error('[NewPropertyModalOffline] Erreur création:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: error.message || 'Une erreur est survenue lors de la création du bien.',
      });
      throw error; // Re-throw pour que PropertyForm puisse gérer l'état de soumission
    }
  };

  return (
    <PropertyForm
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Nouveau Bien"
    />
  );
}
