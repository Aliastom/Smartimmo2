'use client';

import { useEffect, useState } from 'react';

interface PhotoStats {
  totalPhotos: number;
  linkedToProperty: number;
  untagged: number;
  recentlyAdded: number;
  isLoading: boolean;
  error?: string;
}

interface PhotoStatsFilters {
  propertyId?: string;
  month?: number;
  year?: number;
}

export function usePhotoStats(filters: PhotoStatsFilters = {}): PhotoStats {
  const [stats, setStats] = useState<PhotoStats>({
    totalPhotos: 0,
    linkedToProperty: 0,
    untagged: 0,
    recentlyAdded: 0,
    isLoading: true,
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const params = new URLSearchParams();
        
        if (filters.propertyId) {
          params.append('propertyId', filters.propertyId);
        }
        if (filters.month !== undefined) {
          params.append('month', filters.month.toString());
        }
        if (filters.year !== undefined) {
          params.append('year', filters.year.toString());
        }

        const response = await fetch(`/api/photos/stats?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch photo stats');
        }

        const data = await response.json();
        setStats({
          ...data,
          isLoading: false,
        });
      } catch (error) {
        console.error('Error fetching photo stats:', error);
        setStats(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    }

    fetchStats();
  }, [filters.propertyId, filters.month, filters.year]);

  return stats;
}

