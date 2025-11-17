import { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { PropertyHeader } from './PropertyHeader';
import { PropertyHeaderActionsProvider } from './PropertyHeaderActionsContext';

export const dynamic = 'force-dynamic';

interface PropertyLayoutProps {
  children: ReactNode;
  params: {
    id: string;
  };
}

export default async function PropertyLayout({ children, params }: PropertyLayoutProps) {
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
    <PropertyHeaderActionsProvider>
      <div className="space-y-6">
        {/* Header avec menu intégré - Partagé pour toutes les sous-pages */}
        <PropertyHeader propertyId={property.id} propertyName={property.name} />
        
        {/* Contenu spécifique à chaque page */}
        {children}
      </div>
    </PropertyHeaderActionsProvider>
  );
}

