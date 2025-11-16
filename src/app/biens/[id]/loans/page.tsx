import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import PropertyLoansClient from './PropertyLoansClient';

interface PropertyLoansPageProps {
  params: {
    id: string;
  };
}

export default async function PropertyLoansPage({ params }: PropertyLoansPageProps) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  const apiUrl = baseUrl ? `${baseUrl}/api/properties/${params.id}` : `/api/properties/${params.id}`;

  // Vérifier que le bien existe
  const res = await fetch(apiUrl, {
    cache: 'no-store',
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
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
