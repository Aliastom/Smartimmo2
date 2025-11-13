'use client';

import React from 'react';
import UnifiedTransactionModal from './UnifiedTransactionModal';
import { useUnifiedTransactionModal } from '@/hooks/useUnifiedTransactionModal';

interface UnifiedTransactionModalWrapperProps {
  onSuccess?: () => void;
}

export default function UnifiedTransactionModalWrapper({ 
  onSuccess 
}: UnifiedTransactionModalWrapperProps) {
  const {
    isOpen,
    context,
    mode,
    transactionId,
    title,
    close,
    handleSubmit
  } = useUnifiedTransactionModal({ onSuccess });

  return (
    <UnifiedTransactionModal
      isOpen={isOpen}
      onClose={close}
      onSubmit={handleSubmit}
      context={context}
      mode={mode}
      transactionId={transactionId}
      title={title}
    />
  );
}

// Export du hook pour utilisation dans d'autres composants
export { useUnifiedTransactionModal };

