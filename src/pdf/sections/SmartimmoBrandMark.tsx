import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { leasePdfStyles as s } from '../leasePdfTheme';

/**
 * Fallback sans logo fichier : monogramme discret + wordmark — priorité à branding.logoUrl / profile.logo si fournis.
 */
export function SmartimmoBrandMark() {
  return (
    <View style={s.brandMarkInner}>
      <View style={s.brandMonogramCircle}>
        <Text style={s.brandMonogramLetter}>S</Text>
      </View>
      <Text style={s.brandWordmark}>Smartimmo</Text>
      <Text style={s.brandTagline}>gestion immobilière</Text>
    </View>
  );
}
