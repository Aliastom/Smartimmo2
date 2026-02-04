'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import ProfilClient from '@/app/profil/ProfilClient';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { useProfileData } from '@/hooks/offline/useProfileData';

interface ProfilPageCoreProps {
  mode: 'normal' | 'app-shell';
}

export function ProfilPageCore({ mode }: ProfilPageCoreProps) {
  const { organizationId } = useCurrentOrganization();
  const { profile, loading, error } = useProfileData({ mode, initialData: null });

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="text-center text-gray-600">Chargement du profil...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="text-center text-red-600">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!organizationId) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="text-center text-gray-600">
            Veuillez sélectionner une organisation pour afficher votre profil.
          </div>
        </CardContent>
      </Card>
    );
  }

  return <ProfilClient initialData={profile} mode={mode} />;
}

