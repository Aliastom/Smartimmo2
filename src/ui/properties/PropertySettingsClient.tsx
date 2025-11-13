'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Property } from '../../domain/entities/Property';
import PropertyInfoTab from '../components/PropertyInfoTab';

interface PropertySettingsClientProps {
  property: Property;
}

export default function PropertySettingsClient({ property }: PropertySettingsClientProps) {
  const router = useRouter();

  const handleUpdate = () => {
    // Rafraîchir la page pour récupérer les nouvelles données
    router.refresh();
  };

  return (
    <div>
      <PropertyInfoTab
        property={property}
        onUpdate={handleUpdate}
      />
    </div>
  );
}

