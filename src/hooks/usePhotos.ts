import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Photo, PhotoFilters, PhotoUploadData } from '@/types/photo';

// Query Keys
export const photoKeys = {
  all: ['photos'] as const,
  lists: () => [...photoKeys.all, 'list'] as const,
  list: (filters: PhotoFilters) => [...photoKeys.lists(), filters] as const,
  details: () => [...photoKeys.all, 'detail'] as const,
  detail: (id: string) => [...photoKeys.details(), id] as const,
};

// Hook pour récupérer les photos
export function usePhotos(filters: PhotoFilters = {}) {
  return useQuery<{ items: Photo[]; total: number; count: number }>({
    queryKey: photoKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.propertyId) params.append('propertyId', filters.propertyId);
      if (filters.room) params.append('room', filters.room);
      if (filters.tag) params.append('tag', filters.tag);
      if (filters.q) params.append('q', filters.q);

      const response = await fetch(`/api/photos?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch photos');
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Hook pour récupérer une photo spécifique
export function usePhoto(id: string) {
  return useQuery<Photo>({
    queryKey: photoKeys.detail(id),
    queryFn: async () => {
      const response = await fetch(`/api/photos/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch photo');
      }
      return response.json();
    },
    enabled: !!id,
  });
}

// Hook pour uploader une photo
export function useUploadPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PhotoUploadData) => {
      const response = await fetch('/api/photos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload photo');
      }

      return response.json();
    },
    onMutate: async (newPhoto) => {
      // Optimistic update
      const filters: PhotoFilters = { propertyId: newPhoto.propertyId };

      await queryClient.cancelQueries({ queryKey: photoKeys.list(filters) });

      const previousPhotos = queryClient.getQueryData(photoKeys.list(filters));

      // Simuler la nouvelle photo (sans ID pour l'instant)
      const optimisticPhoto: Photo = {
        id: `temp-${Date.now()}`,
        fileName: newPhoto.file.name,
        mime: newPhoto.file.mime,
        size: newPhoto.file.size,
        url: '', // Sera mis à jour après upload
        propertyId: newPhoto.propertyId,
        room: newPhoto.room,
        tag: newPhoto.tag,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData(photoKeys.list(filters), (old: any) => {
        if (!old) return { items: [optimisticPhoto], total: 1, count: 1 };
        return {
          ...old,
          items: [optimisticPhoto, ...old.items],
          total: old.total + 1,
          count: old.count + 1,
        };
      });

      return { previousPhotos, filters };
    },
    onSuccess: (data, variables, context) => {
      // Remplacer la photo optimiste par la vraie
      if (context) {
        queryClient.setQueryData(photoKeys.list(context.filters), (old: any) => {
          if (!old) return { items: [data], total: 1, count: 1 };
          return {
            ...old,
            items: old.items.map((item: Photo) => 
              item.id.startsWith('temp-') ? data : item
            ),
          };
        });
      }

      // Invalider toutes les listes de photos
      queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
      
      toast.success('Photo uploadée avec succès');
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context) {
        queryClient.setQueryData(photoKeys.list(context.filters), context.previousPhotos);
      }
      
      toast.error(error.message || 'Erreur lors de l\'upload de la photo');
    },
  });
}

// Hook pour supprimer une photo
export function useDeletePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/photos/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete photo');
      }

      return response.json();
    },
    onMutate: async (photoId) => {
      // Optimistic update - supprimer la photo de toutes les listes
      await queryClient.cancelQueries({ queryKey: photoKeys.lists() });

      const previousData: Record<string, any> = {};

      // Sauvegarder les données précédentes pour rollback
      queryClient.getQueriesData({ queryKey: photoKeys.lists() }).forEach(([queryKey, data]) => {
        previousData[JSON.stringify(queryKey)] = data;
      });

      // Supprimer la photo de toutes les listes
      queryClient.getQueriesData({ queryKey: photoKeys.lists() }).forEach(([queryKey, data]) => {
        if (data && typeof data === 'object' && 'items' in data) {
          queryClient.setQueryData(queryKey, {
            ...data,
            items: (data.items as Photo[]).filter((photo: Photo) => photo.id !== photoId),
            total: Math.max(0, data.total - 1),
            count: Math.max(0, data.count - 1),
          });
        }
      });

      return { previousData };
    },
    onSuccess: () => {
      // Invalider toutes les listes pour s'assurer de la cohérence
      queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
      toast.success('Photo supprimée avec succès');
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context) {
        Object.entries(context.previousData).forEach(([queryKey, data]) => {
          queryClient.setQueryData(JSON.parse(queryKey), data);
        });
      }
      
      toast.error(error.message || 'Erreur lors de la suppression de la photo');
    },
  });
}

// Hook pour refresh manuel des photos
export function useRefreshPhotos() {
  const queryClient = useQueryClient();

  return (filters?: PhotoFilters) => {
    if (filters) {
      queryClient.invalidateQueries({ queryKey: photoKeys.list(filters) });
    } else {
      queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
    }
  };
}

