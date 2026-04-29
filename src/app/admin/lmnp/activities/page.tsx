import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Activités LMNP — Administration',
  description: 'Gestion des activités LMNP/SIRET',
};

export default function LmnpActivitiesAdminPage() {
  redirect('/app?view=lmnp-activities');
}
