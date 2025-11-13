import { useState, useCallback } from 'react';
import { Blocker } from '@/ui/shared/BlockingDialog';

interface DeletionResponse {
  success: boolean;
  blocked?: boolean;
  blockers?: Blocker[];
  message?: string;
}

interface UseDeletionGuardOptions {
  onViewBlocker?: (blocker: Blocker) => void;
}

export function useDeletionGuard(options: UseDeletionGuardOptions = {}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<{
    title: string;
    message: string;
    blockers: Blocker[];
  }>({
    title: '',
    message: '',
    blockers: [],
  });

  const openWith = useCallback((payload: DeletionResponse, entityType: string, entityLabel: string) => {
    if (payload.blocked && payload.blockers) {
      setDialogData({
        title: `Suppression impossible - ${entityLabel}`,
        message: `Impossible de supprimer ce ${entityType} car il est lié à d'autres éléments.`,
        blockers: payload.blockers,
      });
      setIsDialogOpen(true);
    }
  }, []);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const handleViewBlocker = useCallback((blocker: Blocker) => {
    if (options.onViewBlocker) {
      options.onViewBlocker(blocker);
    }
    setIsDialogOpen(false);
  }, [options.onViewBlocker]);

  return {
    isDialogOpen,
    dialogData,
    openWith,
    closeDialog,
    handleViewBlocker,
  };
}

