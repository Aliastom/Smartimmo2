import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { leasePdfStyles as s } from '../leasePdfTheme';
import { euro } from '../leasePdfUtils';
import { getRentRevisionParagraph } from '../leasePdfRentRevision';
import type { LeasePdfLease } from '../leasePdfTypes';

type Props = {
  lease: LeasePdfLease;
};

export function FinanceSection({ lease }: Props) {
  const loyer = Number(lease.rentAmount ?? 0);
  const charges = Number(lease.chargesRecupMensuelles ?? 0);
  const total = loyer + charges;
  const revisionText = getRentRevisionParagraph(lease.indexationType);

  return (
    <>
      <View style={s.sectionHeader}>
        <Text style={s.sectionHeaderText}>5. Conditions financières</Text>
      </View>
      <View style={s.table}>
        <View style={s.tableHead}>
          <Text style={s.tableHeadCell}>Libellé</Text>
          <Text style={[s.tableHeadCell, { textAlign: 'right' }]}>Montant</Text>
        </View>
        <View style={s.tableRow}>
          <Text style={s.tableCell}>Loyer hors charges</Text>
          <Text style={s.tableCellRight}>{euro(loyer)}</Text>
        </View>
        <View style={s.tableRow}>
          <Text style={s.tableCell}>Provisions ou charges récupérables</Text>
          <Text style={s.tableCellRight}>{euro(charges)}</Text>
        </View>
        <View style={s.tableRow}>
          <Text style={s.tableCell}>Total mensuel dû par le Locataire</Text>
          <Text style={s.tableCellRight}>{euro(total)}</Text>
        </View>
        <View style={[s.tableRow, s.tableRowLast]}>
          <Text style={s.tableCell}>Dépôt de garantie (hors charges)</Text>
          <Text style={s.tableCellRight}>{euro(lease.deposit)}</Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.subTitle}>Modalités de paiement</Text>
        <Text style={s.paragraph}>
          Le loyer et les accessoires sont payables mensuellement et à terme à échoir, au plus tard le {lease.paymentDay || 1} de chaque mois, par virement ou
          tout autre mode convenu entre les parties. Tout retard de paiement pourra entraîner des pénalités et intérêts dans les conditions légales.
        </Text>
        <Text style={s.subTitle}>Révision du loyer</Text>
        <Text style={s.paragraph}>{revisionText}</Text>
      </View>

      <View style={s.sectionHeader}>
        <Text style={s.sectionHeaderText}>6. Dépôt de garantie</Text>
      </View>
      <View style={s.card}>
        <Text style={s.paragraph}>
          Un dépôt de garantie d’un montant de <Text style={{ fontWeight: 'bold' }}>{euro(lease.deposit)}</Text> est versé à la signature. Il ne produit pas
          d’intérêts. Il ne pourra en aucun cas être imputé sur le paiement des loyers ou des charges pendant la durée du bail. Il sera restitué dans un délai
          d’un mois après la restitution des clés, déduction faite, le cas échéant, des sommes restant dues et des indemnités légitimes.
        </Text>
      </View>
    </>
  );
}
