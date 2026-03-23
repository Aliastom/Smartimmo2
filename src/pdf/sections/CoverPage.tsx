import React from 'react';
import { Page, Text, View, Image } from '@react-pdf/renderer';
import { dataUrlToPdfSrc } from '../helpers';
import { leasePdfStyles as s } from '../leasePdfTheme';
import { frDate, joinAddress, leaseTypeTitle } from '../leasePdfUtils';
import type { LeasePdfBranding, LeasePdfLease, LeasePdfProfile } from '../leasePdfTypes';
import { SmartimmoBrandMark } from './SmartimmoBrandMark';
import { getLogoPdfUrl } from '@/lib/branding';

type Props = {
  lease: LeasePdfLease;
  profile?: LeasePdfProfile;
  branding?: LeasePdfBranding;
  generatedAt?: string;
};

export function CoverPage({ lease, profile, branding, generatedAt }: Props) {
  const logoSrc =
    dataUrlToPdfSrc(branding?.logoUrl ?? undefined) ||
    dataUrlToPdfSrc(profile?.logo) ||
    getLogoPdfUrl();
  const profileAddress = joinAddress(profile?.address, profile?.postalCode, profile?.city);
  const genLabel = frDate(generatedAt ?? new Date().toISOString());
  const agencyName =
    profile?.company?.trim() ||
    `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim() ||
    'Smartimmo';

  return (
    <Page size="A4" style={s.coverPage}>
      <View style={s.coverHero}>
        <Image
          src="https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?q=80&w=1600&auto=format&fit=crop"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </View>
      <View style={s.coverOverlay1} />
      <View style={s.coverOverlay2} />
      <View style={s.coverAccentBar} />

      <View style={s.coverBody}>
        <View style={s.coverMainRow}>
          <View style={s.coverLogoColumn}>
            {logoSrc ? (
              <View style={s.logoCard}>
                <Image src={logoSrc} style={s.logoImage} />
              </View>
            ) : (
              <View style={s.logoCardBrand}>
                <SmartimmoBrandMark />
              </View>
            )}
          </View>

          <View style={s.coverRightColumn}>
            <View style={s.agencyCard}>
              <Text style={s.agencyEyebrow}>BAILLEUR & AGENCE</Text>
              <Text style={s.agencyTitle}>{agencyName}</Text>
              {profileAddress ? <Text style={s.agencyLine}>{profileAddress}</Text> : null}
              {profile?.phone ? <Text style={s.agencyLine}>{profile.phone}</Text> : null}
              {profile?.email ? <Text style={s.agencyLine}>{profile.email}</Text> : null}
            </View>

            <View style={s.coverTitleBlock}>
              <Text style={s.coverTitleHint}>CONTRAT DE LOCATION</Text>
              <View style={s.coverTitleRule} />
              <Text style={s.coverTitle}>{leaseTypeTitle(lease.type, lease.furnishedType)}</Text>
              <Text style={s.coverSubtitle}>Document émis le {genLabel}</Text>
            </View>
          </View>
        </View>

        <Text style={s.coverMeta}>
          Document préparé via Smartimmo — outil de gestion locative. Contenu à valider par un professionnel avant toute signature.
        </Text>
      </View>
    </Page>
  );
}
