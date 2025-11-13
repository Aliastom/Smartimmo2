import { redirect } from 'next/navigation';

interface PropertyProfitabilityPageProps {
  params: {
    id: string;
  };
}

export default function PropertyProfitabilityPage({ params }: PropertyProfitabilityPageProps) {
  // Rediriger vers la page principale avec l'onglet rentabilité
  redirect(`/biens/${params.id}?tab=profitability`);
}