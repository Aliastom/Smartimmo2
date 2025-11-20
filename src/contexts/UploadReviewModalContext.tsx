'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, Suspense } from 'react';
import { notify2 } from '@/lib/notify2';
import { MobileUploadOptions } from '@/components/documents/MobileUploadOptions';

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
  const [showMobileUploadModal, setShowMobileUploadModal] = useState(false);
  const [pendingConfig, setPendingConfig] = useState<UploadReviewModalConfig>({});

  // Ouvrir la modal avec des fichiers et une configuration
  const openModal = useCallback((files: File[], config: UploadReviewModalConfig = {}) => {
    console.log('[UploadReviewModalContext] openModal called with:', {
      filesCount: files.length,
      filesNames: files.map(f => f.name),
      config
    });
    
    setModalState({
      isOpen: true,
      files,
      config
    });
    
    console.log('[UploadReviewModalContext] Modal state updated, isOpen: true');
  }, []);

  // Détecter si on est sur mobile
  const isMobile = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }, []);

  // Ouvrir la modal avec sélection de fichier
  const openModalWithFileSelection = useCallback((config: UploadReviewModalConfig = {}) => {
    console.log('[UploadReviewModalContext] openModalWithFileSelection called');
    notify2.info('📤 Ouverture de la sélection...');
    
    // Sur mobile, ouvrir une modal intermédiaire avec MobileUploadOptions
    if (isMobile()) {
      console.log('[UploadReviewModalContext] Mobile détecté, ouverture de la modal mobile');
      setPendingConfig(config);
      setShowMobileUploadModal(true);
      return;
    }
    
    // Sur desktop, utiliser l'input file classique
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';
    input.multiple = true;
    
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) {
        console.log('[UploadReviewModalContext] Files selected on desktop:', files.length);
        openModal(files, config);
      }
    };
    
    input.click();
  }, [openModal, isMobile]);

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

  // Handler pour les fichiers sélectionnés depuis la modal mobile
  const handleMobileFilesSelected = useCallback((files: File[]) => {
    console.log('[UploadReviewModalContext] handleMobileFilesSelected called with:', files.length, 'files');
    if (files.length > 0) {
      setShowMobileUploadModal(false);
      openModal(files, pendingConfig);
      setPendingConfig({});
    }
  }, [openModal, pendingConfig]);

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
      {/* Modal mobile pour sélection de fichiers */}
      {showMobileUploadModal && (
        <MobileUploadModal
          isOpen={showMobileUploadModal}
          onClose={() => {
            setShowMobileUploadModal(false);
            setPendingConfig({});
          }}
          onFilesSelected={handleMobileFilesSelected}
        />
      )}
    </UploadReviewModalContext.Provider>
  );
}

// Modal mobile pour sélection de fichiers
function MobileUploadModal({
  isOpen,
  onClose,
  onFilesSelected
}: {
  isOpen: boolean;
  onClose: () => void;
  onFilesSelected: (files: File[]) => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 md:hidden">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Sélectionner un fichier</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        <div className="space-y-3">
          <Suspense fallback={<div className="p-4 text-center text-gray-500">Chargement...</div>}>
            <MobileUploadOptions
              onFilesSelected={onFilesSelected}
              acceptedTypes={['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
              maxFiles={10}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export function useUploadReviewModal() {
  const context = useContext(UploadReviewModalContext);
  if (context === undefined) {
    throw new Error('useUploadReviewModal must be used within an UploadReviewModalProvider');
  }
  return context;
}

