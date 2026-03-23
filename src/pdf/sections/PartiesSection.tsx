import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { leasePdfStyles as s } from '../leasePdfTheme';
import { frDate, joinAddress } from '../leasePdfUtils';
import type { LeasePdfProfile, LeasePdfTenant } from '../leasePdfTypes';

type Props = {
  tenant: LeasePdfTenant;
  profile?: LeasePdfProfile;
};

export function PartiesSection({ tenant, profile }: Props) {
  const profileAddress = joinAddress(profile?.address, profile?.postalCode, profile?.city);
  const tenantAddress = joinAddress(tenant.address, tenant.postalCode, tenant.city);

  return (
    <>
      <View style={[s.sectionHeader, s.sectionHeaderPageLead]}>
        <Text style={s.sectionHeaderText}>1. Désignation des parties</Text>
      </View>
      <View style={s.card}>
        <Text style={s.subTitle}>Bailleur</Text>
        <Text style={s.paragraph}>
          {profile?.firstName} {profile?.lastName}
          {profile?.company ? ` — ${profile.company}` : ''}
        </Text>
        <Text style={s.paragraph}>{profileAddress || 'Adresse du bailleur à compléter.'}</Text>
        <Text style={s.legalMention}>
          Ci-après dénommé « le Bailleur », agissant en qualité de propriétaire ou de mandataire habilité.
        </Text>

        <Text style={[s.subTitle, { marginTop: 10 }]}>Locataire</Text>
        <Text style={s.paragraph}>
          {tenant.firstName} {tenant.lastName}
        </Text>
        <Text style={s.paragraph}>Courriel : {tenant.email}</Text>
        {tenant.phone ? <Text style={s.paragraph}>Téléphone : {tenant.phone}</Text> : null}
        {tenant.birthDate ? <Text style={s.paragraph}>Né(e) le {frDate(tenant.birthDate)}</Text> : null}
        {tenantAddress ? <Text style={s.paragraph}>Adresse : {tenantAddress}</Text> : null}
        <Text style={s.legalMention}>Ci-après dénommé « le Locataire ».</Text>
      </View>
    </>
  );
}
