import { redirect } from 'next/navigation';

interface PropertyTenantsPageProps {
  params: {
    id: string;
  };
}

export default function PropertyTenantsPage({ params }: PropertyTenantsPageProps) {
  // Rediriger vers la page principale avec l'onglet baux (qui contient les locataires)
  redirect(`/biens/${params.id}?tab=leases`);
}