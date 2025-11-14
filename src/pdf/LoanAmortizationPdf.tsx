import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Styles professionnels pour le PDF
const styles = StyleSheet.create({
  page: {
    padding: '15mm',
    fontSize: 9,
    fontFamily: 'Helvetica',
    lineHeight: 1.3,
    color: '#1a1a1a',
  },
  header: {
    marginBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#67e8f9',
    borderBottomStyle: 'solid',
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#067',
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginBottom: 3,
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 4,
  },
  infoColumn: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 8,
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  table: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#067',
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 8,
    padding: 6,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRowEven: {
    backgroundColor: '#f9fafb',
  },
  cellMois: {
    width: '8%',
    textAlign: 'center',
  },
  cellDate: {
    width: '14%',
    textAlign: 'left',
  },
  cellPrincipal: {
    width: '16%',
    textAlign: 'right',
  },
  cellInterets: {
    width: '16%',
    textAlign: 'right',
  },
  cellAssurance: {
    width: '15%',
    textAlign: 'right',
  },
  cellTotal: {
    width: '16%',
    textAlign: 'right',
    fontWeight: 'bold',
  },
  cellCRD: {
    width: '15%',
    textAlign: 'right',
    color: '#d97706',
  },
  footer: {
    position: 'absolute',
    bottom: 15,
    left: 15,
    right: 15,
    textAlign: 'center',
    fontSize: 7,
    color: '#999',
    borderTopWidth: 0.5,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  pageNumber: {
    fontSize: 7,
    color: '#666',
  },
});

export interface LoanAmortizationData {
  loanLabel: string;
  propertyName: string;
  principal: number;
  annualRatePct: number;
  durationMonths: number;
  insurancePct: number;
  startDate: string;
  schedule: {
    month: number;
    date: string;
    paymentPrincipal: number;
    paymentInterest: number;
    paymentInsurance: number;
    paymentTotal: number;
    remainingCapital: number;
  }[];
}

export function LoanAmortizationPdf({ data }: { data: LoanAmortizationData }) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Paginer le tableau (30 lignes par page)
  const rowsPerPage = 30;
  const pages: typeof data.schedule[] = [];
  for (let i = 0; i < data.schedule.length; i += rowsPerPage) {
    pages.push(data.schedule.slice(i, i + rowsPerPage));
  }

  return (
    <Document>
      {pages.map((pageSchedule, pageIndex) => (
        <Page key={pageIndex} size="A4" orientation="landscape" style={styles.page}>
          {/* Header (seulement sur la première page) */}
          {pageIndex === 0 && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Tableau d'Amortissement</Text>
                <Text style={styles.subtitle}>{data.loanLabel}</Text>
                <Text style={styles.subtitle}>{data.propertyName}</Text>
              </View>

              {/* Informations du prêt */}
              <View style={styles.infoGrid}>
                <View style={styles.infoColumn}>
                  <Text style={styles.infoLabel}>Capital emprunté</Text>
                  <Text style={styles.infoValue}>{formatCurrency(data.principal)}</Text>
                </View>
                <View style={styles.infoColumn}>
                  <Text style={styles.infoLabel}>Taux annuel</Text>
                  <Text style={styles.infoValue}>{data.annualRatePct}%</Text>
                </View>
                <View style={styles.infoColumn}>
                  <Text style={styles.infoLabel}>Durée</Text>
                  <Text style={styles.infoValue}>{data.durationMonths} mois</Text>
                </View>
                <View style={styles.infoColumn}>
                  <Text style={styles.infoLabel}>Assurance</Text>
                  <Text style={styles.infoValue}>{data.insurancePct}%/an</Text>
                </View>
                <View style={styles.infoColumn}>
                  <Text style={styles.infoLabel}>Date de début</Text>
                  <Text style={styles.infoValue}>{data.startDate}</Text>
                </View>
              </View>
            </>
          )}

          {/* Tableau */}
          <View style={styles.table}>
            {/* Header du tableau */}
            <View style={styles.tableHeader}>
              <Text style={styles.cellMois}>Mois</Text>
              <Text style={styles.cellDate}>Date</Text>
              <Text style={styles.cellPrincipal}>Principal</Text>
              <Text style={styles.cellInterets}>Intérêts</Text>
              <Text style={styles.cellAssurance}>Assurance</Text>
              <Text style={styles.cellTotal}>Total</Text>
              <Text style={styles.cellCRD}>CRD</Text>
            </View>

            {/* Lignes du tableau */}
            {pageSchedule.map((row, index) => (
              <View
                key={row.month}
                style={[styles.tableRow, index % 2 === 0 ? styles.tableRowEven : {}]}
              >
                <Text style={styles.cellMois}>{row.month}</Text>
                <Text style={styles.cellDate}>{row.date}</Text>
                <Text style={styles.cellPrincipal}>{formatCurrency(row.paymentPrincipal)}</Text>
                <Text style={styles.cellInterets}>{formatCurrency(row.paymentInterest)}</Text>
                <Text style={styles.cellAssurance}>{formatCurrency(row.paymentInsurance)}</Text>
                <Text style={styles.cellTotal}>{formatCurrency(row.paymentTotal)}</Text>
                <Text style={styles.cellCRD}>{formatCurrency(row.remainingCapital)}</Text>
              </View>
            ))}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.pageNumber}>
              Page {pageIndex + 1} / {pages.length} • Généré le{' '}
              {new Date().toLocaleDateString('fr-FR')} • SmartImmo
            </Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}




















