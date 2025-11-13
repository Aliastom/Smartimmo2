import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { LeaseData } from '../gapChecker';
import { formatMoney, formatDate } from '../format';
import { dataUrlToPdfSrc, formatDateFR } from '../helpers';

// Styles professionnels Smartimmo (identiques au bail vide)
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
    minHeight: 30,
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
    padding: 8,
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    justifyContent: 'center',
  },
  tableCellLast: {
    padding: 8,
    flex: 1,
    justifyContent: 'center',
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
    width: '45%',
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

interface BailGaragePdfProps {
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

export function buildBailGaragePdf(data: BailGaragePdfProps) {
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

  return (
    <Document>
      {/* PAGE 1 - Désignation et conditions */}
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            CONTRAT DE LOCATION – GARAGE / PARKING
          </Text>
          <Text style={styles.headerSubtitle}>
            Contrat de droit commun (Code civil)
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
          D'une part,
        </Text>
        <Text style={{...styles.paragraph, fontWeight: 'bold'}}>Le Bailleur</Text>
        <Text style={styles.paragraph}>
          <Text style={styles.paragraphBold}>{landlord?.fullName || '[Nom du bailleur]'}</Text>, demeurant au {landlordFullAddress || '[Adresse du bailleur]'};
        </Text>
        <Text style={styles.paragraph}>
          Email : {landlord?.email || '[Email]'} • Téléphone : {landlord?.phone || '[Non renseigné]'}
        </Text>
        <Text style={styles.paragraph}>
          Désigné ci-après, le <Text style={styles.paragraphBold}>"Bailleur"</Text>;
        </Text>

        <Text style={{...styles.paragraph, fontWeight: 'bold', marginTop: 12}}>
          Et, d'autre part,
        </Text>
        <Text style={{...styles.paragraph, fontWeight: 'bold'}}>Le Locataire</Text>
        <Text style={styles.paragraph}>
          <Text style={styles.paragraphBold}>{tenant.firstName} {tenant.lastName}</Text>, demeurant {propertyFullAddress};
        </Text>
        <Text style={styles.paragraph}>
          Email : {tenant.email} • Téléphone : {tenant.phone || '[Non renseigné]'}
        </Text>
        <Text style={styles.paragraph}>
          désigné ci-après le <Text style={styles.paragraphBold}>"Locataire"</Text>.
        </Text>

        <Text style={{...styles.paragraph, marginTop: 15, fontWeight: 'bold', textAlign: 'center'}}>
          Il a été arrêté et convenu ce qui suit
        </Text>

        {/* DÉSIGNATION DU GARAGE */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>DÉSIGNATION DE L'EMPLACEMENT</Text>
        </View>

        <Text style={styles.paragraph}>
          Le bailleur met à disposition du locataire, qui l'accepte, un emplacement de stationnement ainsi désigné :
        </Text>

        <View style={styles.list}>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>Désignation : <Text style={styles.paragraphBold}>{property.name}</Text></Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>Adresse : <Text style={styles.paragraphBold}>{propertyFullAddress}</Text></Text>
          </View>
          {property.surface && (
            <View style={styles.listItem}>
              <Text style={styles.listBullet}>•</Text>
              <Text style={styles.listContent}>Surface approximative : {property.surface} m²</Text>
            </View>
          )}
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>Type : ☐ Garage fermé ☐ Box ☐ Parking extérieur</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>Accès : ☐ Clé ☐ Badge ☐ Télécommande</Text>
          </View>
        </View>

        {/* DESTINATION */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>DESTINATION ET USAGE</Text>
        </View>

        <Text style={styles.paragraph}>
          L'emplacement loué est destiné <Text style={styles.paragraphBold}>exclusivement au stationnement d'un véhicule automobile</Text>.
        </Text>

        <Text style={styles.h3}>Interdictions formelles :</Text>
        <View style={styles.list}>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>✗</Text>
            <Text style={styles.listContent}>Utilisation comme habitation, même temporaire</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>✗</Text>
            <Text style={styles.listContent}>Stockage de matières inflammables ou dangereuses</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>✗</Text>
            <Text style={styles.listContent}>Usage comme atelier de réparation ou commerce</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>✗</Text>
            <Text style={styles.listContent}>Sous-location ou cession sans accord écrit du bailleur</Text>
          </View>
        </View>

        {/* DURÉE */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>DURÉE DU CONTRAT</Text>
        </View>

        <Text style={styles.paragraph}>
          Le présent contrat prend effet le <Text style={styles.paragraphBold}>{formatDate(lease.startDate)}</Text>{' '}
          pour une durée de <Text style={styles.paragraphBold}>douze (12) mois</Text>.
        </Text>
        <Text style={styles.paragraph}>
          À défaut de dénonciation par l'une des parties avec un préavis de <Text style={styles.paragraphBold}>{lease.noticeMonths || 1} mois</Text>,
          le contrat sera reconduit tacitement pour des périodes successives de douze (12) mois.
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
        {/* CONDITIONS FINANCIÈRES */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>CONDITIONS FINANCIÈRES</Text>
        </View>

        {/* Tableau récapitulatif */}
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <View style={styles.tableCell}>
              <Text style={styles.tableHeaderText}>Loyer</Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={styles.tableHeaderText}>Charges (forfait)</Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={styles.tableHeaderText}>Total</Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={styles.tableHeaderText}>Dépôt</Text>
            </View>
            <View style={styles.tableCellLast}>
              <Text style={styles.tableHeaderText}>Paiement</Text>
            </View>
          </View>
          <View style={styles.tableRow}>
            <View style={styles.tableCell}>
              <Text>{formatMoney(lease.rentAmount)}</Text>
            </View>
            <View style={styles.tableCell}>
              <Text>{lease.charges ? formatMoney(lease.charges) : 'Incluses'}</Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={styles.paragraphBold}>{formatMoney(totalRent)}</Text>
            </View>
            <View style={styles.tableCell}>
              <Text>{formatMoney(lease.deposit || 0)}</Text>
            </View>
            <View style={styles.tableCellLast}>
              <Text>Le {lease.paymentDay || 1} du mois</Text>
            </View>
          </View>
        </View>

        <Text style={styles.h2}>Loyer et mode de paiement</Text>
        <Text style={styles.paragraph}>
          Le loyer mensuel est fixé à <Text style={styles.paragraphBold}>{formatMoney(lease.rentAmount)}</Text>.
        </Text>
        {lease.charges && lease.charges > 0 ? (
          <Text style={styles.paragraph}>
            Un forfait mensuel de charges de <Text style={styles.paragraphBold}>{formatMoney(lease.charges)}</Text> s'ajoute au loyer,
            couvrant notamment l'électricité commune et l'entretien des parties communes.
          </Text>
        ) : (
          <Text style={styles.paragraph}>
            Les charges éventuelles (électricité commune, entretien) sont <Text style={styles.paragraphBold}>incluses</Text> dans le loyer.
          </Text>
        )}
        <Text style={styles.paragraph}>
          Le paiement sera effectué par virement bancaire le <Text style={styles.paragraphBold}>{lease.paymentDay || 1}</Text> de chaque mois,
          d'avance et sans demande préalable.
        </Text>

        <Text style={styles.h2}>Révision du loyer</Text>
        <Text style={styles.paragraph}>
          {lease.indexationType && lease.indexationType !== 'none' ? (
            <>
              Le loyer sera révisé annuellement selon l'évolution de l'<Text style={styles.paragraphBold}>Indice de Référence des Loyers (IRL)</Text> publié par l'INSEE,
              à la date anniversaire du bail.
            </>
          ) : (
            <>Le loyer est fixe et ne fera pas l'objet de révision automatique.</>
          )}
        </Text>

        <Text style={styles.h2}>Dépôt de garantie</Text>
        {lease.deposit && lease.deposit > 0 ? (
          <>
            <Text style={styles.paragraph}>
              Un dépôt de garantie d'un montant de <Text style={styles.paragraphBold}>{formatMoney(lease.deposit)}</Text> est versé
              à la signature du présent contrat.
            </Text>
            <Text style={styles.paragraph}>
              Il sera restitué dans un délai d'un (1) mois après restitution des clés/badges, déduction faite des sommes
              éventuellement dues au bailleur (loyers impayés, dégradations).
            </Text>
          </>
        ) : (
          <Text style={styles.paragraph}>
            Aucun dépôt de garantie n'est demandé pour cette location.
          </Text>
        )}

        {/* Encadré clauses importantes */}
        <View style={styles.box}>
          <Text style={styles.boxTitle}>⚠️ POINTS IMPORTANTS</Text>
          <Text style={styles.boxContent}>
            • <Text style={styles.paragraphBold}>Usage :</Text> Stationnement d'un véhicule uniquement{'\n'}
            • <Text style={styles.paragraphBold}>Préavis :</Text> {lease.noticeMonths || 1} mois par lettre recommandée AR{'\n'}
            • <Text style={styles.paragraphBold}>Responsabilité :</Text> Le bailleur ne garantit pas contre le vol ou les dégâts{'\n'}
            • <Text style={styles.paragraphBold}>Assurance RC :</Text> Vivement recommandée pour le locataire
          </Text>
        </View>

        {/* Pied de page */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>Smartimmo</Text>
          <Text style={styles.footerCenter}>{property.name}</Text>
          <Text style={styles.footerRight} render={({ pageNumber, totalPages }) => `Page ${pageNumber}/${totalPages} — Paraphe : __________`} />
        </View>
      </Page>

      {/* PAGE 3 - Obligations et clauses */}
      <Page size="A4" style={styles.page}>
        {/* OBLIGATIONS ET RESPONSABILITÉS */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>OBLIGATIONS ET RESPONSABILITÉS</Text>
        </View>

        <Text style={styles.h2}>Obligations du Bailleur</Text>
        <View style={styles.list}>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>
              Mettre à disposition l'emplacement dans l'état où il se trouve, sans garantie d'étanchéité, isolation ou sécurité particulière.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>
              Assurer la jouissance paisible de l'emplacement loué, sauf cas de force majeure.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>
              Entretenir les parties communes et équipements collectifs (si applicable).
            </Text>
          </View>
        </View>

        <Text style={styles.h2}>Obligations du Locataire</Text>
        <View style={styles.list}>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>
              Payer le loyer aux échéances convenues.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>
              Utiliser l'emplacement conformément à sa destination (stationnement véhicule uniquement).
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>
              Ne pas gêner la circulation dans les parties communes.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>
              Souscrire une assurance responsabilité civile couvrant les dommages causés aux tiers et en justifier au bailleur.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>
              Restituer les clés/badges en fin de bail. Frais de remplacement en cas de perte : 50 €.
            </Text>
          </View>
        </View>

        <Text style={styles.h2}>Limitations de responsabilité</Text>
        <Text style={styles.paragraph}>
          Le bailleur <Text style={styles.paragraphBold}>ne garantit pas</Text> le locataire contre :
        </Text>
        <View style={styles.list}>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>−</Text>
            <Text style={styles.listContent}>Le vol, l'effraction ou la détérioration du véhicule stationné;</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>−</Text>
            <Text style={styles.listContent}>Les dommages causés par incendie, dégât des eaux ou tout autre sinistre;</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>−</Text>
            <Text style={styles.listContent}>Les dommages causés par des tiers ou des véhicules tiers.</Text>
          </View>
        </View>
        <Text style={styles.paragraph}>
          Le locataire est invité à souscrire une assurance tous risques couvrant son véhicule et sa responsabilité civile.
        </Text>

        <Text style={styles.h2}>Résiliation et congé</Text>
        <Text style={styles.paragraph}>
          Chacune des parties peut résilier le contrat à tout moment en respectant un préavis de{' '}
          <Text style={styles.paragraphBold}>{lease.noticeMonths || 1} mois</Text>, donné par lettre recommandée avec accusé de réception.
        </Text>
        <Text style={styles.paragraph}>
          Le préavis court à compter de la date de réception de la lettre de congé.
        </Text>

        <Text style={styles.h2}>Clause résolutoire</Text>
        <Text style={styles.paragraph}>
          À défaut de paiement d'un seul terme de loyer à son échéance, et quinze (15) jours après un commandement de payer
          demeuré infructueux, le présent bail sera <Text style={styles.paragraphBold}>résilié de plein droit</Text>.
        </Text>

        {/* Pied de page */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>Smartimmo</Text>
          <Text style={styles.footerCenter}>{property.name}</Text>
          <Text style={styles.footerRight} render={({ pageNumber, totalPages }) => `Page ${pageNumber}/${totalPages} — Paraphe : __________`} />
        </View>
      </Page>

      {/* PAGE 4 - Annexes et signatures */}
      <Page size="A4" style={styles.page}>
        {/* ANNEXES */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>ANNEXES ET DOCUMENTS REMIS</Text>
        </View>

        <Text style={styles.paragraph}>
          Les documents suivants sont remis au locataire :
        </Text>

        <View style={styles.list}>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>☐</Text>
            <Text style={styles.listContent}>État des lieux d'entrée (recommandé)</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>☐</Text>
            <Text style={styles.listContent}>Règlement du parking ou de la copropriété (si applicable)</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>☐</Text>
            <Text style={styles.listContent}>Copie de la clé / badge remis : {' '}_____ exemplaire(s)</Text>
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
              <Text style={styles.signatureField}>
                {landlord?.fullName || '[Nom]'}
              </Text>
              <Text style={styles.signatureField}>
                {landlord?.email || '[Email]'}
              </Text>
              
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
              <Text style={styles.signatureField}>
                {tenant.firstName} {tenant.lastName}
              </Text>
              <Text style={styles.signatureField}>
                {tenant.email}
              </Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureMention}>"Lu et approuvé"</Text>
            </View>
          </View>
        </View>

        {/* Mentions légales */}
        <View style={{marginTop: 30, padding: 10, backgroundColor: '#f9fafb', borderRadius: 4}}>
          <Text style={{fontSize: 8, color: '#666', textAlign: 'center', lineHeight: 1.3}}>
            Document généré automatiquement par Smartimmo le {generationDate}{'\n'}
            Contrat de location de garage/parking soumis au droit commun (Code civil){'\n'}
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

export default buildBailGaragePdf;

