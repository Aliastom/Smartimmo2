import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import PropertyPhotosClient from './PropertyPhotosClient';


// Force dynamic rendering - this page requires database access
export const dynamic = 'force-dynamic';

interface PropertyPhotosPageProps {
  params: {
    id: string;
  };
}

export default async function PropertyPhotosPage({ params }: PropertyPhotosPageProps) {
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
    <PropertyPhotosClient
      propertyId={property.id}
      propertyName={property.name}
    />
  );
}