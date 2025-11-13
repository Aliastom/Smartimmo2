'use client';

import React from 'react';
import { Camera, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { BackToPropertyButton } from '@/components/shared/BackToPropertyButton';
import { PropertySubNav } from '@/components/bien/PropertySubNav';

interface PropertyPhotosClientProps {
  propertyId: string;
  propertyName: string;
}

export default function PropertyPhotosClient({ propertyId, propertyName }: PropertyPhotosClientProps) {
  return (
    <div className="space-y-6">
      {/* Header avec menu intégré */}
      <div className="grid grid-cols-3 items-center mb-6 gap-6">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 border-b-4 border-purple-400 pb-2 inline-block">Photos - {propertyName}</h1>
          <p className="text-gray-600 mt-2">Galerie photos de {propertyName}</p>
        </div>
        
        <div className="flex justify-center">
          <PropertySubNav
            propertyId={propertyId}
            counts={{
              photos: 0,
            }}
          />
        </div>
        
        <div className="flex items-center gap-3 justify-end">
          <Button>
            <Upload className="h-4 w-4 mr-2" />
            Ajouter des photos
          </Button>
          <BackToPropertyButton propertyId={propertyId} propertyName={propertyName} />
        </div>
      </div>

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

