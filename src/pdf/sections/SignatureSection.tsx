import React from 'react';
import { Text, View, Image } from '@react-pdf/renderer';
import { dataUrlToPdfSrc } from '../helpers';
import { leasePdfStyles as s } from '../leasePdfTheme';
import { frDate, joinAddress } from '../leasePdfUtils';
import type { LeasePdfProfile, LeasePdfProperty, LeasePdfTenant } from '../leasePdfTypes';

type Props = {
  tenant: LeasePdfTenant;
  property: LeasePdfProperty;
  profile?: LeasePdfProfile;
  generatedAt?: string;
};

export function SignatureSection({ tenant, property, profile, generatedAt }: Props) {
  const signature = dataUrlToPdfSrc(profile?.signature);
  const propertyAddress = joinAddress(property.address, property.postalCode, property.city);
  const today = frDate(generatedAt ?? new Date().toISOString());

  return (
    <>
      <Text style={s.signTitle}>Page de signature</Text>
      <Text style={[s.paragraph, { marginBottom: 10 }]}>
        Fait à {profile?.city || '…………………'}, le {today}, en autant d’exemplaires originaux que de parties, pour le bien situé {propertyAddress}.
      </Text>
      <Text style={[s.paragraph, { fontWeight: 'bold', marginBottom: 10 }]}>Lu et approuvé, bon pour accord.</Text>

      <View style={s.signRow}>
        <View style={s.signCol}>
          <Text style={s.signColTitle}>Bailleur</Text>
          <Text style={s.signName}>
            {profile?.firstName} {profile?.lastName}
          </Text>
          {profile?.company ? <Text style={s.signName}>{profile.company}</Text> : null}
          {signature ? <Image src={signature} style={s.signatureImg} /> : null}
          <View style={s.signLine} />
          <Text style={s.signHint}>Signature et cachet si société</Text>
        </View>
        <View style={[s.signCol, { marginHorizontal: 3 }]}>
          <Text style={s.signColTitle}>Locataire</Text>
          <Text style={s.signName}>
            {tenant.firstName} {tenant.lastName}
          </Text>
          <Text style={s.signName}>{tenant.email}</Text>
          <View style={s.signLine} />
          <Text style={s.signHint}>Signature précédée de la mention « Lu et approuvé »</Text>
        </View>
        <View style={s.signColSpacer} />
        <View style={s.signCol}>
          <Text style={s.signColTitle}>Caution</Text>
          <Text style={s.signName}>Nom et prénom</Text>
          <Text style={s.signName}>Adresse : ……………………………</Text>
          <View style={s.signLine} />
          <Text style={s.signHint}>Signature (si caution solidaire)</Text>
        </View>
      </View>
    </>
  );
}
