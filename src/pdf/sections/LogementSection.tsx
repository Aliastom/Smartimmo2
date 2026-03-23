import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { leasePdfStyles as s } from '../leasePdfTheme';
import { joinAddress, propertyTypeLabel } from '../leasePdfUtils';
import type { LeasePdfLease, LeasePdfProperty } from '../leasePdfTypes';

type Props = {
  lease: LeasePdfLease;
  property: LeasePdfProperty;
};

export function LogementSection({ lease, property }: Props) {
  const propertyAddress = joinAddress(property.address, property.postalCode, property.city);

  return (
    <>
      <View style={s.sectionHeader}>
        <Text style={s.sectionHeaderText}>3. Désignation du logement</Text>
      </View>
      <View style={s.card}>
        <Text style={s.paragraph}>
          <Text style={{ fontWeight: 'bold' }}>Dénomination :</Text> {property.name}
        </Text>
        <Text style={s.paragraph}>
          <Text style={{ fontWeight: 'bold' }}>Adresse complète :</Text> {propertyAddress}
        </Text>
        <Text style={s.paragraph}>
          <Text style={{ fontWeight: 'bold' }}>Type :</Text> {propertyTypeLabel(lease.type)}
        </Text>
        <Text style={s.paragraph}>
          <Text style={{ fontWeight: 'bold' }}>Surface habitable (indicative) :</Text> {property.surface != null ? `${property.surface} m²` : 'Non renseignée'}
        </Text>
        <Text style={s.paragraph}>
          <Text style={{ fontWeight: 'bold' }}>Nombre de pièces principales :</Text> {property.rooms != null ? String(property.rooms) : 'Non renseigné'}
        </Text>
      </View>
    </>
  );
}
