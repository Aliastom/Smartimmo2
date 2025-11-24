/**
 * Template PDF pour le rapport d'anomalies de gestion déléguée
 * Utilise @react-pdf/renderer pour un rendu professionnel
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { DelegatedManagementReportData } from '@/types/reports';

// Styles professionnels
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  
  // Header
  header: {
    marginBottom: 30,
    borderBottom: '3 solid #2563eb',
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 10,
  },
  headerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    fontSize: 9,
    color: '#64748b',
  },
  
  // Sections
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 10,
    paddingBottom: 5,
    borderBottom: '1 solid #cbd5e1',
  },
  
  // Grille de données
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    gap: 10,
  },
  gridLabel: {
    flex: 1,
    color: '#475569',
  },
  gridValue: {
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'right',
    minWidth: 80,
  },
  
  // Cartes colorées
  card: {
    backgroundColor: '#f8fafc',
    border: '1 solid #e2e8f0',
    borderRadius: 5,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 8,
  },
  
  // Highlights
  highlightRed: {
    backgroundColor: '#fef2f2',
    border: '1 solid #fecaca',
    borderRadius: 5,
    padding: 10,
    marginBottom: 5,
  },
  highlightOrange: {
    backgroundColor: '#fff7ed',
    border: '1 solid #fed7aa',
    borderRadius: 5,
    padding: 10,
    marginBottom: 5,
  },
  
  // Tableau
  table: {
    marginTop: 10,
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e0e7ff',
    padding: 8,
    fontWeight: 'bold',
    fontSize: 9,
    borderBottom: '2 solid #6366f1',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottom: '1 solid #e2e8f0',
  },
  tableRowAlt: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#f8fafc',
    borderBottom: '1 solid #e2e8f0',
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
  },
  
  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: '1 solid #e2e8f0',
    paddingTop: 10,
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

interface DelegatedManagementReportPDFProps {
  data: DelegatedManagementReportData;
}

export function DelegatedManagementReportPDF({ data }: DelegatedManagementReportPDFProps) {
  const formatEuro = (amount: number) => {
    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    const rounded = Math.round(absAmount * 100) / 100;
    const parts = rounded.toFixed(2).split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];
    const withSeparator = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${sign}${withSeparator},${decimalPart} EUR`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatPeriod = () => {
    return `${formatDate(data.period.from)} - ${formatDate(data.period.to)}`;
  };

  const hasAnomalies = 
    data.summary.totalLateRents > 0 ||
    data.summary.totalUnmatchedTransactions > 0 ||
    data.summary.totalAmountGapsCases > 0 ||
    data.summary.totalMissingIndexationsCases > 0;

  // Render PDF document
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Rapport d'anomalies</Text>
              <Text style={[styles.subtitle, { color: '#2563eb', fontSize: 10, fontWeight: 'bold' }]}>
                Gestionnaire délégué : {data.gestionnaire.name}
              </Text>
              <Text style={styles.subtitle}>
                Période : {formatPeriod()}
              </Text>
            </View>
            <View style={{ textAlign: 'right' }}>
              <Text style={{ fontSize: 9, color: '#64748b' }}>
                Généré le
              </Text>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1e40af' }}>
                {new Date().toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </Text>
            </View>
          </View>
        </View>

        {/* SYNTHÈSE GLOBALE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SYNTHÈSE GLOBALE</Text>
          
          {!hasAnomalies ? (
            <View style={[styles.card, { backgroundColor: '#f0fdf4', border: '1 solid #bbf7d0' }]}>
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#166534', marginBottom: 5 }}>
                ✅ Aucune anomalie détectée
              </Text>
              <Text style={{ fontSize: 10, color: '#15803d' }}>
                Aucune anomalie n'a été détectée pour la période sélectionnée concernant le gestionnaire délégué {data.gestionnaire.name}.
              </Text>
              <Text style={{ fontSize: 9, color: '#64748b', marginTop: 8 }}>
                Nombre de baux concernés : {data.summary.totalBaux}
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.grid}>
                <Text style={styles.gridLabel}>Nombre de baux concernés</Text>
                <Text style={styles.gridValue}>{data.summary.totalBaux}</Text>
              </View>
              {data.summary.totalLateRents > 0 && (
                <View style={styles.grid}>
                  <Text style={styles.gridLabel}>Loyers en retard</Text>
                  <Text style={[styles.gridValue, { color: '#dc2626' }]}>
                    {data.summary.totalLateRents} ({formatEuro(data.summary.totalLateRentsAmount)})
                  </Text>
                </View>
              )}
              {data.summary.totalUnmatchedTransactions > 0 && (
                <View style={styles.grid}>
                  <Text style={styles.gridLabel}>Transactions non rapprochées</Text>
                  <Text style={[styles.gridValue, { color: '#f97316' }]}>
                    {data.summary.totalUnmatchedTransactions} ({formatEuro(data.summary.totalUnmatchedAmount)})
                  </Text>
                </View>
              )}
              {data.summary.totalAmountGapsCases > 0 && (
                <View style={styles.grid}>
                  <Text style={styles.gridLabel}>Écarts de montant</Text>
                  <Text style={[styles.gridValue, { color: '#f97316' }]}>
                    {data.summary.totalAmountGapsCases} ({formatEuro(data.summary.totalAmountGapsValue)})
                  </Text>
                </View>
              )}
              {data.summary.totalMissingIndexationsCases > 0 && (
                <View style={styles.grid}>
                  <Text style={styles.gridLabel}>Indexations non appliquées</Text>
                  <Text style={[styles.gridValue, { color: '#f97316' }]}>
                    {data.summary.totalMissingIndexationsCases} ({formatEuro(data.summary.totalMissingIndexationsAmount)})
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* LOYERS EN RETARD */}
        {data.lateRents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>LOYERS EN RETARD</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, { flex: 2 }]}>Bien</Text>
                <Text style={styles.tableCell}>Locataire</Text>
                <Text style={styles.tableCell}>Mois</Text>
                <Text style={[styles.tableCell, { textAlign: 'right' }]}>Dû</Text>
                <Text style={[styles.tableCell, { textAlign: 'right' }]}>Payé</Text>
                <Text style={[styles.tableCell, { textAlign: 'right' }]}>Retard</Text>
              </View>
              {data.lateRents.map((rent, i) => (
                <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.tableCell, { flex: 2, fontSize: 8 }]}>
                    {rent.bienLabel}
                  </Text>
                  <Text style={[styles.tableCell, { fontSize: 8 }]}>{rent.locataireName}</Text>
                  <Text style={[styles.tableCell, { fontSize: 8 }]}>{rent.month}</Text>
                  <Text style={[styles.tableCell, { textAlign: 'right', fontSize: 8 }]}>
                    {formatEuro(rent.dueAmount)}
                  </Text>
                  <Text style={[styles.tableCell, { textAlign: 'right', fontSize: 8 }]}>
                    {formatEuro(rent.paidAmount)}
                  </Text>
                  <Text style={[styles.tableCell, { textAlign: 'right', fontSize: 8, color: '#dc2626' }]}>
                    {rent.delayInDays ? `${rent.delayInDays}j` : '-'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* TRANSACTIONS NON RAPPROCHÉES */}
        {data.unmatchedTransactions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TRANSACTIONS NON RAPPROCHÉES</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, { flex: 1.2 }]}>Date</Text>
                <Text style={[styles.tableCell, { flex: 2.5 }]}>Libellé</Text>
                <Text style={[styles.tableCell, { flex: 1.2, textAlign: 'right' }]}>Montant</Text>
                <Text style={[styles.tableCell, { flex: 1.5 }]}>Bien</Text>
              </View>
              {data.unmatchedTransactions.map((trans, i) => (
                <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.tableCell, { flex: 1.2, fontSize: 8 }]}>
                    {formatDate(trans.date)}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 2.5, fontSize: 8 }]}>{trans.label}</Text>
                  <Text style={[styles.tableCell, { flex: 1.2, textAlign: 'right', fontSize: 8 }]}>
                    {formatEuro(trans.amount)}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1.5, fontSize: 8 }]}>
                    {trans.potentialBien || '-'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ÉCARTS DE MONTANT */}
        {data.amountGaps.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ÉCARTS DE MONTANT</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableCell}>Bien</Text>
                <Text style={styles.tableCell}>Locataire</Text>
                <Text style={styles.tableCell}>Mois</Text>
                <Text style={[styles.tableCell, { textAlign: 'right' }]}>Attendu</Text>
                <Text style={[styles.tableCell, { textAlign: 'right' }]}>Reversé</Text>
                <Text style={[styles.tableCell, { textAlign: 'right' }]}>Différence</Text>
              </View>
              {data.amountGaps.map((gap, i) => (
                <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.tableCell, { fontSize: 8 }]}>{gap.bienLabel}</Text>
                  <Text style={[styles.tableCell, { fontSize: 8 }]}>{gap.locataireName}</Text>
                  <Text style={[styles.tableCell, { fontSize: 8 }]}>{gap.month}</Text>
                  <Text style={[styles.tableCell, { textAlign: 'right', fontSize: 8 }]}>
                    {formatEuro(gap.expectedAmount)}
                  </Text>
                  <Text style={[styles.tableCell, { textAlign: 'right', fontSize: 8 }]}>
                    {formatEuro(gap.receivedAmount)}
                  </Text>
                  <Text style={[styles.tableCell, { textAlign: 'right', fontSize: 8, color: '#dc2626' }]}>
                    {formatEuro(gap.diff)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ÉVOLUTION DES LOYERS EN RETARD (graphique) */}
        {data.charts.lateRentsCountByMonth.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ÉVOLUTION DES LOYERS EN RETARD</Text>
            
              {/* Graphique en ligne (comme le dashboard) */}
              <View style={{ marginTop: 15, marginBottom: 20 }}>
                {(() => {
                  const chartData = data.charts.lateRentsCountByMonth;
                  const maxCount = Math.max(...chartData.map(m => m.count), 1);
                  const chartHeight = 200;
                  const chartWidth = 500;
                  const paddingLeft = 50;
                  const paddingRight = 30;
                  const paddingTop = 20;
                  const paddingBottom = 40;
                  const graphWidth = chartWidth - paddingLeft - paddingRight;
                  const graphHeight = chartHeight - paddingTop - paddingBottom;
                  const stepX = chartData.length > 1 ? graphWidth / (chartData.length - 1) : 0;
                  
                  // Formater le mois pour l'affichage (ex: "2025-07" -> "juil. 2025")
                  const formatMonthLabel = (month: string) => {
                    const [year, monthNum] = month.split('-');
                    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
                    return date.toLocaleDateString('fr-FR', {
                      month: 'short',
                      year: 'numeric',
                    });
                  };
                  
                  // Calculer les coordonnées des points
                  const points = chartData.map((item, i) => ({
                    x: paddingLeft + (i * stepX),
                    y: paddingTop + graphHeight - ((item.count / maxCount) * graphHeight),
                    count: item.count,
                    month: item.month,
                  }));
                  
                  return (
                    <View>
                      {/* Titre Y axis */}
                      <View style={{ marginLeft: 10, marginBottom: 5 }}>
                        <Text style={{ fontSize: 9, color: '#6b7280' }}>Nombre de loyers</Text>
                      </View>
                      
                      <View style={{ width: chartWidth, height: chartHeight, position: 'relative' }}>
                        {/* Grille de fond (lignes horizontales) */}
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                          const y = paddingTop + (graphHeight * (1 - ratio));
                          const value = Math.round(maxCount * ratio);
                          return (
                            <React.Fragment key={i}>
                              <View style={{
                                position: 'absolute',
                                left: paddingLeft,
                                top: y - 0.5,
                                width: graphWidth,
                                height: 1,
                                backgroundColor: '#e5e7eb',
                                borderTop: '1 dotted #e5e7eb',
                              }} />
                              {i > 0 && (
                                <Text
                                  style={{
                                    position: 'absolute',
                                    left: 5,
                                    top: y - 6,
                                    fontSize: 8,
                                    color: '#6b7280',
                                  }}
                                >
                                  {value}
                                </Text>
                              )}
                            </React.Fragment>
                          );
                        })}
                        
                        {/* Ligne du graphique (avec des petits View pour simuler une ligne) */}
                        {points.map((point, i) => {
                          if (i === 0) return null;
                          const prevPoint = points[i - 1];
                          const dx = point.x - prevPoint.x;
                          const dy = point.y - prevPoint.y;
                          const distance = Math.sqrt(dx * dx + dy * dy);
                          const segments = Math.max(10, Math.floor(distance / 3));
                          
                          return (
                            <React.Fragment key={`line-${i}`}>
                              {Array.from({ length: segments }).map((_, segIdx) => {
                                const t = (segIdx + 1) / segments;
                                const x = prevPoint.x + (dx * t);
                                const y = prevPoint.y + (dy * t);
                                return (
                                  <View
                                    key={`seg-${i}-${segIdx}`}
                                    style={{
                                      position: 'absolute',
                                      left: x - 1,
                                      top: y - 1,
                                      width: 2,
                                      height: 2,
                                      backgroundColor: '#ef4444',
                                    }}
                                  />
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                        
                        {/* Points */}
                        {points.map((point, i) => (
                          <View
                            key={`point-${i}`}
                            style={{
                              position: 'absolute',
                              left: point.x - 4,
                              top: point.y - 4,
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: '#ef4444',
                              border: '1 solid #ffffff',
                            }}
                          />
                        ))}
                        
                        {/* Labels Y (valeurs) */}
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                          const y = paddingTop + (graphHeight * (1 - ratio));
                          const value = Math.round(maxCount * ratio);
                          if (i === 0) return null;
                          return (
                            <Text
                              key={`y-label-${i}`}
                              style={{
                                position: 'absolute',
                                left: 5,
                                top: y - 6,
                                fontSize: 8,
                                color: '#6b7280',
                              }}
                            >
                              {value}
                            </Text>
                          );
                        })}
                        
                        {/* Labels X (mois) */}
                        {points.map((point, i) => (
                          <View
                            key={`x-label-${i}`}
                            style={{
                              position: 'absolute',
                              left: point.x - 35,
                              top: paddingTop + graphHeight + 5,
                              width: 70,
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ fontSize: 8, color: '#6b7280', textAlign: 'center' }}>
                              {formatMonthLabel(point.month)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })()}
            
            {/* Tableau de synthèse sous le graphique */}
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableCell}>Mois</Text>
                <Text style={[styles.tableCell, { textAlign: 'right' }]}>Nombre de retards</Text>
                <Text style={[styles.tableCell, { textAlign: 'right' }]}>Montant total (EUR)</Text>
              </View>
              {data.charts.lateRentsCountByMonth.map((month, i) => {
                const amountData = data.charts.lateRentsAmountByMonth.find(m => m.month === month.month);
                return (
                  <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                    <Text style={[styles.tableCell, { fontSize: 8 }]}>{month.month}</Text>
                    <Text style={[styles.tableCell, { textAlign: 'right', fontSize: 8 }]}>
                      {month.count}
                    </Text>
                    <Text style={[styles.tableCell, { textAlign: 'right', fontSize: 8 }]}>
                      {formatEuro(amountData?.amount || 0)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text>
            Document généré par SmartImmo - Rapport d'anomalies de gestion déléguée
          </Text>
          <Text style={{ marginTop: 3, fontSize: 7, fontStyle: 'italic' }}>
            Ce document récapitule les anomalies détectées pour le gestionnaire délégué {data.gestionnaire.name} sur la période {formatPeriod()}.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

