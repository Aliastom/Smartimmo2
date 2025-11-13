'use client';

import React from 'react';
import { AppModal, ModalAction } from './AppModal';

// Helper pour créer des actions de modal rapidement
export const createModalActions = {
  save: (onSave: () => void, loading = false, disabled = false): ModalAction => ({
    label: loading ? 'Enregistrement...' : 'Enregistrer',
    onClick: onSave,
    variant: 'primary',
    loading,
    disabled,
  }),

  cancel: (onCancel: () => void, disabled = false): ModalAction => ({
    label: 'Annuler',
    onClick: onCancel,
    variant: 'outline',
    disabled,
  }),

  delete: (onDelete: () => void, loading = false, disabled = false): ModalAction => ({
    label: loading ? 'Suppression...' : 'Supprimer',
    onClick: onDelete,
    variant: 'primary',
    loading,
    disabled,
  }),

  close: (onClose: () => void, disabled = false): ModalAction => ({
    label: 'Fermer',
    onClick: onClose,
    variant: 'ghost',
    disabled,
  }),

  confirm: (onConfirm: () => void, loading = false, disabled = false): ModalAction => ({
    label: loading ? 'Confirmation...' : 'Confirmer',
    onClick: onConfirm,
    variant: 'primary',
    loading,
    disabled,
  }),
};

// Helper pour les tailles courantes
export const modalSizes = {
  small: 'sm' as const,
  medium: 'md' as const,
  large: 'lg' as const,
  extraLarge: 'xl' as const,
  doubleExtraLarge: '2xl' as const,
  tripleExtraLarge: '3xl' as const,
};

// Composant wrapper pour les modales de confirmation
export interface ConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export function ConfirmationModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'info',
  loading = false,
}: ConfirmationModalProps) {
  const variantClass = {
    danger: 'text-error',
    warning: 'text-warning',
    info: 'text-info',
  }[variant];

  const confirmVariant = variant === 'danger' ? 'primary' : 'primary';

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      primaryAction={{
        label: loading ? 'Confirmation...' : confirmLabel,
        onClick: onConfirm,
        variant: confirmVariant,
        loading,
      }}
      secondaryAction={{
        label: cancelLabel,
        onClick: onClose,
        variant: 'outline',
        disabled: loading,
      }}
    >
      <div className="space-y-4">
        <p className={`${variantClass}`}>
          {message}
        </p>
      </div>
    </AppModal>
  );
}

// Composant wrapper pour les modales d'information
export interface InfoModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonLabel?: string;
}

export function InfoModal({
  open,
  onClose,
  title,
  message,
  buttonLabel = 'OK',
}: InfoModalProps) {
  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      primaryAction={{
        label: buttonLabel,
        onClick: onClose,
        variant: 'primary',
      }}
    >
      <div className="space-y-4">
        <p>{message}</p>
      </div>
    </AppModal>
  );
}

// Hook pour gérer l'état d'une modal
export function useModal(initialOpen = false) {
  const [open, setOpen] = React.useState(initialOpen);

  const openModal = React.useCallback(() => setOpen(true), []);
  const closeModal = React.useCallback(() => setOpen(false), []);
  const toggleModal = React.useCallback(() => setOpen(prev => !prev), []);

  return {
    open,
    openModal,
    closeModal,
    toggleModal,
  };
}

// Hook pour gérer plusieurs modales
export function useModals() {
  const [modals, setModals] = React.useState<Record<string, boolean>>({});

  const openModal = React.useCallback((modalId: string) => {
    setModals(prev => ({ ...prev, [modalId]: true }));
  }, []);

  const closeModal = React.useCallback((modalId: string) => {
    setModals(prev => ({ ...prev, [modalId]: false }));
  }, []);

  const toggleModal = React.useCallback((modalId: string) => {
    setModals(prev => ({ ...prev, [modalId]: !prev[modalId] }));
  }, []);

  const isOpen = React.useCallback((modalId: string) => {
    return modals[modalId] || false;
  }, [modals]);

  const closeAll = React.useCallback(() => {
    setModals({});
  }, []);

  return {
    modals,
    openModal,
    closeModal,
    toggleModal,
    isOpen,
    closeAll,
  };
}
