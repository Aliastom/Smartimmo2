import React from "react";
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Font,
  Image,
} from "@react-pdf/renderer";
import n2words from "n2words";

Font.register({ family: "Helvetica", src: null });

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 11,
    lineHeight: 1.3,
    padding: 24,
    color: "#000",
  },
  container: {
    border: "3pt solid #C7E1EE",
    padding: 16,
    margin: 8,
    backgroundColor: "#fff",
  },
  titleBar: {
    backgroundColor: "#0076A3",
    color: "#fff",
    textAlign: "center",
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 20,
  },
  section: { marginBottom: 24 },
  dotted: { borderBottom: "1px dotted #888", marginVertical: 3 },
  bold: { fontWeight: "bold" },
  small: { fontSize: 9 },
  footer: {
    marginTop: 32,
    fontSize: 8,
    color: "#555",
    textAlign: "center",
    borderTop: "0.5pt solid #aaa",
    paddingTop: 4,
  },
  signature: { width: 100, marginTop: 8 },
});

const formatDateFR = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatCurrency = (amount: number): string => {
  // Formater manuellement pour éviter les problèmes avec react-pdf
  const parts = amount.toFixed(2).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${integerPart},${parts[1]}`;
};

const calculateRentalPeriod = (paymentDate: string, paymentDay: number, month: number, year: number) => {
  // Utiliser le mois et l'année spécifiés pour la quittance
  const targetYear = year;
  const targetMonth = month - 1; // Les mois JavaScript commencent à 0
  
  // Date de début : jour de paiement du mois de la quittance (on paie pour ce mois)
  const startDate = new Date(targetYear, targetMonth, paymentDay);
  
  // Date de fin : jour de paiement du mois suivant (jusqu'au mois suivant)
  const endDate = new Date(targetYear, targetMonth + 1, paymentDay);
  
  return {
    start: formatDateFR(startDate.toISOString()),
    end: formatDateFR(endDate.toISOString())
  };
};

export const RentReceiptPDF = ({
  month = "Octobre",
  year = 2025,
  propertyAddress,
  tenantName,
  ownerName,
  rent,
  charges,
  paymentDate,
  paymentDay = 1,
  signatureUrl,
  city = "Nantes",
  logoUrl,
  monthNumber = 10, // Numéro du mois (1-12)
}) => {
  const total = rent + charges;
  const totalWords = n2words(total, { lang: "fr" });
  const rentalPeriod = calculateRentalPeriod(paymentDate, paymentDay, monthNumber, year);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.container}>
          {logoUrl && <Image src={logoUrl} style={{ width: 80, marginBottom: 10 }} />}
          <Text style={styles.titleBar}>QUITTANCE DE LOYER</Text>

        <View style={styles.section}>
          <Text>
            <Text style={styles.bold}>Quittance de loyer du mois de </Text>
            {month} {year}
          </Text>
          <View style={styles.dotted}></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.bold}>Adresse de la location :</Text>
          <Text>{propertyAddress}</Text>
          <View style={styles.dotted}></View>
        </View>

        <View style={styles.section}>
          <Text>
            Je soussigné {ownerName}, propriétaire du logement désigné
            ci-dessus, déclare avoir reçu de {tenantName} la somme de :
          </Text>

          <Text style={[styles.bold, { marginTop: 10 }]}>
            {totalWords} euros
          </Text>
          <Text style={styles.small}>(en toutes lettres)</Text>
          <View style={styles.dotted}></View>

          <Text style={[styles.bold, { marginTop: 6 }]}>
            {formatCurrency(total)} €
          </Text>
          <Text style={styles.small}>(en chiffres)</Text>
          <View style={styles.dotted}></View>

          <Text style={{ marginTop: 6 }}>
            au titre du paiement du loyer et des charges pour la période de
            location du {rentalPeriod.start} au{" "}
            {rentalPeriod.end}, et lui en donne quittance, sous réserve
            de tous mes droits.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.bold}>Détail du règlement</Text>
          <View style={styles.dotted}></View>
          <Text>
            Loyer : {formatCurrency(rent)} €
          </Text>
          <Text>
            Provision pour charges : {formatCurrency(charges)} €
          </Text>
          <View style={styles.dotted}></View>
          <Text style={styles.bold}>
            Total : {formatCurrency(total)} €
          </Text>
          <Text>Date du paiement : le {formatDateFR(paymentDate)}</Text>
        </View>

        <View style={styles.section}>
          <Text>
            Fait à {city}, le {formatDateFR(new Date().toISOString())}
          </Text>
          <Text style={[styles.bold, { marginTop: 10 }]}>Signature :</Text>
          {signatureUrl && (
            <>
              <Image src={signatureUrl} style={{ width: 120, marginTop: 10 }} />
              <Text style={[styles.small, { marginTop: 4, fontStyle: 'italic' }]}>
                Signé électroniquement par {ownerName}
              </Text>
            </>
          )}
        </View>

        <Text style={styles.footer}>
          Cette quittance annule tous les reçus précédents pour le même terme.
          Elle est à conserver trois ans par le locataire (article 7-1 de la loi
          n°89-462 du 6 juillet 1989). {"\n"}
          © SmartImmo – Gestion locative et financière
        </Text>
        </View>
      </Page>
    </Document>
  );
};
