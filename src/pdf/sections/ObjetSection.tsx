import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { leasePdfStyles as s } from '../leasePdfTheme';

export function ObjetSection() {
  return (
    <>
      <View style={s.sectionHeader}>
        <Text style={s.sectionHeaderText}>2. Objet du contrat</Text>
      </View>
      <View style={s.card}>
        <Text style={s.paragraph}>
          La présente location est consentie conformément aux dispositions du Code civil et, le cas échéant, de la loi n° 89-462 du 6 juillet 1989 tendant à
          améliorer les rapports locatifs, ainsi qu’aux textes applicables au type de bien concerné. Le présent contrat a pour objet la location du logement
          désigné ci-après, que le Locataire déclare connaître pour l’avoir visité.
        </Text>
      </View>
    </>
  );
}
