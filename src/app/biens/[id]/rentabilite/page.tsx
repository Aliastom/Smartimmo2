import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import PropertyProfitabilityClient from './PropertyProfitabilityClient';

interface PropertyProfitabilityPageProps {
  params: {
    id: string;
  };
}

export default async function PropertyProfitabilityPage({ params }: PropertyProfitabilityPageProps) {
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
    <PropertyProfitabilityClient
      propertyId={property.id}
      propertyName={property.name}
    />
  );
}

