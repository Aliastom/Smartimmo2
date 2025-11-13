import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import PropertyLeasesClient from './PropertyLeasesClient';

interface PropertyLeasesPageProps {
  params: {
    id: string;
  };
}

export default async function PropertyLeasesPage({ params }: PropertyLeasesPageProps) {
  // Charger les informations du bien
  const property = await prisma.property.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
    },
  });

  if (!property) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Suspense fallback={<div>Chargement...</div>}>
        <PropertyLeasesClient 
          propertyId={property.id} 
          propertyName={property.name}
        />
      </Suspense>
    </div>
  );
}

