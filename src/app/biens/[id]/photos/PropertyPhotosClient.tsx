'use client';

import React, { useMemo } from 'react';
import { Camera, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BackToPropertyButton } from '@/components/shared/BackToPropertyButton';
import { usePropertyHeaderActions } from '../PropertyHeaderActionsContext';

interface PropertyPhotosClientProps {
  propertyId: string;
  propertyName: string;
}

export default function PropertyPhotosClient({ propertyId, propertyName }: PropertyPhotosClientProps) {
  const { setActions } = usePropertyHeaderActions();

  // Mémoriser les actions pour éviter les re-renders inutiles
  const headerActions = useMemo(() => (
    <>
      <Button>
        <Upload className="h-4 w-4 mr-2" />
        Ajouter des photos
      </Button>
      <BackToPropertyButton propertyId={propertyId} propertyName={propertyName} />
    </>
  ), [propertyId, propertyName]);

  // Définir les actions dans le header
  React.useEffect(() => {
    setActions(headerActions);
    
    return () => {
      setActions(null);
    };
  }, [setActions, headerActions]);

  return (
    <div className="space-y-6">

      {/* Contenu photos */}
      <div className="text-center py-12">
        <Camera className="h-16 w-16 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Aucune photo pour le moment
        </h3>
        <p className="text-gray-600 mb-6">
          Ajoutez des photos pour créer une galerie visuelle de votre bien
        </p>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Ajouter des photos
        </Button>
      </div>
    </div>
  );
}

