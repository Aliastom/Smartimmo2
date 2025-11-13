'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface UploadReviewModalConfig {
  // Contexte de liaison automatique
  autoLinkingContext?: {
    leaseId?: string;
    propertyId?: string;
    tenantsIds?: string[];
    transactionId?: string;
  };
  
  // Type de document pré-rempli
  autoLinkingDocumentType?: string;
  
  // Scope de l'upload
  scope?: 'global' | 'property';
  
  // IDs contextuels
  propertyId?: string;
  leaseId?: string;
  tenantId?: string;
  
  // Callbacks
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export interface UploadReviewModalState {
  isOpen: boolean;
  files: File[];
  config: UploadReviewModalConfig;
}

interface UploadReviewModalContextType {
  // État de la modal
  isOpen: boolean;
  files: File[];
  config: UploadReviewModalConfig;
  
  // Actions
  openModal: (files: File[], config?: UploadReviewModalConfig) => void;
  openModalWithFileSelection: (config?: UploadReviewModalConfig) => void;
  openModalWithDocumentType: (
    documentTypeCode: string, 
    documentTypeLabel: string,
    config?: UploadReviewModalConfig
  ) => void;
  closeModal: () => void;
  handleSuccess: () => void;
  handleError: (error: string) => void;
}

const UploadReviewModalContext = createContext<UploadReviewModalContextType | undefined>(undefined);

export function UploadReviewModalProvider({ children }: { children: ReactNode }) {
  const [modalState, setModalState] = useState<UploadReviewModalState>({
    isOpen: false,
    files: [],
    config: {}
  });

  // Ouvrir la modal avec des fichiers et une configuration
  const openModal = useCallback((files: File[], config: UploadReviewModalConfig = {}) => {
    setModalState({
      isOpen: true,
      files,
      config
    });
  }, []);

  // Ouvrir la modal avec sélection de fichier
  const openModalWithFileSelection = useCallback((config: UploadReviewModalConfig = {}) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';
    input.multiple = true;
    
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) {
        openModal(files, config);
      }
    };
    
    input.click();
  }, [openModal]);

  // Ouvrir la modal avec un type de document spécifique
  const openModalWithDocumentType = useCallback((
    documentTypeCode: string, 
    documentTypeLabel: string,
    config: UploadReviewModalConfig = {}
  ) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';
    input.multiple = false;
    
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) {
        openModal(files, {
          ...config,
          autoLinkingDocumentType: documentTypeCode
        });
      }
    };
    
    input.click();
  }, [openModal]);

  // Fermer la modal
  const closeModal = useCallback(() => {
    setModalState({
      isOpen: false,
      files: [],
      config: {}
    });
  }, []);

  // Gérer le succès de l'upload
  const handleSuccess = useCallback(() => {
    modalState.config.onSuccess?.();
    closeModal();
  }, [modalState.config, closeModal]);

  // Gérer l'erreur de l'upload
  const handleError = useCallback((error: string) => {
    modalState.config.onError?.(error);
    closeModal();
  }, [modalState.config, closeModal]);

  const value: UploadReviewModalContextType = {
    // État de la modal
    isOpen: modalState.isOpen,
    files: modalState.files,
    config: modalState.config,
    
    // Actions
    openModal,
    openModalWithFileSelection,
    openModalWithDocumentType,
    closeModal,
    handleSuccess,
    handleError
  };

  return (
    <UploadReviewModalContext.Provider value={value}>
      {children}
    </UploadReviewModalContext.Provider>
  );
}

export function useUploadReviewModal() {
  const context = useContext(UploadReviewModalContext);
  if (context === undefined) {
    throw new Error('useUploadReviewModal must be used within an UploadReviewModalProvider');
  }
  return context;
}

