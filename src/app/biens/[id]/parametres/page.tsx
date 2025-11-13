import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import PropertySettingsClient from './PropertySettingsClient';

interface PropertySettingsPageProps {
  params: {
    id: string;
  };
}

export default async function PropertySettingsPage({ params }: PropertySettingsPageProps) {
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
    <PropertySettingsClient
      propertyId={property.id}
      propertyName={property.name}
    />
  );
}

