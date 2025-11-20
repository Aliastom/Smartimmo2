'use client';

import React, { useEffect } from 'react';
import { UploadReviewModal } from './UploadReviewModal';
import { useUploadReviewModal } from '@/contexts/UploadReviewModalContext';

/**
 * Composant wrapper qui fournit une modal d'upload unifiée pour toute l'application
 * Utilise le contexte UploadReviewModalContext pour la gestion d'état
 */
export function UnifiedUploadReviewModal() {
  const {
    isOpen,
    files,
    config,
    closeModal,
    handleSuccess
  } = useUploadReviewModal();

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[UnifiedUploadReviewModal] State changed:', {
        isOpen,
        filesCount: files.length,
        config
      });
    }
  }, [isOpen, files, config]);

  return (
    <UploadReviewModal
      isOpen={isOpen}
      onClose={closeModal}
      files={files}
      scope={config.scope || 'global'}
      propertyId={config.propertyId}
      leaseId={config.leaseId}
      tenantId={config.tenantId}
      onSuccess={handleSuccess}
      autoLinkingContext={config.autoLinkingContext}
      autoLinkingDocumentType={config.autoLinkingDocumentType}
      documentTypeEditable={config.autoLinkingDocumentType ? false : true}
    />
  );
}

// Export du hook pour utilisation dans d'autres composants
export { useUploadReviewModal } from '@/contexts/UploadReviewModalContext';
export type { UploadReviewModalConfig } from '@/contexts/UploadReviewModalContext';
