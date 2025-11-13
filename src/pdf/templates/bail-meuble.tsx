import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { LeaseData } from '../gapChecker';
import { formatMoney, formatDate } from '../format';
import { dataUrlToPdfSrc, formatDateFR } from '../helpers';

// Styles professionnels Smartimmo (identiques aux autres baux)
const styles = StyleSheet.create({
  page: {
    padding: '20mm',
    fontSize: 10.5,
    fontFamily: 'Helvetica',
    lineHeight: 1.4,
    color: '#1a1a1a',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#2F54EB',
    borderBottomStyle: 'solid',
    paddingBottom: 15,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2F54EB',
    textAlign: 'center',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 9,
    textAlign: 'center',
    color: '#666',
    marginBottom: 5,
  },
  headerAddress: {
    fontSize: 10,
    textAlign: 'center',
    color: '#333',
    fontWeight: 'bold',
  },
  sectionBanner: {
    backgroundColor: '#2F54EB',
    padding: '8pt 12pt',
    marginTop: 20,
    marginBottom: 12,
    marginHorizontal: -20,
  },
  sectionBannerText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  h2: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2F54EB',
    marginTop: 15,
    marginBottom: 8,
  },
  h3: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
    marginBottom: 6,
  },
  paragraph: {
    marginBottom: 8,
    textAlign: 'justify',
    lineHeight: 1.5,
  },
  paragraphBold: {
    fontWeight: 'bold',
  },
  list: {
    marginLeft: 25,
    marginTop: 6,
    marginBottom: 6,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  listBullet: {
    width: 25,
    fontWeight: 'bold',
  },
  listContent: {
    flex: 1,
    textAlign: 'justify',
    lineHeight: 1.5,
  },
  table: {
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2F54EB',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    minHeight: 28,
  },
  tableHeader: {
    backgroundColor: '#2F54EB',
    borderBottomColor: '#2F54EB',
  },
  tableHeaderText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 9.5,
  },
  tableCell: {
    padding: 6,
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    justifyContent: 'center',
  },
  tableCellLast: {
    padding: 6,
    flex: 1,
    justifyContent: 'center',
  },
  tableText: {
    fontSize: 9,
  },
  box: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#2F54EB',
    borderStyle: 'solid',
    padding: 12,
    marginTop: 12,
    marginBottom: 12,
  },
  boxTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2F54EB',
    marginBottom: 8,
  },
  boxContent: {
    fontSize: 9.5,
    lineHeight: 1.4,
  },
  signaturesContainer: {
    marginTop: 30,
    marginBottom: 20,
  },
  signaturesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  signatureBlock: {
    width: '30%',
  },
  signatureLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#2F54EB',
  },
  signatureField: {
    fontSize: 9,
    marginBottom: 5,
    textAlign: 'center',
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginTop: 40,
    paddingTop: 5,
  },
  signatureMention: {
    fontSize: 8,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 5,
    color: '#666',
  },
  footer: {
    position: 'absolute',
    bottom: 15,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#666',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    borderTopStyle: 'solid',
    paddingTop: 8,
  },
  footerLeft: {
    flex: 1,
  },
  footerCenter: {
    flex: 1,
    textAlign: 'center',
  },
  footerRight: {
    flex: 1,
    textAlign: 'right',
  },
  // Styles pour la signature
  signWrap: { 
    marginTop: 18 
  },
  signLabel: { 
    fontWeight: "bold" 
  },
  signImg: { 
    width: 120, 
    marginTop: 8 
  },
  signMeta: { 
    fontSize: 8, 
    color: "#555", 
    marginTop: 4 
  },
  signLine: { 
    borderBottomWidth: 1, 
    borderBottomColor: "#999", 
    borderBottomStyle: "dotted", 
    height: 28, 
    marginTop: 8 
  },
});

interface BailMeublePdfProps {
  data: LeaseData & {
    signature?: {
      includeSignature: boolean;
      ownerName: string;
      ownerCity: string;
      signatureUrl?: string;
      signedAt: string;
    };
  };
}

export function buildBailMeublePdf(data: BailMeublePdfProps) {
  const { landlord, tenant, property, lease } = data.data;

  const landlordFullAddress = [
    landlord?.address1,
    landlord?.address2,
    `${landlord?.postalCode} ${landlord?.city}`,
  ].filter(Boolean).join(', ');

  const propertyFullAddress = [
    property.address,
    `${property.postalCode} ${property.city}`,
  ].filter(Boolean).join(', ');

  const totalRent = (lease.rentAmount || 0) + (lease.charges || 0);
  const generationDate = formatDate(new Date());
  
  // Durée du bail (1 an ou 9 mois étudiant)
  const isStudent = lease.durationType === '9m';
  const durationMonths = isStudent ? 9 : 12;
  
  // Dépôt max 2 mois HC pour meublé
  const maxDeposit = (lease.rentAmount || 0) * 2;

  // Inventaire mobilier minimum légal (décret)
  const mobilierMinimum = [
    { item: 'Literie comprenant couette ou couverture', present: true, etat: 'Bon' },
    { item: 'Plaques de cuisson', present: true, etat: 'Bon' },
    { item: 'Four ou four à micro-ondes', present: true, etat: 'Bon' },
    { item: 'Réfrigérateur avec compartiment congélateur', present: true, etat: 'Bon' },
    { item: 'Vaisselle et ustensiles de cuisine', present: true, etat: 'Bon' },
    { item: 'Table et sièges', present: true, etat: 'Bon' },
    { item: 'Luminaires', present: true, etat: 'Bon' },
    { item: 'Rangements (penderie, étagères)', present: true, etat: 'Bon' },
    { item: 'Matériel d\'entretien ménager adapté', present: true, etat: 'Bon' },
  ];

  return (
    <Document>
      {/* PAGE 1 - Désignation */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            CONTRAT DE LOCATION – LOGEMENT MEUBLÉ
          </Text>
          <Text style={styles.headerSubtitle}>
            Loi du 6 juillet 1989 + Décret liste mobilier
          </Text>
          <Text style={styles.headerAddress}>
            {property.name} • {propertyFullAddress}
          </Text>
        </View>

        {/* DÉSIGNATION DES PARTIES */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>DÉSIGNATION DES PARTIES</Text>
        </View>

        <Text style={styles.paragraph}>
          Le présent contrat est conclu entre les soussignés :
        </Text>

        <Text style={{...styles.paragraph, fontWeight: 'bold', marginTop: 12}}>
          D'une part, le Bailleur
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.paragraphBold}>{landlord?.fullName || '[Nom]'}</Text>, demeurant au {landlordFullAddress || '[Adresse]'};
        </Text>

        <Text style={{...styles.paragraph, fontWeight: 'bold', marginTop: 12}}>
          Et d'autre part, le Locataire
        </Text>
        <Text style={styles.paragraph}>
          <Text style={styles.paragraphBold}>{tenant.firstName} {tenant.lastName}</Text>, {tenant.email};
        </Text>

        {/* DÉSIGNATION DU LOGEMENT */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>DÉSIGNATION DU LOGEMENT MEUBLÉ</Text>
        </View>

        <Text style={styles.h3}>Adresse et caractéristiques</Text>
        <View style={styles.list}>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>Adresse : <Text style={styles.paragraphBold}>{propertyFullAddress}</Text></Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>Surface habitable : <Text style={styles.paragraphBold}>{property.surface} m²</Text></Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>Nombre de pièces principales : <Text style={styles.paragraphBold}>{property.rooms}</Text></Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>Type : Logement meublé à usage d'habitation exclusive</Text>
          </View>
        </View>

        <Text style={styles.h3}>Destination</Text>
        <Text style={styles.paragraph}>
          Les lieux sont loués meublés et destinés à l'<Text style={styles.paragraphBold}>habitation exclusive du locataire</Text>, qui y établira sa résidence principale ou secondaire.
        </Text>

        {/* DURÉE */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>DURÉE DU CONTRAT</Text>
        </View>

        <Text style={styles.paragraph}>
          Le contrat prend effet le <Text style={styles.paragraphBold}>{formatDate(lease.startDate)}</Text>{' '}
          pour une durée de <Text style={styles.paragraphBold}>{durationMonths} mois</Text>{' '}
          {isStudent ? (
            <>(bail étudiant non renouvelable par tacite reconduction)</>
          ) : (
            <>(renouvelable tacitement par périodes de 12 mois)</>
          )}.
        </Text>

        <Text style={styles.h3}>Préavis</Text>
        <Text style={styles.paragraph}>
          Le locataire peut résilier à tout moment avec un préavis de <Text style={styles.paragraphBold}>un (1) mois</Text> par lettre recommandée AR.
          Le bailleur peut donner congé avec <Text style={styles.paragraphBold}>trois (3) mois</Text> de préavis, uniquement à l'échéance.
        </Text>

        {/* Pied de page */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>Smartimmo</Text>
          <Text style={styles.footerCenter}>{property.name}</Text>
          <Text style={styles.footerRight} render={({ pageNumber, totalPages }) => `Page ${pageNumber}/${totalPages} — Paraphe : __________`} />
        </View>
      </Page>

      {/* PAGE 2 - Conditions financières */}
      <Page size="A4" style={styles.page}>
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>CONDITIONS FINANCIÈRES</Text>
        </View>

        {/* Tableau */}
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <View style={styles.tableCell}>
              <Text style={styles.tableHeaderText}>Loyer HC</Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={styles.tableHeaderText}>Charges</Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={styles.tableHeaderText}>Total</Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={styles.tableHeaderText}>Dépôt (≤2 mois)</Text>
            </View>
            <View style={styles.tableCellLast}>
              <Text style={styles.tableHeaderText}>Paiement</Text>
            </View>
          </View>
          <View style={styles.tableRow}>
            <View style={styles.tableCell}>
              <Text style={styles.tableText}>{formatMoney(lease.rentAmount)}</Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={styles.tableText}>
                {lease.charges ? `${formatMoney(lease.charges)} (forfait)` : 'Incluses'}
              </Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={{...styles.tableText, fontWeight: 'bold'}}>{formatMoney(totalRent)}</Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={styles.tableText}>{formatMoney(lease.deposit || 0)}</Text>
            </View>
            <View style={styles.tableCellLast}>
              <Text style={styles.tableText}>Le {lease.paymentDay || 1} du mois</Text>
            </View>
          </View>
        </View>

        <Text style={styles.h2}>Loyer et révision</Text>
        <Text style={styles.paragraph}>
          Le loyer mensuel charges comprises est fixé à <Text style={styles.paragraphBold}>{formatMoney(totalRent)}</Text>, payable d'avance le{' '}
          <Text style={styles.paragraphBold}>{lease.paymentDay || 1}</Text> de chaque mois par virement bancaire.
        </Text>
        <Text style={styles.paragraph}>
          Le loyer pourra être révisé annuellement selon l'évolution de l'Indice de Référence des Loyers (IRL) publié par l'INSEE.
        </Text>

        <Text style={styles.h2}>Charges</Text>
        {lease.charges && lease.charges > 0 ? (
          <Text style={styles.paragraph}>
            Les charges sont fixées à un forfait mensuel de <Text style={styles.paragraphBold}>{formatMoney(lease.charges)}</Text> et ne donnent pas lieu à régularisation.
            Ce forfait couvre les dépenses courantes (eau, électricité commune, entretien).
          </Text>
        ) : (
          <Text style={styles.paragraph}>
            Les charges sont <Text style={styles.paragraphBold}>incluses dans le loyer</Text> et ne font pas l'objet d'un forfait séparé.
          </Text>
        )}

        <Text style={styles.h2}>Dépôt de garantie</Text>
        <Text style={styles.paragraph}>
          Un dépôt de garantie de <Text style={styles.paragraphBold}>{formatMoney(lease.deposit || 0)}</Text> (maximum deux mois de loyer hors charges)
          est versé à la signature. Il sera restitué dans un délai d'un (1) mois après restitution des clés, déduction faite des sommes
          éventuellement dues.
        </Text>

        {/* Pied de page */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>Smartimmo</Text>
          <Text style={styles.footerCenter}>{property.name}</Text>
          <Text style={styles.footerRight} render={({ pageNumber, totalPages }) => `Page ${pageNumber}/${totalPages} — Paraphe : __________`} />
        </View>
      </Page>

      {/* PAGE 3 - Inventaire du mobilier */}
      <Page size="A4" style={styles.page}>
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>INVENTAIRE DU MOBILIER (DÉCRET)</Text>
        </View>

        <Text style={styles.paragraph}>
          Conformément au décret n°2015-981 du 31 juillet 2015, le logement meublé doit comporter au minimum les équipements suivants :
        </Text>

        {/* Tableau inventaire */}
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <View style={{...styles.tableCell, flex: 2}}>
              <Text style={styles.tableHeaderText}>Équipement</Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={styles.tableHeaderText}>Présent</Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={styles.tableHeaderText}>État</Text>
            </View>
            <View style={{...styles.tableCellLast, flex: 1.5}}>
              <Text style={styles.tableHeaderText}>Observations</Text>
            </View>
          </View>
          {mobilierMinimum.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <View style={{...styles.tableCell, flex: 2}}>
                <Text style={styles.tableText}>{item.item}</Text>
              </View>
              <View style={styles.tableCell}>
                <Text style={styles.tableText}>{item.present ? '☑' : '☐'}</Text>
              </View>
              <View style={styles.tableCell}>
                <Text style={styles.tableText}>{item.etat}</Text>
              </View>
              <View style={{...styles.tableCellLast, flex: 1.5}}>
                <Text style={styles.tableText}>—</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={{fontSize: 9, fontStyle: 'italic', color: '#666', marginTop: 10}}>
          Note : Un inventaire détaillé contradictoire sera établi lors de l'état des lieux d'entrée.
        </Text>

        {/* Pied de page */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>Smartimmo</Text>
          <Text style={styles.footerCenter}>{property.name}</Text>
          <Text style={styles.footerRight} render={({ pageNumber, totalPages }) => `Page ${pageNumber}/${totalPages} — Paraphe : __________`} />
        </View>
      </Page>

      {/* PAGE 4 - Obligations et clauses */}
      <Page size="A4" style={styles.page}>
        {/* OBLIGATIONS */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>OBLIGATIONS DES PARTIES</Text>
        </View>

        <Text style={styles.h2}>Obligations du Bailleur</Text>
        <View style={styles.list}>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>
              Remettre au locataire un logement décent et meublé conforme au décret, en bon état d'usage.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>
              Assurer la jouissance paisible et garantir contre les vices cachés.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>
              Effectuer les grosses réparations (art. 606 du Code civil).
            </Text>
          </View>
        </View>

        <Text style={styles.h2}>Obligations du Locataire</Text>
        <View style={styles.list}>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>Payer le loyer et charges aux échéances convenues.</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>User paisiblement des lieux et du mobilier avec soin.</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>Souscrire une assurance habitation contre les risques locatifs et en justifier annuellement.</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>Prendre en charge l'entretien courant du logement et du mobilier.</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>Restituer les lieux et le mobilier en bon état (vétusté normale exceptée).</Text>
          </View>
        </View>

        <Text style={styles.h2}>Clause résolutoire</Text>
        <Text style={styles.paragraph}>
          À défaut de paiement d'un seul terme aux échéances convenues, ou en cas de non-respect des obligations, et un mois après un
          commandement demeuré infructueux, le bail sera résilié de plein droit.
        </Text>

        {/* Encadré */}
        <View style={styles.box}>
          <Text style={styles.boxTitle}>⚠️ SPÉCIFICITÉS LOGEMENT MEUBLÉ</Text>
          <Text style={styles.boxContent}>
            • Durée : {durationMonths} mois{isStudent ? ' (étudiant)' : ' (renouvelable)'}{'\n'}
            • Préavis locataire : 1 mois (vs 3 mois pour vide){'\n'}
            • Dépôt max : 2 mois HC (vs 1 mois pour vide){'\n'}
            • Inventaire mobilier obligatoire (décret 2015-981)
          </Text>
        </View>

        {/* Pied de page */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>Smartimmo</Text>
          <Text style={styles.footerCenter}>{property.name}</Text>
          <Text style={styles.footerRight} render={({ pageNumber, totalPages }) => `Page ${pageNumber}/${totalPages} — Paraphe : __________`} />
        </View>
      </Page>

      {/* PAGE 5 - Annexes et signatures */}
      <Page size="A4" style={styles.page}>
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>ANNEXES ET DOCUMENTS REMIS</Text>
        </View>

        <Text style={styles.paragraph}>
          Les documents suivants sont annexés ou remis au locataire :
        </Text>

        <View style={styles.list}>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>☑</Text>
            <Text style={styles.listContent}>Diagnostic de Performance Énergétique (DPE)</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>☑</Text>
            <Text style={styles.listContent}>État des Risques et Pollutions (ERP)</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>☑</Text>
            <Text style={styles.listContent}>Surface habitable (loi Boutin)</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>☑</Text>
            <Text style={styles.listContent}>Notice d'information sur les droits et devoirs</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>☑</Text>
            <Text style={styles.listContent}>État des lieux d'entrée contradictoire</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>☑</Text>
            <Text style={styles.listContent}>Inventaire du mobilier détaillé et signé</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>☐</Text>
            <Text style={styles.listContent}>CREP (si logement construit avant 1949)</Text>
          </View>
        </View>

        {lease.notes && (
          <>
            <Text style={styles.h2}>Clauses particulières</Text>
            <Text style={styles.paragraph}>{lease.notes}</Text>
          </>
        )}

        {/* SIGNATURES */}
        <View style={styles.signaturesContainer}>
          <Text style={{...styles.paragraph, textAlign: 'center', fontWeight: 'bold', marginBottom: 15}}>
            Fait à {property.city || '__________'}, le {generationDate}
          </Text>
          <Text style={{fontSize: 9, textAlign: 'center', marginBottom: 20, fontStyle: 'italic', color: '#666'}}>
            En deux (2) exemplaires originaux dont un pour chaque partie
          </Text>

          <View style={styles.signaturesRow}>
            <View style={styles.signatureBlock}>
              <Text style={styles.signatureLabel}>LE BAILLEUR</Text>
              <Text style={styles.signatureField}>{landlord?.fullName || '[Nom]'}</Text>
              <Text style={styles.signatureField}>{landlord?.email || '[Email]'}</Text>
              
              {/* Section signature du bailleur */}
              <View style={styles.signWrap}>
                <Text style={styles.signLabel}>Signature du bailleur :</Text>
                {data.data.signature?.signatureUrl ? (
                  <>
                    <Image src={dataUrlToPdfSrc(data.data.signature.signatureUrl)} style={styles.signImg} />
                    <Text style={styles.signMeta}>
                      Signé électroniquement par {data.data.signature.ownerName} – Fait à {data.data.signature.ownerCity}, le {formatDateFR(data.data.signature.signedAt)}
                    </Text>
                  </>
                ) : (
                  <View style={styles.signLine} />
                )}
              </View>
              
              <Text style={styles.signatureMention}>"Bon pour accord"</Text>
            </View>

            <View style={styles.signatureBlock}>
              <Text style={styles.signatureLabel}>LE LOCATAIRE</Text>
              <Text style={styles.signatureField}>{tenant.firstName} {tenant.lastName}</Text>
              <Text style={styles.signatureField}>{tenant.email}</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureMention}>"Lu et approuvé"</Text>
            </View>

            <View style={styles.signatureBlock}>
              <Text style={styles.signatureLabel}>LA CAUTION</Text>
              <Text style={styles.signatureField}>(si applicable)</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureMention}>"Bon pour caution"</Text>
            </View>
          </View>
        </View>

        {/* Mentions légales */}
        <View style={{marginTop: 30, padding: 10, backgroundColor: '#f9fafb', borderRadius: 4}}>
          <Text style={{fontSize: 8, color: '#666', textAlign: 'center', lineHeight: 1.3}}>
            Document généré automatiquement par Smartimmo le {generationDate}{'\n'}
            Contrat soumis à la loi n°89-462 du 6 juillet 1989 et au décret n°2015-981 du 31 juillet 2015{'\n'}
            Avec Smartimmo, gérez vos biens en toute sérénité
          </Text>
        </View>

        {/* Pied de page */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>Smartimmo</Text>
          <Text style={styles.footerCenter}>{property.name}</Text>
          <Text style={styles.footerRight} render={({ pageNumber, totalPages }) => `Page ${pageNumber}/${totalPages} — Paraphe : __________`} />
        </View>
      </Page>
    </Document>
  );
}

export default buildBailMeublePdf;

