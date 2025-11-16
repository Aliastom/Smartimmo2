import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import PropertyLeasesClient from './PropertyLeasesClient';


// Force dynamic rendering - this page requires database access
export const dynamic = 'force-dynamic';

interface PropertyLeasesPageProps {
  params: {
    id: string;
  };
}

export default async function PropertyLeasesPage({ params }: PropertyLeasesPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    notFound();
  }

  // Charger les informations du bien
  const property = await prisma.property.findFirst({
    where: { 
      id: params.id,
      organizationId: user.organizationId
    },
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

