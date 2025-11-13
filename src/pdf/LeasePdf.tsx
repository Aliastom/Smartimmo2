import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

// Styles exacts de l'ancien template
const styles = StyleSheet.create({
  page: {
    padding: '20mm',
    fontSize: 10.5,
    fontFamily: 'Helvetica',
    lineHeight: 1.4,
    color: '#1a1a1a',
  },
  // En-tête principal
  header: {
    textAlign: 'center',
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#2F54EB',
    borderBottomStyle: 'solid',
    paddingBottom: 15,
  },
  mainTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2F54EB',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 9,
    color: '#666',
    marginBottom: 5,
  },
  address: {
    fontSize: 10,
    color: '#333',
    fontWeight: 'bold',
  },
  // Bandeaux bleus de section
  sectionBanner: {
    backgroundColor: '#2F54EB',
    padding: '8pt 12pt',
    marginTop: 20,
    marginBottom: 12,
    marginHorizontal: -20,
  },
  bannerText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  // Contenu des sections
  sectionContent: {
    marginBottom: 15,
  },
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
  // Parties (Bailleur/Locataire)
  partySection: {
    marginBottom: 15,
  },
  partyTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2F54EB',
    marginBottom: 8,
  },
  partyName: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  partyDetails: {
    marginBottom: 5,
  },
  // Tableaux financiers
  financialTable: {
    marginTop: 15,
    marginBottom: 15,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1pt solid #eee',
    paddingVertical: 6,
  },
  tableHeader: {
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
  },
  tableCell: {
    flex: 1,
    padding: 4,
    fontSize: 10,
  },
  tableCellBold: {
    flex: 1,
    padding: 4,
    fontSize: 10,
    fontWeight: 'bold',
  },
  // Liste des obligations
  obligationList: {
    marginLeft: 20,
    marginBottom: 15,
  },
  obligationItem: {
    flexDirection: 'row',
    marginBottom: 8,
    textAlign: 'justify',
  },
  obligationLetter: {
    width: 20,
    fontWeight: 'bold',
  },
  obligationText: {
    flex: 1,
    lineHeight: 1.5,
  },
  // Clauses importantes
  importantClauses: {
    backgroundColor: '#f8f9fa',
    border: '2pt solid #2F54EB',
    padding: 15,
    marginVertical: 20,
  },
  clauseTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2F54EB',
    marginBottom: 10,
    textAlign: 'center',
  },
  clauseItem: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  // Signatures
  signatureSection: {
    marginTop: 40,
    paddingTop: 20,
    borderTop: '1pt solid #ccc',
  },
  signatureGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  signatureColumn: {
    width: '30%',
    textAlign: 'center',
  },
  signatureTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2F54EB',
  },
  signatureName: {
    fontSize: 10,
    marginBottom: 10,
  },
  signatureLine: {
    borderBottom: '1pt solid #333',
    marginBottom: 10,
    height: 40,
  },
  signatureImage: {
    width: 150,
    height: 60,
    border: '1pt solid #ddd',
    marginBottom: 10,
  },
  signatureNote: {
    fontSize: 9,
    color: '#666',
    fontStyle: 'italic',
  },
  // Pied de page
  footer: {
    position: 'absolute',
    bottom: 30,
    left: '20mm',
    right: '20mm',
    textAlign: 'center',
    fontSize: 9,
    color: '#999',
    borderTop: '1pt solid #eee',
    paddingTop: 10,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    right: '20mm',
    fontSize: 9,
    color: '#999',
  },
});

interface LeasePdfProps {
  lease: {
    id: string;
    type: string;
    startDate: string;
    endDate?: string | null;
    rentAmount: number;
    charges?: number | null; // Calculé pour rétrocompatibilité
    chargesRecupMensuelles?: number | null;
    chargesNonRecupMensuelles?: number | null;
    deposit?: number | null;
    paymentDay?: number | null;
    status?: string;
    notes?: string | null;
    furnishedType?: string;
  };
  Property: {
    name: string;
    address: string;
    city?: string;
    postalCode?: string;
    surface?: number;
    rooms?: number;
  };
  Tenant: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    birthDate?: string | null;
  };
  profile?: {
    firstName: string;
    lastName: string;
    company?: string;
    signature?: string;
    address?: string;
    city?: string;
    postalCode?: string;
  };
  generatedAt?: string;
}

const LeasePdf: React.FC<LeasePdfProps> = ({ 
  lease, 
  property, 
  tenant, 
  profile, 
  generatedAt = new Date().toISOString() 
}) => {
  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'Non définie';
    try {
      return new Date(date).toLocaleDateString('fr-FR');
    } catch {
      return 'Non définie';
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return '0,00 €';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  // Fonction pour calculer la durée du bail
  const calculateLeaseDuration = (startDate: string | null | undefined, endDate: string | null | undefined) => {
    // Si pas de date de fin, retourner 3 ans par défaut
    if (!endDate || !startDate) {
      return { years: 3, months: 0, text: 'trois (3) ans' };
    }

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Calculer la différence en mois
      let years = end.getFullYear() - start.getFullYear();
      let months = end.getMonth() - start.getMonth();

      // Ajuster si nécessaire
      if (months < 0) {
        years--;
        months += 12;
      }

      // Texte formaté
      let text = '';
      if (years > 0 && months > 0) {
        const yearText = years === 1 ? 'un (1) an' : `${years} ans`;
        const monthText = months === 1 ? 'un (1) mois' : `${months} mois`;
        text = `${yearText} et ${monthText}`;
      } else if (years > 0) {
        text = years === 1 ? 'un (1) an' : `${years} ans`;
      } else if (months > 0) {
        text = months === 1 ? 'un (1) mois' : `${months} mois`;
      } else {
        // Moins d'un mois, calculer en jours
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        text = diffDays === 1 ? 'un (1) jour' : `${diffDays} jours`;
      }

      return { years, months, text };
    } catch {
      return { years: 3, months: 0, text: 'trois (3) ans' };
    }
  };

  const leaseDuration = calculateLeaseDuration(lease.startDate, lease.endDate);

  const getLeaseType = (type: string) => {
    const types: { [key: string]: string } = {
      residential: 'LOGEMENT VIDE',
      commercial: 'COMMERCIAL',
      office: 'BUREAU',
      industrial: 'INDUSTRIEL',
    };
    return types[type] || type;
  };

  const fullAddress = [property.address, property.postalCode, property.city]
    .filter(Boolean)
    .join(', ');

  const profileAddress = [profile?.address, profile?.postalCode, profile?.city]
    .filter(Boolean)
    .join(', ');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* En-tête principal */}
        <View style={styles.header}>
          <Text style={styles.mainTitle}>CONTRAT DE LOCATION – {getLeaseType(lease.type)}</Text>
          <Text style={styles.subtitle}>Titre 1er bis de la loi du 6 juillet 1989</Text>
          <Text style={styles.address}>{property.name} • {fullAddress}</Text>
        </View>

        {/* DÉSIGNATION DES PARTIES */}
        <View style={styles.sectionBanner}>
          <Text style={styles.bannerText}>DÉSIGNATION DES PARTIES</Text>
        </View>
        
        <View style={styles.sectionContent}>
          <Text style={styles.paragraph}>
            Le présent contrat est conclu entre les soussignés :
          </Text>
          
          <Text style={styles.paragraphBold}>D'une part,</Text>
          <Text style={styles.paragraphBold}>1. Le Bailleur</Text>
          <Text style={styles.paragraphIndent}>
            <Text style={styles.partyName}>{profile?.firstName} {profile?.lastName}</Text>
            {profile?.company && (
              <Text>, {profile.company}</Text>
            )}
            , demeurant au {profileAddress};
          </Text>
          <Text style={styles.paragraphIndent}>
            Désigné ci-après, le "<Text style={styles.partyName}>Bailleur</Text>";
          </Text>

          <Text style={styles.paragraphBold}>Et, d'autre part,</Text>
          <Text style={styles.paragraphBold}>2. Le Locataire</Text>
          <Text style={styles.paragraphIndent}>
            <Text style={styles.partyName}>{tenant.firstName} {tenant.lastName}</Text>
            , né(e) le {tenant.birthDate ? formatDate(tenant.birthDate) : '[Date de naissance]'}
            , demeurant au {fullAddress};
          </Text>
          <Text style={styles.paragraphIndent}>
            Email : {tenant.email} • Téléphone : {tenant.phone || '[Téléphone]'}
          </Text>
          <Text style={styles.paragraphIndent}>
            désigné ci-après le "<Text style={styles.partyName}>Locataire</Text>".
          </Text>

          <Text style={[styles.paragraph, { textAlign: 'right', fontWeight: 'bold' }]}>
            Il a été arrêté et convenu ce qui suit,
          </Text>
          <Text style={styles.paragraph}>
            le bailleur louant les locaux ci-après désignés, au locataire qui les accepte aux conditions suivantes.
          </Text>
        </View>

        {/* DÉSIGNATION DU LOGEMENT */}
        <View style={styles.sectionBanner}>
          <Text style={styles.bannerText}>DÉSIGNATION DU LOGEMENT</Text>
        </View>
        
        <View style={styles.sectionContent}>
          <Text style={styles.partyTitle}>1.1 Adresse</Text>
          <Text style={styles.paragraph}>
            Le logement est situé au: <Text style={styles.partyName}>{fullAddress}</Text>
          </Text>

          <Text style={styles.partyTitle}>1.2 Caractéristiques</Text>
          <View style={styles.obligationList}>
            <View style={styles.obligationItem}>
              <Text style={styles.obligationText}>• Type de bien: {property.name}</Text>
            </View>
            <View style={styles.obligationItem}>
              <Text style={styles.obligationText}>• Surface habitable: <Text style={styles.partyName}>{property.surface || '[Surface]'} m²</Text></Text>
            </View>
            <View style={styles.obligationItem}>
              <Text style={styles.obligationText}>• Nombre de pièces principales : <Text style={styles.partyName}>{property.rooms || '[Nombre]'}</Text></Text>
            </View>
          </View>

          <Text style={styles.partyTitle}>1.3 Destination</Text>
          <Text style={styles.paragraph}>
            Les locaux sont à usage exclusif d'<Text style={styles.partyName}>habitation</Text>, le Locataire y installant sa résidence principale.
          </Text>
        </View>

        {/* DURÉE DU CONTRAT */}
        <View style={styles.sectionBanner}>
          <Text style={styles.bannerText}>DURÉE DU CONTRAT</Text>
        </View>
        
        <View style={styles.sectionContent}>
          <Text style={styles.paragraph}>
            Le présent bail est conclu pour une durée de <Text style={styles.partyName}>{leaseDuration.text}</Text>, 
            commençant le {formatDate(lease.startDate)}{lease.endDate ? ` et se terminant le ${formatDate(lease.endDate)}` : ''}, 
            sous réserve de renouvellement ou de prorogation.
          </Text>
        </View>

        {/* CONDITIONS FINANCIÈRES */}
        <View style={styles.sectionBanner}>
          <Text style={styles.bannerText}>CONDITIONS FINANCIÈRES</Text>
        </View>
        
        <View style={styles.sectionContent}>
          <View style={styles.financialTable}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCell}>Description</Text>
              <Text style={styles.tableCell}>Montant</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Loyer HC</Text>
              <Text style={styles.tableCellBold}>{formatCurrency(lease.rentAmount)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Charges</Text>
              <Text style={styles.tableCellBold}>{formatCurrency(lease.chargesRecupMensuelles || lease.charges || 0)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Total</Text>
              <Text style={styles.tableCellBold}>{formatCurrency((lease.rentAmount || 0) + (lease.chargesRecupMensuelles || lease.charges || 0))}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Dépôt</Text>
              <Text style={styles.tableCellBold}>{formatCurrency(lease.deposit || 0)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCell}>Paiement</Text>
              <Text style={styles.tableCellBold}>Le {lease.paymentDay || 1} du mois</Text>
            </View>
          </View>

          <Text style={styles.partyTitle}>3.1 Fixation du loyer</Text>
          <Text style={styles.paragraph}>
            Le loyer hors charges est fixé à <Text style={styles.partyName}>{formatCurrency(lease.rentAmount)}</Text>.
            Le montant provisionnel des charges est de <Text style={styles.partyName}>{formatCurrency(lease.chargesRecupMensuelles || lease.charges || 0)} par mois</Text>.
            Une régularisation annuelle des charges sera effectuée selon les dépenses réelles.
            Le loyer et les charges sont payables par virement bancaire le <Text style={styles.partyName}>{lease.paymentDay || 1} de chaque mois</Text>.
          </Text>

          <Text style={styles.partyTitle}>3.2 Révision du loyer</Text>
          <Text style={styles.paragraph}>
            L'augmentation annuelle du loyer ne peut excéder la variation sur un (1) an de 
            l'<Text style={styles.partyName}>Indice de Référence des Loyers (IRL)</Text> publié par l'<Text style={styles.partyName}>INSEE</Text>.
            Le loyer sera révisé annuellement à la date anniversaire du bail.
            L'indice de référence pris en compte est l'IRL du trimestre de signature du contrat.
          </Text>

          <Text style={styles.partyTitle}>3.3 Dépôt de garantie</Text>
          <Text style={styles.paragraph}>
            Le dépôt de garantie est fixé à <Text style={styles.partyName}>{formatCurrency(lease.deposit || 0)}</Text>.
            Ce montant correspond à <Text style={styles.partyName}>un (1) mois de loyer hors charges</Text>.
            Il est versé à la signature et sera restitué dans un délai maximal de deux (2) mois après 
            restitution des clés, déduction faite des éventuelles sommes dues au bailleur.
          </Text>
        </View>

        {/* CLAUSES IMPORTANTES */}
        <View style={styles.importantClauses}>
          <Text style={styles.clauseTitle}>CLAUSES IMPORTANTES</Text>
          <Text style={styles.clauseItem}>• <Text style={styles.partyName}>Congé</Text>: Préavis de 3 mois pour le locataire (lettre recommandée AR)</Text>
          <Text style={styles.clauseItem}>• <Text style={styles.partyName}>Indexation</Text>: Révision annuelle selon l'IRL</Text>
          <Text style={styles.clauseItem}>• <Text style={styles.partyName}>Assurance</Text>: Le locataire doit justifier d'une assurance habitation</Text>
        </View>

        {/* CLAUSES ET CONDITIONS PARTICULIÈRES */}
        {lease.notes && (
          <>
            <View style={styles.sectionBanner}>
              <Text style={styles.bannerText}>CLAUSES ET CONDITIONS PARTICULIÈRES</Text>
            </View>
            <View style={styles.sectionContent}>
              <Text style={styles.paragraph}>
                Le présent bail contient les clauses et conditions particulières suivantes :
              </Text>
              <Text style={styles.paragraphIndent}>
                {lease.notes}
              </Text>
            </View>
          </>
        )}

        {/* OBLIGATIONS DU BAILLEUR */}
        <View style={styles.sectionBanner}>
          <Text style={styles.bannerText}>OBLIGATIONS DU BAILLEUR</Text>
        </View>
        
        <View style={styles.sectionContent}>
          <Text style={styles.paragraph}>
            Le Bailleur est tenu des obligations principales suivantes :
          </Text>
          <View style={styles.obligationList}>
            <View style={styles.obligationItem}>
              <Text style={styles.obligationLetter}>a)</Text>
              <Text style={styles.obligationText}>de livrer le logement en bon état d'usage et de réparation (sauf stipulation particulière concernant les travaux pouvant être pris en charge par le locataire);</Text>
            </View>
            <View style={styles.obligationItem}>
              <Text style={styles.obligationLetter}>b)</Text>
              <Text style={styles.obligationText}>de livrer les éléments d'équipements en bon état de fonctionnement;</Text>
            </View>
            <View style={styles.obligationItem}>
              <Text style={styles.obligationLetter}>c)</Text>
              <Text style={styles.obligationText}>d'assurer au locataire la jouissance paisible et la garantie des vices ou défauts de nature à y faire obstacle;</Text>
            </View>
            <View style={styles.obligationItem}>
              <Text style={styles.obligationLetter}>d)</Text>
              <Text style={styles.obligationText}>de maintenir les locaux en état de servir à l'usage prévu par le contrat et d'effectuer les réparations autres que locatives;</Text>
            </View>
            <View style={styles.obligationItem}>
              <Text style={styles.obligationLetter}>e)</Text>
              <Text style={styles.obligationText}>de remettre gratuitement et mensuellement une quittance de loyer au Locataire.</Text>
            </View>
          </View>
        </View>

        {/* OBLIGATIONS DU LOCATAIRE */}
        <View style={styles.sectionBanner}>
          <Text style={styles.bannerText}>OBLIGATIONS DU LOCATAIRE</Text>
        </View>
        
        <View style={styles.sectionContent}>
          <Text style={styles.paragraph}>
            Le Locataire est tenu des obligations suivantes :
          </Text>
          <View style={styles.obligationList}>
            <View style={styles.obligationItem}>
              <Text style={styles.obligationLetter}>a)</Text>
              <Text style={styles.obligationText}>payer le loyer et les charges récupérables aux termes convenus;</Text>
            </View>
            <View style={styles.obligationItem}>
              <Text style={styles.obligationLetter}>b)</Text>
              <Text style={styles.obligationText}>user paisiblement des locaux et équipements loués suivant la destination prévue au contrat et dans le respect du voisinage;</Text>
            </View>
            <View style={styles.obligationItem}>
              <Text style={styles.obligationLetter}>c)</Text>
              <Text style={styles.obligationText}>de répondre des dégradations ou des pertes survenues pendant le cours du bail;</Text>
            </View>
            <View style={styles.obligationItem}>
              <Text style={styles.obligationLetter}>d)</Text>
              <Text style={styles.obligationText}>de prendre à sa charge l'entretien courant du logement et des équipements, les menues réparations et l'ensemble des réparations incombant au locataire;</Text>
            </View>
            <View style={styles.obligationItem}>
              <Text style={styles.obligationLetter}>e)</Text>
              <Text style={styles.obligationText}>de souscrire une assurance contre les risques locatifs et d'en justifier au Bailleur lors de la remise des clés puis chaque année à sa demande.</Text>
            </View>
          </View>
        </View>

        {/* CLAUSE RÉSOLUTOIRE */}
        <View style={styles.sectionBanner}>
          <Text style={styles.bannerText}>CLAUSE RÉSOLUTOIRE</Text>
        </View>
        
        <View style={styles.sectionContent}>
          <Text style={styles.paragraph}>
            Le présent bail sera résolu de plein droit en cas de non-paiement d'un seul terme de loyer 
            ou de charges à son échéance, ou de non-respect de l'une quelconque des obligations du présent bail.
            Cette résolution interviendra un mois après une mise en demeure restée infructueuse.
          </Text>
        </View>

        {/* CONGÉ ET RÉSILIATION */}
        <View style={styles.sectionBanner}>
          <Text style={styles.bannerText}>CONGÉ ET RÉSILIATION</Text>
        </View>
        
        <View style={styles.sectionContent}>
          <Text style={styles.partyTitle}>Par le Locataire</Text>
          <Text style={styles.paragraph}>
            Le Locataire peut résilier le bail à tout moment. Un préavis de <Text style={styles.partyName}>3 mois</Text> est requis.
            Le congé doit être donné par lettre recommandée avec accusé de réception (AR) ou par acte d'huissier.
            Le délai de préavis court à compter de la réception par le Bailleur de la notification.
          </Text>

          <Text style={styles.partyTitle}>Par le Bailleur</Text>
          <Text style={styles.paragraph}>
            Le Bailleur peut donner congé à l'expiration du bail. Un préavis de <Text style={styles.partyName}>six (6) mois</Text> est requis.
            Le congé doit être donné par lettre recommandée avec accusé de réception (AR).
            Les motifs valables sont : reprise, vente, ou motif légitime et sérieux.
          </Text>
        </View>

        {/* ANNEXES ET DOCUMENTS REMIS */}
        <View style={styles.sectionBanner}>
          <Text style={styles.bannerText}>ANNEXES ET DOCUMENTS REMIS</Text>
        </View>
        
        <View style={styles.sectionContent}>
          <Text style={styles.paragraph}>
            Les documents suivants sont annexés au présent contrat ou remis au locataire :
          </Text>
          <View style={styles.obligationList}>
            <View style={styles.obligationItem}>
              <Text style={styles.obligationText}>• Diagnostic de Performance Énergétique (DPE)</Text>
            </View>
            <View style={styles.obligationItem}>
              <Text style={styles.obligationText}>• État des Risques et Pollutions (ERP)</Text>
            </View>
            <View style={styles.obligationItem}>
              <Text style={styles.obligationText}>• Surface habitable (loi Boutin)</Text>
            </View>
            <View style={styles.obligationItem}>
              <Text style={styles.obligationText}>• Notice d'information sur les droits et devoirs du locataire</Text>
            </View>
            <View style={styles.obligationItem}>
              <Text style={styles.obligationText}>• État des lieux d'entrée contradictoire</Text>
            </View>
            <View style={styles.obligationItem}>
              <Text style={styles.obligationText}>• Constat de Risque d'Exposition au Plomb (CREP) si logement construit avant 1949</Text>
            </View>
            <View style={styles.obligationItem}>
              <Text style={styles.obligationText}>• Règlement de copropriété et état descriptif de division (si applicable)</Text>
            </View>
          </View>

          <Text style={[styles.paragraph, { textAlign: 'center', marginTop: 20 }]}>
            Fait à {profile?.city || 'Paris'}, le {formatDate(generatedAt)}
          </Text>
          <Text style={[styles.paragraph, { textAlign: 'center' }]}>
            En trois (3) exemplaires originaux dont un pour chaque partie
          </Text>
        </View>

        {/* Signatures */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureGrid}>
            {/* Bailleur */}
            <View style={styles.signatureColumn}>
              <Text style={styles.signatureTitle}>LE BAILLEUR</Text>
              <Text style={styles.signatureName}>{profile?.firstName} {profile?.lastName}</Text>
              <Text style={styles.signatureName}>Signature du bailleur :</Text>
              {profile?.signature ? (
                <Image src={profile.signature} style={styles.signatureImage} />
              ) : (
                <View style={styles.signatureLine} />
              )}
              <Text style={styles.signatureNote}>Signé électroniquement par {profile?.firstName} {profile?.lastName}</Text>
              <Text style={styles.signatureNote}>Fait à {profile?.city || 'Paris'}, le {formatDate(generatedAt)}</Text>
              <Text style={styles.signatureNote}>"Bon pour accord"</Text>
            </View>

            {/* Locataire */}
            <View style={styles.signatureColumn}>
              <Text style={styles.signatureTitle}>LE LOCATAIRE</Text>
              <Text style={styles.signatureName}>{tenant.firstName} {tenant.lastName}</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureNote}>"Lu et approuvé"</Text>
            </View>

            {/* Caution */}
            <View style={styles.signatureColumn}>
              <Text style={styles.signatureTitle}>LA CAUTION</Text>
              <Text style={styles.signatureName}>(si applicable)</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureNote}>"Bon pour caution"</Text>
            </View>
          </View>
        </View>

        {/* Pied de page */}
        <View style={styles.footer}>
          <Text>Document généré automatiquement - SmartImmo</Text>
          <Text>Bail #{lease.id}</Text>
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
          `Page ${pageNumber} / ${totalPages}`
        )} fixed />
      </Page>
    </Document>
  );
};

export default LeasePdf;