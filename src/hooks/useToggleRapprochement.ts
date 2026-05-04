import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notify2 } from '@/lib/notify2';
import { useEffect, useRef } from 'react';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { dispatchTransactionsLocalRefresh } from '@/features/transactions/txLocalRefresh';

export type RapprochementStatus = 'non_rapprochee' | 'rapprochee';

export interface ToggleRapprochementParams {
  id: string;
  status: RapprochementStatus;
  bankRef?: string;
  mode?: 'normal' | 'app-shell'; // Mode de fonctionnement
}

interface ToggleRapprochementResponse {
  ok: boolean;
  id: string;
  rapprochementStatus: RapprochementStatus;
  dateRapprochement: string | null;
}

/**
 * Hook pour toggler le statut de rapprochement d'une transaction
 * 
 * Mode offline-first (app-shell) :
 * - Mise à jour immédiate dans IndexedDB via les repositories
 * - Création d'une pendingOp automatique
 * - Push immédiat si online
 * - Écoute de sync:refresh pour rafraîchir l'état
 * 
 * Mode normal :
 * - Appel API direct comme avant
 */
export function useToggleRapprochement(mode: 'normal' | 'app-shell' = 'normal') {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrganization();
  const refreshKeyRef = useRef(0);

  // Écouter sync:refresh en mode app-shell pour rafraîchir l'état
  useEffect(() => {
    if (mode === 'app-shell') {
      const handleRefresh = () => {
        refreshKeyRef.current += 1;
        // Invalider les queries pour forcer un refresh
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['transactions-kpis'] });
        queryClient.invalidateQueries({ queryKey: ['transactions-charts'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-monthly'], exact: false });
      };

      window.addEventListener('sync:refresh', handleRefresh);
      return () => {
        window.removeEventListener('sync:refresh', handleRefresh);
      };
    }
  }, [mode, queryClient]);

  return useMutation<ToggleRapprochementResponse, Error, ToggleRapprochementParams>({
    // ⚠️ CRITIQUE: networkMode: "always" pour exécuter mutationFn même en offline
    // Par défaut, React Query bloque les mutations en offline (networkMode: "online")
    // En mode offline-first, on doit TOUJOURS exécuter la mutation pour update IndexedDB + create pendingOp
    networkMode: 'always',
    mutationFn: async ({ id, status, bankRef, mode: paramMode }: ToggleRapprochementParams) => {
      // ⚠️ CRITIQUE: Log dès l'entrée dans mutationFn pour confirmer que le hook est appelé
      console.log('[useToggleRapprochement] 🚀 mutationFn appelée avec:', {
        id,
        status,
        bankRef,
        paramMode,
        mode,
      });
      
      const effectiveMode = paramMode || mode;
      const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
      
      console.log('[useToggleRapprochement] 🔍 Détection du mode:', {
        effectiveMode,
        isOnline,
        paramMode,
        mode,
      });

      if (effectiveMode === 'app-shell' || !isOnline) {
        console.log('[useToggleRapprochement] Mode app-shell ou offline, effectiveMode:', effectiveMode, 'isOnline:', isOnline);
        // Mode app-shell ou offline : utiliser le repository offline
        if (!organizationId) {
          console.error('[useToggleRapprochement] ❌ OrganizationId manquant');
          throw new Error('OrganizationId requis pour le rapprochement');
        }

        // ⚠️ CRITIQUE: Déclarer updatedTransaction en dehors du try pour qu'il soit accessible après
        let updatedTransaction: any = null;

        try {
          console.log('[useToggleRapprochement] 📦 Récupération du repository offline');
          const repo = getTransactionRepositoryOffline();
          
          // Récupérer la transaction actuelle
          console.log('[useToggleRapprochement] 🔍 Récupération de la transaction:', id, 'orgId:', organizationId);
          const currentTransaction = await repo.getById(id, organizationId);
          if (!currentTransaction) {
            console.error('[useToggleRapprochement] ❌ Transaction non trouvée:', id);
            throw new Error('Transaction non trouvée');
          }
          console.log('[useToggleRapprochement] ✅ Transaction trouvée:', currentTransaction.id);

          // Préparer les données de mise à jour
          const now = new Date().toISOString();
          const updateData: Partial<typeof currentTransaction> = {
            rapprochementStatus: status,
            dateRapprochement: status === 'rapprochee' ? now : null,
            updatedAt: now,
          };

          if (bankRef) {
            updateData.bankRef = bankRef;
          }

          console.log('[useToggleRapprochement] 💾 Mise à jour de la transaction dans IndexedDB');
          console.log('[useToggleRapprochement] 💾 Données de mise à jour:', updateData);
          console.log('[useToggleRapprochement] 💾 Appel de repo.upsert...');
          
          // ⚠️ CRITIQUE: Mettre à jour dans IndexedDB (créera automatiquement une pendingOp)
          // Cette opération DOIT réussir même en offline
          updatedTransaction = await repo.upsert({
            id,
            ...updateData,
            organizationId,
          }, organizationId);
          
          console.log('[useToggleRapprochement] ✅ Transaction mise à jour dans IndexedDB:', updatedTransaction.id);
          console.log('[useToggleRapprochement] ✅ PendingOp créée automatiquement par repo.upsert');
        } catch (repoError) {
          console.error('[useToggleRapprochement] ❌ Erreur dans le repository offline:', repoError);
          console.error('[useToggleRapprochement] ❌ Détails:', {
            message: repoError instanceof Error ? repoError.message : String(repoError),
            stack: repoError instanceof Error ? repoError.stack : undefined,
            name: repoError instanceof Error ? repoError.name : undefined,
          });
          // ⚠️ CRITIQUE: Ne pas masquer l'erreur, la propager pour que l'UI soit notifiée
          throw repoError;
        }

        // ⚠️ CRITIQUE: Vérifier que updatedTransaction a bien été défini
        if (!updatedTransaction) {
          console.error('[useToggleRapprochement] ❌ updatedTransaction est null après upsert');
          throw new Error('Échec de la mise à jour de la transaction dans IndexedDB');
        }

        // ⚠️ CRITIQUE: Si online, pousser immédiatement les pendingOps vers Supabase
        // (conforme au modèle : Situation 7 - actions online doivent être synchronisées immédiatement)
        if (isOnline) {
          console.log('[useToggleRapprochement] 🌐 Online, synchronisation immédiate des pendingOps');
          try {
            const { getGlobalSyncService } = await import('@/lib/offline/syncGlobal');
            const syncService = getGlobalSyncService();
            await syncService.syncAllPendingToRemote(organizationId);
            console.log('[useToggleRapprochement] ✅ Synchronisation immédiate terminée');
          } catch (syncError) {
            console.error('[useToggleRapprochement] ❌ Erreur lors de la sync immédiate:', syncError);
            // ⚠️ CRITIQUE: Ne pas échouer la mutation si la sync échoue
            // La pendingOp a déjà été créée et sera synchronisée plus tard
          }
        } else {
          console.log('[useToggleRapprochement] 📴 Offline, pas de sync immédiate (pendingOp créée et sera sync plus tard)');
        }

        console.log('[useToggleRapprochement] ✅ Rapprochement terminé avec succès');
        // Retourner la réponse au format attendu
        return {
          ok: true,
          id: updatedTransaction.id,
          rapprochementStatus: status,
          dateRapprochement: updatedTransaction.dateRapprochement || null,
        };
      } else {
        // Mode normal online : utiliser l'API
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
      }
    },
    onSuccess: (data, variables) => {
      const effectiveMode = variables.mode || mode;
      if (effectiveMode === 'app-shell') {
        const message =
          variables.status === 'rapprochee'
            ? 'Transaction marquée comme rapprochée'
            : 'Transaction repassée en non rapprochée';
        notify2.success(message);
        // Patcher la liste + KPI + graphiques : même flux que `transactions:refresh` (scope bien)
        void (async () => {
          if (!organizationId || !data?.id) {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('transactions:refresh'));
            }
            return;
          }
          try {
            const repo = getTransactionRepositoryOffline();
            const row = await repo.getById(data.id, organizationId);
            if (row?.propertyId) {
              dispatchTransactionsLocalRefresh({
                scope: 'property',
                propertyId: row.propertyId,
                patch: { action: 'upsert', rows: [row] },
                reason: 'rapprochement',
              });
            } else {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('transactions:refresh'));
              }
            }
          } catch (e) {
            console.warn('[useToggleRapprochement] refresh UI après rapprochement', e);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('transactions:refresh'));
            }
          }
        })();
        return;
      }

      // Mode normal : invalider les queries comme avant
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['transactions-charts'] });
      queryClient.invalidateQueries({ queryKey: ['transaction', variables.id] });
      queryClient.invalidateQueries({ 
        queryKey: ['dashboard-monthly'],
        exact: false 
      });

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

