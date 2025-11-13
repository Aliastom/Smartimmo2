import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notify2 } from '@/lib/notify2';

export type RapprochementStatus = 'non_rapprochee' | 'rapprochee';

interface ToggleRapprochementParams {
  id: string;
  status: RapprochementStatus;
  bankRef?: string;
}

interface ToggleRapprochementResponse {
  ok: boolean;
  id: string;
  rapprochementStatus: RapprochementStatus;
  dateRapprochement: string | null;
}

/**
 * Hook pour toggler le statut de rapprochement d'une transaction
 * Utilisé dans le drawer avec autosave
 */
export function useToggleRapprochement() {
  const queryClient = useQueryClient();

  return useMutation<ToggleRapprochementResponse, Error, ToggleRapprochementParams>({
    mutationFn: async ({ id, status, bankRef }: ToggleRapprochementParams) => {
      const body: any = { rapprochementStatus: status };
      if (bankRef) {
        body.bankRef = bankRef;
      }

      const res = await fetch(`/api/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erreur lors de la mise à jour du rapprochement');
      }

      return res.json();
    },
    onSuccess: (data, variables) => {
      // Invalider les queries pour forcer un refresh
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-charts'] });
      queryClient.invalidateQueries({ queryKey: ['transaction', variables.id] });

      // Toast de succès
      const message = variables.status === 'rapprochee' 
        ? 'Transaction marquée comme rapprochée' 
        : 'Transaction repassée en non rapprochée';
      notify2.success(message);
    },
    onError: (error) => {
      // Toast d'erreur
      notify2.error('Échec de la mise à jour', error.message || 'Réessayez.');
      console.error('[useToggleRapprochement] Erreur:', error);
    }
  });
}

