import React from 'react';
import { View } from '@react-pdf/renderer';
import { leasePdfStyles as s } from '../leasePdfTheme';
import type { LeasePdfClausesConfig } from '../leasePdfClauses';
import type { LeasePdfLease, LeasePdfProfile, LeasePdfProperty, LeasePdfTenant } from '../leasePdfTypes';
import { ClausesSectionPart2 } from './ClausesSection';
import { SignatureSection } from './SignatureSection';

type Props = {
  lease: LeasePdfLease;
  clauses: LeasePdfClausesConfig;
  tenant: LeasePdfTenant;
  property: LeasePdfProperty;
  profile?: LeasePdfProfile;
  generatedAt?: string;
};

/**
 * Une seule <Page> : clauses 10+ puis signatures — évite une page blanche orpheline
 * (wrap React-PDF entre deux <Page> séparées).
 */
export function ClausesAndSignatureContent(props: Props) {
  const { lease, clauses, tenant, property, profile, generatedAt } = props;

  return (
    <>
      <ClausesSectionPart2 lease={lease} clauses={clauses} />
      <View wrap={false} style={s.signatureWrap}>
        <SignatureSection tenant={tenant} property={property} profile={profile} generatedAt={generatedAt} />
      </View>
    </>
  );
}
