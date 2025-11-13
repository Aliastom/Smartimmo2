import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useLeaseStatusSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (propertyId?: string) => {
      const url = propertyId 
        ? `/api/leases/sync-status?propertyId=${propertyId}`
        : '/api/leases/sync-status';
        
      const response = await fetch(url, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la synchronisation');
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.updated > 0) {
        toast.success(`${data.updated} bail(s) mis à jour`);
        
        // Invalider les queries liées aux baux
        queryClient.invalidateQueries({ queryKey: ['leases'] });
        queryClient.invalidateQueries({ queryKey: ['lease-stats'] });
        queryClient.invalidateQueries({ queryKey: ['property-stats'] });
        queryClient.invalidateQueries({ queryKey: ['tenant-stats'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      } else {
        toast.info('Aucun bail à synchroniser');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });
}
