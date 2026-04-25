import { Metadata } from 'next';
import LmnpOverridesAdminClient from './LmnpOverridesAdminClient';

export const metadata: Metadata = {
  title: "Overrides export LMNP — Administration",
  description: "Liste et gestion des overrides d'export LMNP",
};

export default function LmnpOverridesAdminPage() {
  return <LmnpOverridesAdminClient />;
}
