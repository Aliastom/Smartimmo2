'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { notify2 } from '@/lib/notify2';

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
    if (process.env.NODE_ENV === 'development') {
      console.log('[UploadReviewModalContext] openModal called with:', {
        filesCount: files.length,
        filesNames: files.map(f => f.name),
        config
      });
    }
    
    setModalState({
      isOpen: true,
      files,
      config
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[UploadReviewModalContext] Modal state updated, isOpen: true');
    }
  }, []);

  // Détecter si on est sur mobile
  const isMobile = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }, []);

  // Ouvrir la modal avec sélection de fichier
  const openModalWithFileSelection = useCallback((config: UploadReviewModalConfig = {}) => {
    console.log('[UploadReviewModalContext] openModalWithFileSelection called');
    
    // Utiliser l'input file natif (iOS affichera le menu natif avec photothèque, caméra, fichiers)
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,image/*';
    input.multiple = true;
    
    // Sur mobile, permettre la capture de caméra directement
    // iOS utilisera son menu natif avec les options
    if (isMobile()) {
      // Sur iOS, avec accept="image/*" ou accept="image/*,application/pdf", 
      // le menu natif affiche : Photothèque, Prendre une photo, Choisir fichier
      // Pas besoin de modal intermédiaire
      console.log('[UploadReviewModalContext] Mobile détecté, utilisation du menu natif iOS');
    }
    
    // Gérer l'événement change (plus fiable sur iOS)
    const handleFileChange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const files = Array.from(target.files || []);
      console.log('[UploadReviewModalContext] handleFileChange triggered:', files.length, 'files');
      console.log('[UploadReviewModalContext] Files details:', files.map(f => ({ name: f.name, type: f.type, size: f.size })));
      
      if (files.length > 0) {
        // Vérifier que les fichiers ont une taille valide (important pour iOS)
        const validFiles = files.filter(f => f.size > 0);
        
        if (validFiles.length === 0) {
          console.error('[UploadReviewModalContext] Aucun fichier valide (taille 0)');
          notify2.error('Erreur', 'Le fichier est vide. Réessayez.');
          return;
        }
        
        console.log('[UploadReviewModalContext] Opening modal with', validFiles.length, 'valid files');
        
        // Utiliser setTimeout pour s'assurer que le fichier est complètement chargé (surtout sur iOS)
        setTimeout(() => {
          openModal(validFiles, config);
        }, 100);
      } else {
        console.warn('[UploadReviewModalContext] Aucun fichier sélectionné');
      }
    };
    
    // Ajouter les deux événements pour meilleure compatibilité iOS
    input.addEventListener('change', handleFileChange);
    input.addEventListener('input', handleFileChange);
    
    // Cleanup après utilisation
    const cleanup = () => {
      input.removeEventListener('change', handleFileChange);
      input.removeEventListener('input', handleFileChange);
    };
    
    // Timeout de sécurité pour nettoyer si rien ne se passe
    const timeout = setTimeout(() => {
      cleanup();
    }, 30000); // 30 secondes
    
    input.onchange = (e) => {
      clearTimeout(timeout);
      handleFileChange(e);
      cleanup();
    };
    
    input.oninput = (e) => {
      clearTimeout(timeout);
      handleFileChange(e);
      cleanup();
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
  const handleSuccess = useCallback(async () => {
    // Attendre le callback asynchrone s'il existe
    if (modalState.config.onSuccess) {
      await modalState.config.onSuccess();
    }
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

