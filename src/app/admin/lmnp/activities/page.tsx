import { Metadata } from 'next';
import LmnpActivitiesAdminClient from './LmnpActivitiesAdminClient';

export const metadata: Metadata = {
  title: 'Activités LMNP — Administration',
  description: 'Gestion des activités LMNP/SIRET',
};

export default function LmnpActivitiesAdminPage() {
  return <LmnpActivitiesAdminClient />;
}
