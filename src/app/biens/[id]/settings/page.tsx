import { redirect } from 'next/navigation';

interface PropertySettingsPageProps {
  params: {
    id: string;
  };
}

export default function PropertySettingsPage({ params }: PropertySettingsPageProps) {
  // Rediriger vers la page principale avec l'onglet paramètres
  redirect(`/biens/${params.id}?tab=settings`);
}