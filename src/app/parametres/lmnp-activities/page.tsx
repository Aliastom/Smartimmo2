import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Activités LMNP — Paramètres',
  description: 'Gestion des activités LMNP/SIRET',
};

export default function LmnpActivitiesPage() {
  redirect('/app?view=lmnp-activities');
}
