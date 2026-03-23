import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { leasePdfStyles as s } from '../leasePdfTheme';
import { computeLeaseDuration, frDate } from '../leasePdfUtils';
import type { LeasePdfClausesConfig } from '../leasePdfClauses';
import type { LeasePdfLease } from '../leasePdfTypes';

type Props = {
  lease: LeasePdfLease;
  clauses: LeasePdfClausesConfig;
};

export function DureeSection({ lease, clauses }: Props) {
  const { text } = computeLeaseDuration(lease);

  return (
    <>
      <View style={[s.sectionHeader, s.sectionHeaderPageLead]}>
        <Text style={s.sectionHeaderText}>4. Durée du bail</Text>
      </View>
      <View style={s.card}>
        <Text style={s.paragraph}>
          <Text style={{ fontWeight: 'bold' }}>Date de prise d’effet :</Text> {frDate(lease.startDate)}
        </Text>
        <Text style={s.paragraph}>
          <Text style={{ fontWeight: 'bold' }}>Date de fin :</Text> {frDate(lease.endDate)}
        </Text>
        <Text style={s.paragraph}>
          Le bail est conclu pour une durée de <Text style={{ fontWeight: 'bold' }}>{text}</Text>
          {lease.endDate ? ' (selon les dates contractuelles ci-dessus)' : ''}.
        </Text>
        {clauses.reconductionTacite ? (
          <Text style={s.paragraph}>
            À défaut de congé notifié dans les conditions légales, le bail sera reconduit tacitement aux mêmes conditions, sauf révision du loyer conformément
            aux stipulations du présent contrat et à la loi.
          </Text>
        ) : (
          <Text style={s.paragraph}>La reconduction tacite est exclue par accord exprès des parties (clause désactivée).</Text>
        )}
      </View>
    </>
  );
}
