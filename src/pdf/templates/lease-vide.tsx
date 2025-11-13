import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { LeaseData } from '../gapChecker';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9.5,
    fontFamily: 'Helvetica',
    lineHeight: 1.5,
  },
  // Bandeau bleu style Union des Bailleurs
  banner: {
    backgroundColor: '#1e3a8a', // Bleu foncé
    padding: 12,
    marginBottom: 15,
    marginHorizontal: -40,
    marginTop: -40,
  },
  bannerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 25,
    textTransform: 'uppercase',
    color: '#1e3a8a',
  },
  sectionBanner: {
    backgroundColor: '#1e3a8a',
    padding: 8,
    marginHorizontal: -40,
    marginTop: 15,
    marginBottom: 10,
  },
  sectionBannerText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 15,
  },
  paragraph: {
    marginBottom: 7,
    textAlign: 'justify',
    lineHeight: 1.6,
  },
  paragraphIndent: {
    marginLeft: 20,
    marginBottom: 7,
    textAlign: 'justify',
    lineHeight: 1.6,
  },
  bold: {
    fontWeight: 'bold',
  },
  article: {
    marginTop: 15,
    marginBottom: 12,
  },
  articleTitle: {
    fontSize: 10.5,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
    color: '#1e3a8a',
  },
  subArticleTitle: {
    fontSize: 9.5,
    fontWeight: 'bold',
    marginBottom: 6,
    marginTop: 8,
  },
  list: {
    marginLeft: 25,
    marginTop: 5,
  },
  listItem: {
    marginBottom: 5,
    flexDirection: 'row',
    textAlign: 'justify',
  },
  bullet: {
    width: 20,
    marginRight: 5,
  },
  listContent: {
    flex: 1,
    lineHeight: 1.5,
  },
  table: {
    marginTop: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    minHeight: 25,
  },
  tableHeader: {
    backgroundColor: '#e5e7eb',
    fontWeight: 'bold',
  },
  tableCell: {
    padding: 6,
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: '#333',
    justifyContent: 'center',
  },
  tableCellLast: {
    padding: 6,
    flex: 1,
    justifyContent: 'center',
  },
  signatures: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  signatureBlock: {
    width: '30%',
    alignItems: 'center',
  },
  signatureLabel: {
    fontWeight: 'bold',
    marginBottom: 50,
    fontSize: 10,
    textAlign: 'center',
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#000',
    width: '100%',
    marginTop: 5,
  },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 7,
    color: '#666',
    fontStyle: 'italic',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 25,
    right: 40,
    fontSize: 8,
    color: '#666',
  },
});

interface LeaseVidePdfProps {
  data: LeaseData;
}

export default function LeaseVidePdf({ data }: LeaseVidePdfProps) {
  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return '[Date à compléter]';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (!(d instanceof Date) || isNaN(d.getTime())) {
        return '[Date invalide]';
      }
      return d.toLocaleDateString('fr-FR');
    } catch (error) {
      return '[Date invalide]';
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return '0,00 €';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const landlord = data.landlord || {};
  const tenant = data.tenant;
  const property = data.property;
  const lease = data.lease;

  const landlordFullAddress = [
    landlord.address1,
    landlord.address2,
    `${landlord.postalCode} ${landlord.city}`,
  ]
    .filter(Boolean)
    .join(', ');

  const propertyFullAddress = [
    property.address,
    `${property.postalCode} ${property.city}`,
  ]
    .filter(Boolean)
    .join(', ');

  const totalRent = (lease.rentAmount || 0) + (lease.charges || 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Bandeau bleu en-tête */}
        <View style={styles.banner}>
          <Text style={styles.bannerText}>CONTRAT DE LOCATION</Text>
        </View>

        <Text style={styles.title}>
          CONTRAT DE LOCATION DE LOGEMENT À USAGE D'HABITATION VIDE
        </Text>
        
        <Text style={{ fontSize: 8, textAlign: 'center', marginBottom: 15, color: '#666' }}>
          Titre 1er bis de la loi du 6 juillet 1989
        </Text>

        {/* DÉSIGNATION DES PARTIES */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>DÉSIGNATION DES PARTIES</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.paragraph}>
            Le présent contrat est conclu entre les soussignés :
          </Text>
          
          <Text style={{...styles.paragraph, fontWeight: 'bold', marginTop: 12}}>
            D'une part,
          </Text>
          <Text style={{...styles.paragraph, fontWeight: 'bold'}}>1. Le Bailleur</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>{landlord.fullName || '[Nom du bailleur]'}</Text>, demeurant au {landlordFullAddress || '[Adresse du bailleur]'};
          </Text>
          <Text style={styles.paragraph}>
            Désigné ci-après, le <Text style={styles.bold}>"Bailleur"</Text>;
          </Text>

          <Text style={{...styles.paragraph, fontWeight: 'bold', marginTop: 12}}>
            Et, d'autre part,
          </Text>
          <Text style={{...styles.paragraph, fontWeight: 'bold'}}>2. Le Locataire</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>{tenant.firstName} {tenant.lastName}</Text>, demeurant au {propertyFullAddress};
          </Text>
          <Text style={styles.paragraph}>
            désigné ci-après le <Text style={styles.bold}>"Locataire"</Text>.
          </Text>

          <Text style={{...styles.paragraph, marginTop: 12}}>
            Le Bailleur et le Locataire étant ci-après désignés, ensemble, les <Text style={styles.bold}>"Parties"</Text>.
          </Text>

          <Text style={{...styles.paragraph, marginTop: 15, fontWeight: 'bold', textAlign: 'center'}}>
            Il a été arrêté et convenu ce qui suit,
          </Text>
          <Text style={styles.paragraph}>
            le bailleur louant les locaux et équipements ci-après désignés, au(x) locataire(s) qui les accepte(nt) aux conditions suivantes.
          </Text>
        </View>

        {/* DÉSIGNATION - Bandeau */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>DÉSIGNATION</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.subArticleTitle}>1.1 CONSISTANCE DU LOGEMENT</Text>
          
          <Text style={{...styles.paragraph, fontWeight: 'bold', marginTop: 8}}>
            1.1.1 Adresse du logement
          </Text>
          <Text style={styles.paragraph}>
            Le logement est situé au {propertyFullAddress || '[Adresse à compléter]'}.
          </Text>

          <Text style={{...styles.paragraph, fontWeight: 'bold', marginTop: 10}}>
            1.1.2 Caractéristiques du logement
          </Text>
          <View style={styles.list}>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listContent}>Surface habitable : {property.surface || '[À compléter]'} m²</Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listContent}>Nombre de pièces principales : {property.rooms || '[À compléter]'}</Text>
            </View>
          </View>

          <Text style={{...styles.paragraph, fontWeight: 'bold', marginTop: 10}}>
            1.2 DESTINATION DES LOCAUX
          </Text>
          <Text style={styles.paragraph}>
            Les locaux sont à usage exclusif d'habitation, le Locataire y installant sa résidence principale.
          </Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        {/* DURÉE - Bandeau */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>DURÉE</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.paragraph}>
            Le présent contrat est consenti pour une durée de <Text style={styles.bold}>trois (3) ans</Text> commençant à courir le{' '}
            <Text style={styles.bold}>{formatDate(lease.startDate)}</Text> et se terminant le{' '}
            <Text style={styles.bold}>{formatDate(lease.endDate)}</Text> sous réserve de reconduction ou de renouvellement.
          </Text>
        </View>

        {/* CONDITIONS PARTICULIÈRES - Bandeau */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>CONDITIONS PARTICULIÈRES</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.subArticleTitle}>Loyers et Charges</Text>
          <Text style={styles.paragraph}>
            Le loyer est payable <Text style={styles.bold}>mensuellement</Text>, au domicile du bailleur ou de son mandataire.
          </Text>
          <Text style={styles.paragraph}>
            Le montant du loyer hors charges initial est fixé à la somme de{' '}
            <Text style={styles.bold}>{formatCurrency(lease.rentAmount)}</Text> (en toutes lettres){' '}
            plus les taxes récupérables et une provision sur charges initiales de{' '}
            <Text style={styles.bold}>{formatCurrency(lease.charges || 0)}</Text> (en toutes lettres).
          </Text>
          <Text style={styles.paragraph}>
            Il est rappelé que la provision sur charges est révisable chaque année en fonction des dépenses réelles.
            Le loyer sera automatiquement révisé à chaque date anniversaire du présent contrat en tenant compte de la variation
            de l'Indice de Référence des Loyers (IRL) publié par l'INSEE.
          </Text>

          <Text style={{...styles.subArticleTitle, marginTop: 15}}>Dépôt de Garantie</Text>
          <Text style={styles.paragraph}>
            Le dépôt de garantie est fixé à la somme de <Text style={styles.bold}>{formatCurrency(lease.deposit)}</Text>{' '}
            (en toutes lettres) correspondant à un (1) mois de loyer hors charges.
          </Text>

          <Text style={{...styles.subArticleTitle, marginTop: 15}}>Clause(s) Particulière(s)</Text>
          {lease.notes && (
            <Text style={styles.paragraph}>{lease.notes}</Text>
          )}
        </View>

        {/* LES CONDITIONS GÉNÉRALES DU CONTRAT - Bandeau */}
        <View style={styles.sectionBanner}>
          <Text style={styles.sectionBannerText}>LES CONDITIONS GÉNÉRALES DU CONTRAT</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.subArticleTitle}>1) Durée du contrat</Text>
          <Text style={styles.paragraph}>
            Si le bailleur est une personne physique ou une société civile familiale, le bail est consenti pour une durée au
            minimum égale à TROIS ANS. Cette durée peut être ramenée à moins de 3 ans (1 an minimum) pour des raisons
            professionnelles ou familiales justifiant une durée moindre du contrat. Si le bailleur est une personne morale,
            le bail est consenti pour une durée au moins égale à SIX ANS.
          </Text>

          <Text style={{...styles.subArticleTitle, marginTop: 10}}>2) Congé</Text>
          <Text style={styles.paragraph}>
            Le congé doit être signifié par lettre recommandée avec accusé de réception ou par acte d'huissier. Il peut être
            délivré à tout moment par le locataire en respectant un préavis de <Text style={styles.bold}>TROIS MOIS</Text>{' '}
            courant à compter de la réception de la lettre de congé.
          </Text>

          <Text style={{...styles.subArticleTitle, marginTop: 10}}>3) Reconduction du contrat</Text>
          <Text style={styles.paragraph}>
            À défaut de congé régulier du bailleur ou du locataire, le contrat parvenu à son terme est reconduit tacitement
            pour trois années pour les bailleurs personnes physiques et six années pour les bailleurs personnes morales.
          </Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        {/* Article Charges et obligations */}
        <View style={styles.article}>
          <Text style={styles.articleTitle}>ARTICLE 3 - CONDITIONS FINANCIÈRES</Text>
          
          <Text style={styles.subArticleTitle}>3.1 FIXATION DU LOYER</Text>
          
          <Text style={{...styles.subArticleTitle, marginTop: 8}}>3.1.1 Fixation du loyer initial</Text>
          <Text style={styles.paragraph}>
            Le montant du loyer avec les charges comprises est de <Text style={styles.bold}>{formatCurrency(totalRent)}</Text>{' '}
            et sera payable par virement bancaire le <Text style={styles.bold}>{lease.paymentDay || 1}</Text> de chaque mois.
          </Text>

          <Text style={{...styles.subArticleTitle, marginTop: 10}}>3.1.2 Révision du loyer</Text>
          <Text style={styles.paragraph}>
            L'augmentation annuelle du loyer ne peut excéder la variation sur un (1) an de l'Indice de Référence des Loyers
            (IRL) publié par l'INSEE. Le loyer peut être révisable annuellement à chaque date anniversaire de l'entrée en vigueur
            du présent bail. Le trimestre de référence de l'IRL est celui de la date de signature du présent contrat, l'indice
            applicable étant le dernier indice publié avant la signature du présent contrat.
          </Text>

          <Text style={{...styles.subArticleTitle, marginTop: 10}}>3.2 DÉPÔT DE GARANTIE</Text>
          <Text style={styles.paragraph}>
            Le dépôt de garantie est d'un montant de <Text style={styles.bold}>{formatCurrency(lease.deposit ?? 0)}</Text>{lease.deposit > 0 ? ' soit un (1) mois de loyer hors charges' : ''}. 
            {lease.deposit > 0 ? 'Il est versé avant le jour de la signature du présent contrat comme garantie. Cette somme ne sera pas productive d\'intérêts et peut être restituée le jour de la visite en cas de désaccord.' : 'Aucun dépôt de garantie n\'est exigé pour ce bail.'}
          </Text>
          {lease.deposit > 0 && (
            <Text style={styles.paragraph}>
              Conformément aux dispositions de l'article 22 de la loi du 6 juillet 1989, le dépôt est restitué dans un délai
              maximal de deux mois à compter de la remise en main propre, ou par lettre recommandée avec accusé de réception.
            </Text>
          )}

          <Text style={{...styles.subArticleTitle, marginTop: 10}}>3.3 CHARGES</Text>
          <Text style={styles.paragraph}>
            Le Locataire sera tenu d'acquitter en même temps que le loyer sa quote-part de charges réglementaires conformément
            à la liste fixée par décret en Conseil d'État. Les charges sont appelées en même temps que le loyer suivant une
            provision régularisée chaque année ou sur régularisation annuelle.
          </Text>
        </View>

        {/* OBLIGATIONS */}
        <View style={styles.article}>
          <Text style={styles.articleTitle}>ARTICLE 5 - CONDITIONS GÉNÉRALES</Text>
          
          <Text style={styles.subArticleTitle}>5.1 OBLIGATIONS DU BAILLEUR</Text>
          <Text style={styles.paragraph}>Le Bailleur est tenu des obligations principales suivantes :</Text>
          <View style={styles.list}>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>a)</Text>
              <Text style={styles.listContent}>
                de livrer le logement en bon état d'usage et de réparation (sauf stipulation particulière concernant
                les travaux pouvant être pris en charge par le locataire);
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>b)</Text>
              <Text style={styles.listContent}>
                de livrer les éléments d'équipements en bon état de fonctionnement;
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>c)</Text>
              <Text style={styles.listContent}>
                d'assurer au locataire la jouissance paisible et la garantie des vices ou défauts de nature à y faire obstacle;
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>d)</Text>
              <Text style={styles.listContent}>
                de maintenir les locaux en état de servir à l'usage prévu par le contrat et effectuant les réparations
                autres que locatives;
              </Text>
            </View>
          </View>

          <Text style={{...styles.subArticleTitle, marginTop: 10}}>5.2 OBLIGATIONS DU LOCATAIRE</Text>
          <Text style={styles.paragraph}>Le Locataire est tenu des obligations suivantes :</Text>
          <View style={styles.list}>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>a)</Text>
              <Text style={styles.listContent}>
                payer le loyer et les charges récupérables aux termes convenus;
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>b)</Text>
              <Text style={styles.listContent}>
                user paisiblement des locaux et équipements loués suivant la destination prévue au contrat et dans le
                respect du voisinage;
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>c)</Text>
              <Text style={styles.listContent}>
                de répondre des dégradations ou des pertes survenues pendant le cours du bail;
              </Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>d)</Text>
              <Text style={styles.listContent}>
                de prendre à sa charge l'entretien courant et logement et des équipements, les menues réparations et
                l'ensemble des réparations incombant au locataire telles que le ramonage des cheminées et conduits de fumée;
              </Text>
            </View>
          </View>
        </View>

        {/* Signatures */}
        <View style={styles.signatures}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>LE BAILLEUR**</Text>
            <View style={styles.signatureLine} />
            <Text style={{ fontSize: 9, marginTop: 5 }}>{landlord.fullName || '[Nom]'}</Text>
          </View>
          
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>LE(S) LOCATAIRE(S)**</Text>
            <View style={styles.signatureLine} />
            <Text style={{ fontSize: 9, marginTop: 5 }}>{tenant.firstName} {tenant.lastName}</Text>
          </View>

          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>LA CAUTION**</Text>
            <View style={styles.signatureLine} />
          </View>
        </View>

        <Text style={{ ...styles.footer, marginTop: 30 }}>
          * cochez la case correspondant à la situation
        </Text>
        <Text style={{ ...styles.footer, marginTop: 40 }}>
          ** signature précédée de la mention "Bon pour accord"
        </Text>

        <Text style={styles.footer}>
          Avec SmartImmo, vous n'êtes plus seul - Document généré automatiquement le {formatDate(new Date())}
        </Text>
      </Page>
    </Document>
  );
}

