import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { LeaseData } from '../gapChecker';
import { formatMoney, formatDate, formatDateLong } from '../format';
import { dataUrlToPdfSrc, formatDateFR } from '../helpers';

// Styles professionnels Smartimmo
const styles = StyleSheet.create({
  page: {
    padding: '20mm',
    fontSize: 10.5,
    fontFamily: 'Helvetica',
    lineHeight: 1.4,
    color: '#1a1a1a',
  },
  // En-tête
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
  // Bandeaux de section
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
  // Titres et sous-titres
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
  // Paragraphes
  paragraph: {
    marginBottom: 8,
    textAlign: 'justify',
    lineHeight: 1.5,
  },
  paragraphBold: {
    fontWeight: 'bold',
  },
  paragraphIndent: {
    marginLeft: 20,
    marginBottom: 8,
    textAlign: 'justify',
    lineHeight: 1.5,
  },
  // Listes
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
  // Tableau conditions financières
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
  // Encadré
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
  // Signatures
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
  // Pied de page
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
});

interface BailVidePdfProps {
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

export function buildBailVidePdf(data: BailVidePdfProps) {
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
      {/* PAGE 1 - Désignation des parties */}
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            CONTRAT DE LOCATION – LOGEMENT VIDE
          </Text>
          <Text style={styles.headerSubtitle}>
            Titre 1er bis de la loi du 6 juillet 1989
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
        <Text style={{...styles.paragraph, fontWeight: 'bold'}}>1. Le Bailleur</Text>
        <Text style={styles.paragraph}>
          <Text style={styles.paragraphBold}>{landlord?.fullName || '[Nom du bailleur]'}</Text>, demeurant au {landlordFullAddress || '[Adresse du bailleur]'};
        </Text>
        <Text style={styles.paragraph}>
          Désigné ci-après, le <Text style={styles.paragraphBold}>"Bailleur"</Text>;
        </Text>

        <Text style={{...styles.paragraph, fontWeight: 'bold', marginTop: 12}}>
          Et, d'autre part,
        </Text>
        <Text style={{...styles.paragraph, fontWeight: 'bold'}}>2. Le Locataire</Text>
        <Text style={styles.paragraph}>
          <Text style={styles.paragraphBold}>{tenant.firstName} {tenant.lastName}</Text>, né(e) le {tenant.birthDate ? formatDate(tenant.birthDate) : '[Date de naissance]'}, demeurant au {propertyFullAddress};
        </Text>
        <Text style={styles.paragraph}>
          Email : {tenant.email} • Téléphone : {tenant.phone || '[Non renseigné]'}
        </Text>
        <Text style={styles.paragraph}>
          désigné ci-après le <Text style={styles.paragraphBold}>"Locataire"</Text>.
        </Text>

        <Text style={{...styles.paragraph, marginTop: 15, fontWeight: 'bold', textAlign: 'center'}}>
          Il a été arrêté et convenu ce qui suit,
        </Text>
        <Text style={styles.paragraph}>
          le bailleur louant les locaux ci-après désignés, au locataire qui les accepte aux conditions suivantes.
        </Text>

        {/* DÉSIGNATION DU LOGEMENT */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>DÉSIGNATION DU LOGEMENT</Text>
        </View>

        <Text style={styles.h3}>1.1 Adresse</Text>
        <Text style={styles.paragraph}>
          Le logement est situé au : <Text style={styles.paragraphBold}>{propertyFullAddress}</Text>
        </Text>

        <Text style={styles.h3}>1.2 Caractéristiques</Text>
        <View style={styles.list}>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>Type de bien : {property.name}</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>Surface habitable : <Text style={styles.paragraphBold}>{property.surface} m²</Text></Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listContent}>Nombre de pièces principales : <Text style={styles.paragraphBold}>{property.rooms}</Text></Text>
          </View>
        </View>

        <Text style={styles.h3}>1.3 Destination</Text>
        <Text style={styles.paragraph}>
          Les locaux sont à usage exclusif d'<Text style={styles.paragraphBold}>habitation</Text>, le Locataire y installant sa résidence principale.
        </Text>

        {/* Pied de page */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>Smartimmo</Text>
          <Text style={styles.footerCenter}>{property.name}</Text>
          <Text style={styles.footerRight} render={({ pageNumber, totalPages }) => `Page ${pageNumber}/${totalPages}`} />
        </View>
      </Page>

      {/* PAGE 2 - Durée et conditions financières */}
      <Page size="A4" style={styles.page}>
        {/* DURÉE DU CONTRAT */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>DURÉE DU CONTRAT</Text>
        </View>

        <Text style={styles.paragraph}>
          Le présent contrat est consenti pour une durée de <Text style={styles.paragraphBold}>trois (3) ans</Text> commençant à courir le{' '}
          <Text style={styles.paragraphBold}>{formatDate(lease.startDate)}</Text>{' '}
          {lease.endDate && `et se terminant le ${formatDate(lease.endDate)}`} sous réserve de reconduction ou de renouvellement.
        </Text>

        {/* CONDITIONS FINANCIÈRES - Bandeau */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>CONDITIONS FINANCIÈRES</Text>
        </View>

        {/* Tableau récapitulatif */}
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
              <Text>{formatMoney(lease.charges || 0)}</Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={styles.paragraphBold}>{formatMoney(totalRent)}</Text>
            </View>
            <View style={styles.tableCell}>
              <Text>{formatMoney(lease.deposit)}</Text>
            </View>
            <View style={styles.tableCellLast}>
              <Text>Le {lease.paymentDay || 1} du mois</Text>
            </View>
          </View>
        </View>

        <Text style={styles.h2}>3.1 Fixation du loyer</Text>
        <Text style={styles.paragraph}>
          Le montant du loyer hors charges est fixé à la somme de <Text style={styles.paragraphBold}>{formatMoney(lease.rentAmount)}</Text>.
        </Text>
        <Text style={styles.paragraph}>
          Le montant provisionnel des charges est de <Text style={styles.paragraphBold}>{formatMoney(lease.charges || 0)}</Text> par mois.
          Une régularisation annuelle sera effectuée en fonction des dépenses réelles.
        </Text>
        <Text style={styles.paragraph}>
          Le loyer et les charges seront payables par virement bancaire le <Text style={styles.paragraphBold}>{lease.paymentDay || 1}</Text> de chaque mois.
        </Text>

        <Text style={styles.h2}>3.2 Révision du loyer</Text>
        <Text style={styles.paragraph}>
          L'augmentation annuelle du loyer ne peut excéder la variation sur un (1) an de l'<Text style={styles.paragraphBold}>Indice de Référence des Loyers (IRL)</Text> publié par l'INSEE.
        </Text>
        <Text style={styles.paragraph}>
          Le loyer sera révisé annuellement à la date anniversaire du bail. L'indice de référence est l'IRL du trimestre de signature du contrat.
        </Text>

        <Text style={styles.h2}>3.3 Dépôt de garantie</Text>
        <Text style={styles.paragraph}>
          Le dépôt de garantie est fixé à <Text style={styles.paragraphBold}>{formatMoney(lease.deposit)}</Text> correspondant à un (1) mois de loyer hors charges.
        </Text>
        <Text style={styles.paragraph}>
          Il est versé à la signature et sera restitué dans un délai maximal de deux (2) mois après restitution des clés, déduction faite des éventuelles sommes dues au bailleur.
        </Text>

        {/* Encadré clauses importantes */}
        <View style={styles.box}>
          <Text style={styles.boxTitle}>⚠️ CLAUSES IMPORTANTES</Text>
          <Text style={styles.boxContent}>
            • <Text style={styles.paragraphBold}>Congé :</Text> Préavis de {lease.noticeMonths || 3} mois pour le locataire (lettre recommandée AR){'\n'}
            • <Text style={styles.paragraphBold}>Indexation :</Text> Révision annuelle selon l'IRL{'\n'}
            • <Text style={styles.paragraphBold}>Assurance :</Text> Le locataire doit justifier d'une assurance habitation
          </Text>
        </View>

        {/* Pied de page */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>Smartimmo</Text>
          <Text style={styles.footerCenter}>{property.name}</Text>
          <Text style={styles.footerRight} render={({ pageNumber, totalPages }) => `Page ${pageNumber}/${totalPages} — Paraphe : __________`} />
        </View>
      </Page>

      {/* PAGE 3 - Obligations et résiliation */}
      <Page size="A4" style={styles.page}>
        {/* OBLIGATIONS DU BAILLEUR */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>OBLIGATIONS DU BAILLEUR</Text>
        </View>

        <Text style={styles.paragraph}>
          Le Bailleur est tenu des obligations principales suivantes :
        </Text>
        <View style={styles.list}>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>a)</Text>
            <Text style={styles.listContent}>
              de livrer le logement en bon état d'usage et de réparation (sauf stipulation particulière concernant les travaux pouvant être pris en charge par le locataire);
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>b)</Text>
            <Text style={styles.listContent}>
              de livrer les éléments d'équipements en bon état de fonctionnement;
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>c)</Text>
            <Text style={styles.listContent}>
              d'assurer au locataire la jouissance paisible et la garantie des vices ou défauts de nature à y faire obstacle;
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>d)</Text>
            <Text style={styles.listContent}>
              de maintenir les locaux en état de servir à l'usage prévu par le contrat et d'effectuer les réparations autres que locatives;
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>e)</Text>
            <Text style={styles.listContent}>
              de remettre gratuitement et mensuellement une quittance de loyer au Locataire.
            </Text>
          </View>
        </View>

        {/* OBLIGATIONS DU LOCATAIRE */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>OBLIGATIONS DU LOCATAIRE</Text>
        </View>

        <Text style={styles.paragraph}>
          Le Locataire est tenu des obligations suivantes :
        </Text>
        <View style={styles.list}>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>a)</Text>
            <Text style={styles.listContent}>
              payer le loyer et les charges récupérables aux termes convenus;
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>b)</Text>
            <Text style={styles.listContent}>
              user paisiblement des locaux et équipements loués suivant la destination prévue au contrat et dans le respect du voisinage;
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>c)</Text>
            <Text style={styles.listContent}>
              de répondre des dégradations ou des pertes survenues pendant le cours du bail;
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>d)</Text>
            <Text style={styles.listContent}>
              de prendre à sa charge l'entretien courant du logement et des équipements, les menues réparations et l'ensemble des réparations incombant au locataire;
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>e)</Text>
            <Text style={styles.listContent}>
              de souscrire une assurance contre les risques locatifs et d'en justifier au Bailleur lors de la remise des clés puis chaque année à sa demande.
            </Text>
          </View>
        </View>

        {/* CLAUSE RÉSOLUTOIRE */}
        <Text style={styles.h2}>Clause résolutoire</Text>
        <Text style={styles.paragraph}>
          À défaut de paiement d'un seul terme de loyer ou de charges à son échéance, ou de non-respect de l'une des obligations du présent bail, et un mois après un commandement de payer demeuré infructueux, le présent bail sera résilié de plein droit.
        </Text>

        {/* CONGÉ */}
        <Text style={styles.h2}>Congé et résiliation</Text>
        <Text style={styles.h3}>Par le Locataire</Text>
        <Text style={styles.paragraph}>
          Le Locataire peut résilier le bail à tout moment en respectant un préavis de <Text style={styles.paragraphBold}>{lease.noticeMonths || 3} mois</Text>, donné par lettre recommandée avec AR ou acte d'huissier. Le préavis court à compter de la réception de la notification par le Bailleur.
        </Text>

        <Text style={styles.h3}>Par le Bailleur</Text>
        <Text style={styles.paragraph}>
          Le Bailleur peut donner congé à l'échéance du bail avec un préavis de <Text style={styles.paragraphBold}>six (6) mois</Text>, par lettre recommandée avec AR, pour reprise, vente ou motif légitime et sérieux.
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
          Les documents suivants sont annexés au présent contrat ou remis au locataire :
        </Text>

        <View style={styles.list}>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>☐</Text>
            <Text style={styles.listContent}>Diagnostic de Performance Énergétique (DPE)</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>☐</Text>
            <Text style={styles.listContent}>État des Risques et Pollutions (ERP)</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>☐</Text>
            <Text style={styles.listContent}>Surface habitable (loi Boutin)</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>☐</Text>
            <Text style={styles.listContent}>Notice d'information sur les droits et devoirs du locataire</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>☐</Text>
            <Text style={styles.listContent}>État des lieux d'entrée contradictoire</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>☐</Text>
            <Text style={styles.listContent}>Constat de Risque d'Exposition au Plomb (CREP) si logement construit avant 1949</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listBullet}>☐</Text>
            <Text style={styles.listContent}>Règlement de copropriété et état descriptif de division (si applicable)</Text>
          </View>
        </View>

        {lease.notes && (
          <>
            <Text style={styles.h2}>Notes et clauses particulières</Text>
            <Text style={styles.paragraph}>{lease.notes}</Text>
          </>
        )}

        {/* SIGNATURES */}
        <View style={styles.signaturesContainer}>
          <Text style={{...styles.paragraph, textAlign: 'center', fontWeight: 'bold', marginBottom: 15}}>
            Fait à {property.city || '__________'}, le {generationDate}
          </Text>
          <Text style={{fontSize: 9, textAlign: 'center', marginBottom: 20, fontStyle: 'italic', color: '#666'}}>
            En trois (3) exemplaires originaux dont un pour chaque partie
          </Text>

          <View style={styles.signaturesRow}>
            <View style={styles.signatureBlock}>
              <Text style={styles.signatureLabel}>LE BAILLEUR</Text>
              <Text style={styles.signatureField}>
                {landlord?.fullName || '[Nom]'}
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
              <View style={styles.signatureLine} />
              <Text style={styles.signatureMention}>"Lu et approuvé"</Text>
            </View>

            <View style={styles.signatureBlock}>
              <Text style={styles.signatureLabel}>LA CAUTION</Text>
              <Text style={styles.signatureField}>
                (si applicable)
              </Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureMention}>"Bon pour caution"</Text>
            </View>
          </View>
        </View>

        {/* Mentions légales */}
        <View style={{marginTop: 30, padding: 10, backgroundColor: '#f9fafb', borderRadius: 4}}>
          <Text style={{fontSize: 8, color: '#666', textAlign: 'center', lineHeight: 1.3}}>
            Document généré automatiquement par Smartimmo le {generationDate}{'\n'}
            Ce contrat est soumis aux dispositions de la loi n°89-462 du 6 juillet 1989 modifiée{'\n'}
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

export default buildBailVidePdf;

