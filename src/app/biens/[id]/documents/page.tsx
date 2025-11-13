import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import PropertyDocumentsClient from './PropertyDocumentsClient';


// Force dynamic rendering - this page requires database access
export const dynamic = 'force-dynamic';

interface PropertyDocumentsPageProps {
  params: {
    id: string;
  };
}

export default async function PropertyDocumentsPage({ params }: PropertyDocumentsPageProps) {
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
        <PropertyDocumentsClient 
          propertyId={property.id} 
          propertyName={property.name}
        />
      </Suspense>
    </div>
  );
}
