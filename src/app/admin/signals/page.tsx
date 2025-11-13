import { Metadata } from 'next';
import SignalsCatalogClient from './SignalsCatalogClient';

export const metadata: Metadata = {
  title: 'Catalogue des Signaux - Administration',
  description: 'Gestion du catalogue des signaux pour la classification de documents',
};

export default function SignalsCatalogPage() {
  return <SignalsCatalogClient />;
}

