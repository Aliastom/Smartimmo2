import React from 'react';
import { Document, Page } from '@react-pdf/renderer';
import { resolveLeasePdfClauses, type LeasePdfClausesConfig } from './leasePdfClauses';
import { leasePdfStyles as s } from './leasePdfTheme';
import { normalizeLeasePdfBundle, type LeasePdfIncomingProps } from './leasePdfNormalize';
import { CoverPage } from './sections/CoverPage';
import { PartiesSection } from './sections/PartiesSection';
import { ObjetSection } from './sections/ObjetSection';
import { LogementSection } from './sections/LogementSection';
import { DureeSection } from './sections/DureeSection';
import { FinanceSection } from './sections/FinanceSection';
import {
  ClausesSectionConge,
  ClausesSectionIndemniteEtObligations,
} from './sections/ClausesSection';
import { ClausesAndSignatureContent } from './sections/ClausesAndSignaturePage';
import { LeasePdfPageFooter, LeasePdfPageHeader } from './sections/LeasePdfPageChrome';

export type LeasePdfProps = LeasePdfIncomingProps;

export type { LeasePdfClausesConfig };

const defaultClauses: LeasePdfClausesConfig = {
  reconductionTacite: true,
  clauseResolutoire: true,
  solidarite: false,
  rgpd: true,
  notificationsElectroniques: true,
  indemniteOccupation: true,
  annexesListe: true,
};

/**
 * PDF bail Smartimmo — sections modulaires sous `src/pdf/sections/`.
 * Pagination : clauses finales + signature sur une même <Page> (wrap React-PDF) pour éviter page blanche orpheline.
 */
const LeasePdf: React.FC<LeasePdfProps> = (props) => {
  const { lease, property, tenant, profile, branding, generatedAt } = normalizeLeasePdfBundle(props);
  const fromLease = resolveLeasePdfClauses(lease);
  const clauses: LeasePdfClausesConfig = { ...fromLease, ...props.clausesConfig };

  return (
    <Document>
      <CoverPage lease={lease} profile={profile} branding={branding} generatedAt={generatedAt} />

      <Page size="A4" style={s.page}>
        <LeasePdfPageHeader leaseId={lease.id} />
        <PartiesSection tenant={tenant} profile={profile} />
        <ObjetSection />
        <LogementSection lease={lease} property={property} />
        <LeasePdfPageFooter leaseId={lease.id} />
      </Page>

      <Page size="A4" style={s.page}>
        <LeasePdfPageHeader leaseId={lease.id} />
        <DureeSection lease={lease} clauses={clauses} />
        <FinanceSection lease={lease} />
        <LeasePdfPageFooter leaseId={lease.id} />
      </Page>

      <Page size="A4" style={s.page}>
        <LeasePdfPageHeader leaseId={lease.id} />
        <ClausesSectionConge lease={lease} />
        <ClausesSectionIndemniteEtObligations lease={lease} clauses={clauses} />
        <LeasePdfPageFooter leaseId={lease.id} />
      </Page>

      <Page size="A4" style={s.page}>
        <LeasePdfPageHeader leaseId={lease.id} />
        <ClausesAndSignatureContent
          lease={lease}
          clauses={clauses}
          tenant={tenant}
          property={property}
          profile={profile}
          generatedAt={generatedAt}
        />
        <LeasePdfPageFooter leaseId={lease.id} />
      </Page>
    </Document>
  );
};

export default LeasePdf;

export { defaultClauses as leasePdfDefaultClausesConfig };
