import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import PropertyLoansClient from './PropertyLoansClient';

interface PropertyLoansPageProps {
  params: {
    id: string;
  };
}

export default async function PropertyLoansPage({ params }: PropertyLoansPageProps) {
  // Vérifier que le bien existe
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/properties/${params.id}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    notFound();
  }

  const property = await res.json();

  return (
    <div className="space-y-6">
      <Suspense fallback={<div>Chargement...</div>}>
        <PropertyLoansClient propertyId={params.id} propertyName={property.name} />
      </Suspense>
    </div>
  );
}
