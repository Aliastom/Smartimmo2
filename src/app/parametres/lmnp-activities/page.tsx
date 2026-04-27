import { Metadata } from 'next';
import LmnpActivitiesPageClient from './LmnpActivitiesPageClient';

export const metadata: Metadata = {
  title: 'Activités LMNP — Paramètres',
  description: 'Gestion des activités LMNP/SIRET',
};

export default function LmnpActivitiesPage() {
  return <LmnpActivitiesPageClient />;
}
