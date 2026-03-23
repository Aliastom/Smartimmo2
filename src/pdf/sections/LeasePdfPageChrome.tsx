import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { leasePdfStyles as s } from '../leasePdfTheme';

export function LeasePdfPageHeader({ leaseId }: { leaseId: string }) {
  return (
    <View style={s.pageHeader} fixed>
      <Text style={s.pageHeaderBrand}>Smartimmo</Text>
      <Text style={s.pageHeaderRef}>Réf. bail #{leaseId.slice(0, 8)}…</Text>
    </View>
  );
}

export function LeasePdfPageFooter({ leaseId }: { leaseId: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>Smartimmo — document contractuel</Text>
      <Text style={s.footerText}>Bail #{leaseId}</Text>
      <Text style={s.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  );
}
