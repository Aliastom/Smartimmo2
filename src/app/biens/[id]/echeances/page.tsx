import React from 'react';
import { notFound } from 'next/navigation';
import { PropertyRepo } from '@/lib/db/PropertyRepo';
import PropertyEcheancesClient from './PropertyEcheancesClient';


// Force dynamic rendering - this page requires database access
export const dynamic = 'force-dynamic';

interface PropertyEcheancesPageProps {
  params: {
    id: string;
  };
}

export default async function PropertyEcheancesPage({ params }: PropertyEcheancesPageProps) {
  // Récupérer le bien
  const property = await PropertyRepo.findById(params.id);

  if (!property) {
    notFound();
  }

  return (
    <PropertyEcheancesClient
      propertyId={params.id}
      propertyName={property.name}
    />
  );
}

