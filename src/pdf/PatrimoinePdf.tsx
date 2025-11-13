import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

// Styles pour le PDF professionnel
const styles = StyleSheet.create({
  page: {
    padding: 30,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 25,
    paddingBottom: 15,
    borderBottom: '3px solid #3b82f6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  logo: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 5,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 11,
    color: '#6b7280',
  },
  section: {
    marginTop: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 10,
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 4,
  },
  kpiContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    border: '1.5px solid #e5e7eb',
  },
  kpiLabel: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 5,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  kpiSubtext: {
    fontSize: 8,
    color: '#9ca3af',
    marginTop: 3,
  },
  insightBox: {
    backgroundColor: '#e8f0fe',
    padding: 15,
    borderRadius: 8,
    borderLeft: '4px solid #3b82f6',
    marginTop: 5,
  },
  insightTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1f2937',
    flexDirection: 'row',
    alignItems: 'center',
  },
  insightItem: {
    marginBottom: 8,
  },
  insightText: {
    fontSize: 10,
    color: '#374151',
    marginBottom: 4,
    lineHeight: 1.5,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  insightIcon: {
    fontSize: 10,
    marginRight: 6,
  },
  recommendation: {
    fontSize: 9,
    color: '#6b7280',
    fontStyle: 'italic',
    marginLeft: 16,
    lineHeight: 1.4,
  },
  table: {
    marginTop: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #e5e7eb',
    paddingVertical: 6,
  },
  tableHeader: {
    backgroundColor: '#f3f4f6',
    fontWeight: 'bold',
    fontSize: 9,
  },
  tableCell: {
    fontSize: 9,
    padding: 4,
    color: '#374151',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: '1px solid #e5e7eb',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
  },
  chartSection: {
    marginBottom: 15,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  chartContainer: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottom: '0.5px solid #e5e7eb',
  },
  chartLabel: {
    fontSize: 9,
    color: '#374151',
    width: '30%',
  },
  chartBar: {
    height: 12,
    borderRadius: 2,
    marginTop: 2,
  },
  chartValue: {
    fontSize: 9,
    color: '#1f2937',
    fontWeight: 'bold',
    textAlign: 'right',
    width: '20%',
  },
  twoColumnGrid: {
    flexDirection: 'row',
    gap: 15,
  },
  column: {
    flex: 1,
  },
  agendaYear: {
    fontSize: 11,
    fontWeight: 'bold',
    backgroundColor: '#f3f4f6',
    padding: 6,
    marginTop: 10,
    marginBottom: 5,
    borderRadius: 4,
  },
  agendaRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottom: '0.5px solid #e5e7eb',
  },
  agendaDate: {
    fontSize: 9,
    color: '#6b7280',
    width: '15%',
  },
  agendaLabel: {
    fontSize: 9,
    color: '#374151',
    width: '40%',
  },
  agendaType: {
    fontSize: 8,
    color: '#6b7280',
    width: '20%',
  },
  agendaBadge: {
    fontSize: 8,
    padding: 3,
    borderRadius: 3,
    width: '15%',
    textAlign: 'center',
  },
  agendaAmount: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'right',
    width: '10%',
  },
});

interface PatrimoinePdfProps {
  from: string;
  to: string;
  mode: string;
  kpis: {
    valeurParc: number | null;
    encoursDette: number | null;
    cashflowMois: number | null;
    cashflowAnnuelMoyen: number | null;
    rendementNet: number | null;
    vacancePct: number | null;
  };
  insights: Array<{
    message: string;
    type: 'positive' | 'negative' | 'warning';
    recommendation?: string;
  }>;
  transactions: Array<{
    date: string;
    accounting_month: string | null;
    nature: string | null;
    label: string | null;
    amount: number;
    propertyName: string | null;
  }>;
  properties: Array<{
    name: string;
    value: number;
  }>;
  chartData?: {
    loyers: Array<{ month: string; value: number }>;
    charges: Array<{ month: string; value: number }>;
    cashflow: Array<{ month: string; value: number }>;
  };
  agenda?: Array<{
    date: string;
    type: string;
    label: string;
    amount?: number;
  }>;
}

const PatrimoinePdf: React.FC<PatrimoinePdfProps> = ({
  from,
  to,
  mode,
  kpis,
  insights,
  transactions,
  properties,
  chartData,
  agenda,
}) => {
  const formatCurrency = (value: number | null) => {
    if (value === null) return '—';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number | null) => {
    if (value === null) return '—';
    return `${value.toFixed(1)}%`;
  };

  const getModeLabel = () => {
    if (mode === 'realise') return 'Réalisé';
    if (mode === 'prevision') return 'Prévisionnel';
    return 'Lissé';
  };

  const getInsightIcon = (type: string) => {
    if (type === 'positive') return '🔼';
    if (type === 'negative') return '🔽';
    return '⚠️';
  };

  const today = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Document>
      {/* Page 1 : KPIs et Analyse */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* En-tête professionnel */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.logo}>📊 Smartimmo</Text>
            <Text style={styles.title}>Rapport Patrimoine Immobilier</Text>
            <Text style={styles.subtitle}>
              Période : {from} → {to} • Mode : {getModeLabel()}
            </Text>
          </View>
          <View>
            <Text style={[styles.subtitle, { textAlign: 'right' }]}>
              Généré le {today}
            </Text>
          </View>
        </View>

        {/* KPIs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 INDICATEURS CLÉS</Text>
          <View style={styles.kpiContainer}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Valeur du parc</Text>
              <Text style={styles.kpiValue}>{formatCurrency(kpis.valeurParc)}</Text>
              <Text style={styles.kpiSubtext}>Total immobilier</Text>
            </View>
            
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Encours / Dette</Text>
              <Text style={styles.kpiValue}>{formatCurrency(kpis.encoursDette)}</Text>
              <Text style={styles.kpiSubtext}>Dette totale</Text>
            </View>
            
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Cashflow du mois</Text>
              <Text style={styles.kpiValue}>{formatCurrency(kpis.cashflowMois)}</Text>
              <Text style={styles.kpiSubtext}>Solde mensuel</Text>
            </View>
            
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Cashflow moyen</Text>
              <Text style={styles.kpiValue}>{formatCurrency(kpis.cashflowAnnuelMoyen)}</Text>
              <Text style={styles.kpiSubtext}>Par mois (moyenne)</Text>
            </View>
            
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Rendement net</Text>
              <Text style={styles.kpiValue}>{formatPercent(kpis.rendementNet)}</Text>
              <Text style={styles.kpiSubtext}>Sur valeur du parc</Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Vacance</Text>
              <Text style={styles.kpiValue}>{formatPercent(kpis.vacancePct)}</Text>
              <Text style={styles.kpiSubtext}>Taux d'occupation</Text>
            </View>
          </View>
        </View>

        {/* Analyse */}
        {insights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💡 ANALYSE DE VOTRE PATRIMOINE</Text>
            <View style={styles.insightBox}>
              {insights.map((insight, index) => (
                <View key={index} style={styles.insightItem}>
                  <View style={styles.insightText}>
                    <Text style={styles.insightIcon}>{getInsightIcon(insight.type)}</Text>
                    <Text style={{ flex: 1 }}>{insight.message}</Text>
                  </View>
                  {insight.recommendation && (
                    <Text style={styles.recommendation}>
                      → {insight.recommendation}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Liste des biens */}
        {properties.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏠 RÉPARTITION PAR BIEN</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.tableCell, { width: '60%' }]}>Bien</Text>
                <Text style={[styles.tableCell, { width: '20%', textAlign: 'right' }]}>Valeur</Text>
                <Text style={[styles.tableCell, { width: '20%', textAlign: 'right' }]}>Part</Text>
              </View>
              {properties.slice(0, 10).map((prop, index) => {
                const totalValue = properties.reduce((sum, p) => sum + p.value, 0);
                const percentage = totalValue > 0 ? ((prop.value / totalValue) * 100).toFixed(0) : 0;
                
                return (
                  <View key={index} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { width: '60%' }]}>{prop.name}</Text>
                    <Text style={[styles.tableCell, { width: '20%', textAlign: 'right' }]}>
                      {formatCurrency(prop.value)}
                    </Text>
                    <Text style={[styles.tableCell, { width: '20%', textAlign: 'right' }]}>
                      {percentage}%
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Pied de page */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Smartimmo — Rapport Patrimoine</Text>
          <Text style={styles.footerText}>Page 1/3 • {today}</Text>
        </View>
      </Page>

      {/* Page 2 : Graphiques */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.logo}>📊 Smartimmo</Text>
            <Text style={styles.title}>Graphiques d'analyse</Text>
          </View>
        </View>

        {/* Graphiques en grille 2x2 */}
        {chartData && (
          <>
            {/* Ligne 1 : Loyers vs Charges + Cashflow mensuel */}
            <View style={styles.twoColumnGrid}>
              {/* Loyers vs Charges */}
              <View style={styles.column}>
                <View style={styles.chartSection}>
                  <Text style={styles.chartTitle}>📊 Loyers vs Charges</Text>
                  <View style={styles.chartContainer}>
                    {chartData.loyers.slice(0, 12).map((item, index) => {
                      const chargeValue = chartData.charges[index]?.value || 0;
                      const maxValue = Math.max(
                        ...chartData.loyers.map(l => l.value),
                        ...chartData.charges.map(c => c.value)
                      );
                      const [year, month] = item.month.split('-');
                      const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
                      
                      return (
                        <View key={index} style={styles.chartRow}>
                          <Text style={styles.chartLabel}>{monthNames[parseInt(month) - 1]}</Text>
                          <View style={{ flex: 1, flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                            <View 
                              style={[
                                styles.chartBar, 
                                { 
                                  width: `${(item.value / maxValue) * 100}%`,
                                  backgroundColor: '#3b82f6'
                                }
                              ]} 
                            />
                            <View 
                              style={[
                                styles.chartBar, 
                                { 
                                  width: `${(chargeValue / maxValue) * 100}%`,
                                  backgroundColor: '#ef4444'
                                }
                              ]} 
                            />
                          </View>
                          <Text style={styles.chartValue}>
                            {formatCurrency(item.value - chargeValue)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* Cashflow mensuel */}
              <View style={styles.column}>
                <View style={styles.chartSection}>
                  <Text style={styles.chartTitle}>💰 Cashflow mensuel</Text>
                  <View style={styles.chartContainer}>
                    {chartData.cashflow.slice(0, 12).map((item, index) => {
                      const [year, month] = item.month.split('-');
                      const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
                      const isPositive = item.value >= 0;
                      
                      return (
                        <View key={index} style={styles.chartRow}>
                          <Text style={styles.chartLabel}>{monthNames[parseInt(month) - 1]}</Text>
                          <Text style={[styles.chartValue, { color: isPositive ? '#10b981' : '#ef4444' }]}>
                            {formatCurrency(item.value)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>

            {/* Ligne 2 : Cashflow cumulé */}
            <View style={styles.chartSection}>
              <Text style={styles.chartTitle}>📈 Cashflow cumulé (trésorerie projetée)</Text>
              <View style={styles.chartContainer}>
                {chartData.cashflow.slice(0, 12).map((item, index) => {
                  const cumul = chartData.cashflow
                    .slice(0, index + 1)
                    .reduce((sum, i) => sum + i.value, 0);
                  const [year, month] = item.month.split('-');
                  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
                  const isPositive = cumul >= 0;
                  
                  return (
                    <View key={index} style={styles.chartRow}>
                      <Text style={styles.chartLabel}>{monthNames[parseInt(month) - 1]}</Text>
                      <Text style={[styles.chartValue, { color: isPositive ? '#22c55e' : '#ef4444' }]}>
                        {formatCurrency(cumul)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}

        {/* Pied de page */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Smartimmo — Rapport Patrimoine</Text>
          <Text style={styles.footerText}>Page 2/3 • {today}</Text>
        </View>
      </Page>

      {/* Page 3 : Échéancier et Transactions */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.logo}>📊 Smartimmo</Text>
            <Text style={styles.title}>Échéancier & Transactions</Text>
          </View>
        </View>

        {/* Échéancier si disponible */}
        {agenda && agenda.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📅 ÉCHÉANCIER PRÉVISIONNEL</Text>
            
            {/* Grouper par année */}
            {(() => {
              const grouped = new Map<string, typeof agenda>();
              agenda.forEach(item => {
                const year = item.date.substring(0, 4);
                if (!grouped.has(year)) grouped.set(year, []);
                grouped.get(year)!.push(item);
              });
              
              return Array.from(grouped.entries())
                .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                .slice(0, 3) // Limiter à 3 années
                .map(([year, items]) => (
                  <View key={year}>
                    <Text style={styles.agendaYear}>{year}</Text>
                    {items.slice(0, 15).map((item, index) => {
                      const itemDate = new Date(item.date);
                      const today = new Date();
                      const daysUntil = Math.ceil((itemDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      const isUpcoming = daysUntil > 0 && daysUntil <= 30;
                      
                      return (
                        <View key={index} style={styles.agendaRow}>
                          <Text style={styles.agendaDate}>
                            {itemDate.toLocaleDateString('fr-FR')}
                          </Text>
                          <Text style={styles.agendaLabel} numberOfLines={2}>
                            {item.label}
                          </Text>
                          <Text style={styles.agendaType}>{item.type}</Text>
                          <Text 
                            style={[
                              styles.agendaBadge,
                              { 
                                backgroundColor: isUpcoming ? '#fed7aa' : daysUntil > 0 ? '#d1fae5' : '#fecaca',
                                color: isUpcoming ? '#c2410c' : daysUntil > 0 ? '#065f46' : '#991b1b'
                              }
                            ]}
                          >
                            {isUpcoming ? '⚠️ Proche' : daysUntil > 0 ? '🟢 À venir' : '🔴 Passé'}
                          </Text>
                          <Text style={styles.agendaAmount}>
                            {item.amount ? formatCurrency(item.amount) : '—'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ));
            })()}
          </View>
        )}

        {/* Transactions récentes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💳 TRANSACTIONS RÉCENTES</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, { width: '10%' }]}>Mois</Text>
              <Text style={[styles.tableCell, { width: '12%' }]}>Date</Text>
              <Text style={[styles.tableCell, { width: '15%' }]}>Nature</Text>
              <Text style={[styles.tableCell, { width: '28%' }]}>Libellé</Text>
              <Text style={[styles.tableCell, { width: '20%' }]}>Bien</Text>
              <Text style={[styles.tableCell, { width: '15%', textAlign: 'right' }]}>Montant</Text>
            </View>
            {transactions.slice(0, 25).map((tx, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCell, { width: '10%' }]}>{tx.accounting_month || '—'}</Text>
                <Text style={[styles.tableCell, { width: '12%' }]}>
                  {new Date(tx.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                </Text>
                <Text style={[styles.tableCell, { width: '15%' }]} numberOfLines={1}>{tx.nature || '—'}</Text>
                <Text style={[styles.tableCell, { width: '28%' }]} numberOfLines={2}>
                  {tx.label || '—'}
                </Text>
                <Text style={[styles.tableCell, { width: '20%' }]} numberOfLines={1}>
                  {tx.propertyName || '—'}
                </Text>
                <Text style={[styles.tableCell, { width: '15%', textAlign: 'right', fontWeight: 'bold' }]}>
                  {formatCurrency(tx.amount)}
                </Text>
              </View>
            ))}
          </View>
          {transactions.length > 25 && (
            <Text style={{ fontSize: 9, color: '#6b7280', marginTop: 10, textAlign: 'center' }}>
              ... et {transactions.length - 25} autres transactions (total : {transactions.length})
            </Text>
          )}
        </View>

        {/* Pied de page */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Smartimmo — Rapport Patrimoine</Text>
          <Text style={styles.footerText}>Page 3/3 • {today}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default PatrimoinePdf;

