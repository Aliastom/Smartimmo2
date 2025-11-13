import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import PropertyComingSoonClient from './PropertyComingSoonClient';

interface PropertyComingSoonPageProps {
  params: {
    id: string;
  };
}

export default async function PropertyComingSoonPage({ params }: PropertyComingSoonPageProps) {
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
    <PropertyComingSoonClient
      propertyId={property.id}
      propertyName={property.name}
    />
  );
}

