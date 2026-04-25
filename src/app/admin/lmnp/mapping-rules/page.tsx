import { Metadata } from 'next';
import LmnpMappingRulesAdminClient from './LmnpMappingRulesAdminClient';

export const metadata: Metadata = {
  title: 'Règles export LMNP — Administration',
  description: 'Consultation des règles de mapping export LMNP',
};

export default function LmnpMappingRulesAdminPage() {
  return <LmnpMappingRulesAdminClient />;
}
