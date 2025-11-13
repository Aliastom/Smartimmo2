'use client';

import React from 'react';
import { Camera, Link, Tag, Clock } from 'lucide-react';
import StatCard from '../StatCard';
import StatCardsRow from '../StatCardsRow';
import { usePhotoStats } from '../../hooks/usePhotoStats';

interface PhotoStatsCardsProps {
  propertyId?: string;
  month?: number;
  year?: number;
  onFilterClick?: (filterType: string) => void;
}

export default function PhotoStatsCards({ propertyId, month, year, onFilterClick }: PhotoStatsCardsProps) {
  const stats = usePhotoStats({ propertyId, month, year });

  return (
    <StatCardsRow>
      <StatCard
        title="Photos totales"
        value={stats.isLoading ? '...' : stats.totalPhotos}
        subtitle="Dans la bibliothèque"
        icon={Camera}
        iconColor="text-primary"
        iconBgColor="bg-blue-100"
        isLoading={stats.isLoading}
      />
      <StatCard
        title="Liées à un bien"
        value={stats.isLoading ? '...' : stats.linkedToProperty}
        subtitle="Attachées"
        icon={Link}
        iconColor="text-success"
        iconBgColor="bg-green-100"
        isLoading={stats.isLoading}
        onClick={onFilterClick ? () => onFilterClick('linked') : undefined}
      />
      <StatCard
        title="Non taguées"
        value={stats.isLoading ? '...' : stats.untagged}
        subtitle="À organiser"
        icon={Tag}
        iconColor="text-orange-600"
        iconBgColor="bg-orange-100"
        isLoading={stats.isLoading}
        onClick={onFilterClick ? () => onFilterClick('untagged') : undefined}
      />
      <StatCard
        title="Ajoutées"
        value={stats.isLoading ? '...' : stats.recentlyAdded}
        subtitle="Période sélectionnée"
        icon={Clock}
        iconColor="text-purple-600"
        iconBgColor="bg-purple-100"
        isLoading={stats.isLoading}
      />
    </StatCardsRow>
  );
}

