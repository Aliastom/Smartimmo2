/**
 * Template PDF pour le rapport d'anomalies de gestion déléguée
 * Utilise @react-pdf/renderer pour un rendu professionnel
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Svg, Line, Circle } from '@react-pdf/renderer';
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

  // Composant header réutilisable
  const renderHeader = () => (
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
  );

  // Composant footer réutilisable
  const renderFooter = () => (
    <View style={styles.footer}>
      <Text>
        Document généré par SmartImmo - Rapport d'anomalies de gestion déléguée
      </Text>
      <Text style={{ marginTop: 3, fontSize: 7, fontStyle: 'italic' }}>
        Ce document récapitule les anomalies détectées pour le gestionnaire délégué {data.gestionnaire.name} sur la période {formatPeriod()}.
      </Text>
    </View>
  );

  return (
    <Document>
      {/* PREMIÈRE PAGE : Synthèse + Loyers en retard */}
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        {renderHeader()}

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

        {/* FOOTER */}
        {renderFooter()}
      </Page>

      {/* DEUXIÈME PAGE : Transactions non rapprochées + Autres sections */}
      {(data.unmatchedTransactions.length > 0 || data.amountGaps.length > 0 || data.charts.lateRentsCountByMonth.length > 0) && (
        <Page size="A4" style={styles.page}>
          {/* HEADER */}
          {renderHeader()}

          {/* TRANSACTIONS NON RAPPROCHÉES */}
        {data.unmatchedTransactions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TRANSACTIONS NON RAPPROCHÉES</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={{ width: '18%', fontSize: 9, fontWeight: 'bold' }}>Date</Text>
                <Text style={{ width: '42%', fontSize: 9, fontWeight: 'bold' }}>Libellé</Text>
                <Text style={{ width: '20%', fontSize: 9, fontWeight: 'bold', textAlign: 'right', paddingRight: 8 }}>Montant</Text>
                <Text style={{ width: '20%', fontSize: 9, fontWeight: 'bold', paddingLeft: 8 }}>Bien</Text>
              </View>
              {data.unmatchedTransactions.map((trans, i) => (
                <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={{ width: '18%', fontSize: 8 }}>
                    {formatDate(trans.date)}
                  </Text>
                  <Text style={{ width: '42%', fontSize: 8 }}>{trans.label}</Text>
                  <Text style={{ width: '20%', fontSize: 8, textAlign: 'right', paddingRight: 8 }}>
                    {formatEuro(trans.amount)}
                  </Text>
                  <Text style={{ width: '20%', fontSize: 8, paddingLeft: 8 }}>
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
                  
                  // Calculer les coordonnées des points (dans l'espace SVG, sans paddingLeft)
                  const points = chartData.map((item, i) => ({
                    x: (i * stepX), // X dans l'espace SVG (sans paddingLeft)
                    y: paddingTop + graphHeight - ((item.count / maxCount) * graphHeight),
                    count: item.count,
                    month: item.month,
                  }));
                  
                  return (
                    <View style={{ width: '100%', alignItems: 'center', marginBottom: 10 }}>
                      {/* Conteneur avec valeurs Y à gauche et graphique */}
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', width: chartWidth }}>
                        {/* Valeurs de l'axe Y - à gauche */}
                        <View style={{
                          width: paddingLeft,
                          height: chartHeight,
                          justifyContent: 'space-between',
                          paddingTop: paddingTop,
                          paddingBottom: paddingBottom,
                        }}>
                          {[maxCount, Math.round(maxCount * 0.75), Math.round(maxCount * 0.5), Math.round(maxCount * 0.25), 0].map((value, i) => (
                            <Text 
                              key={i} 
                              style={{ 
                                fontSize: 7, 
                                color: '#6b7280',
                                textAlign: 'right',
                              }}
                            >
                              {value}
                            </Text>
                          ))}
                        </View>
                        
                        {/* Graphique SVG */}
                        <Svg width={graphWidth + paddingRight} height={chartHeight} viewBox={`0 0 ${graphWidth + paddingRight} ${chartHeight}`}>
                          {/* Grille horizontale (lignes pointillées) */}
                          {[0, 1, 2, 3, 4].map((i) => {
                            const y = paddingTop + (graphHeight / 4) * i;
                            return (
                              <Line
                                key={`grid-${i}`}
                                x1={0}
                                y1={y}
                                x2={graphWidth}
                                y2={y}
                                stroke="#e5e7eb"
                                strokeWidth={1}
                                strokeDasharray="3 3"
                              />
                            );
                          })}
                          
                          {/* Ligne du graphique (créée avec plusieurs segments Line) */}
                          {points.length > 1 && points.map((point, i) => {
                            if (i === points.length - 1) return null;
                            const nextPoint = points[i + 1];
                            return (
                              <Line
                                key={`line-${i}`}
                                x1={point.x}
                                y1={point.y}
                                x2={nextPoint.x}
                                y2={nextPoint.y}
                                stroke="#ef4444"
                                strokeWidth={2}
                              />
                            );
                          })}
                          
                          {/* Points sur la ligne */}
                          {points.map((point, i) => (
                            <Circle
                              key={`point-${i}`}
                              cx={point.x}
                              cy={point.y}
                              r={4}
                              fill="#ef4444"
                            />
                          ))}
                          
                          {/* Axe Y (ligne verticale) */}
                          <Line
                            x1={0}
                            y1={paddingTop}
                            x2={0}
                            y2={paddingTop + graphHeight}
                            stroke="#6b7280"
                            strokeWidth={1}
                          />
                          
                          {/* Axe X (ligne horizontale) */}
                          <Line
                            x1={0}
                            y1={paddingTop + graphHeight}
                            x2={graphWidth}
                            y2={paddingTop + graphHeight}
                            stroke="#6b7280"
                            strokeWidth={1}
                          />
                        </Svg>
                      </View>
                      
                      {/* Labels de l'axe X (mois) */}
                      <View style={{ 
                        flexDirection: 'row', 
                        width: chartWidth, 
                        justifyContent: 'space-between',
                        paddingLeft: paddingLeft,
                        paddingRight: paddingRight,
                        marginTop: 5,
                      }}>
                        {chartData.map((item, i) => (
                          <Text 
                            key={i} 
                            style={{ 
                              fontSize: 8, 
                              color: '#6b7280',
                              textAlign: 'center',
                              width: stepX > 0 ? stepX : 'auto',
                            }}
                          >
                            {formatMonthLabel(item.month)}
                          </Text>
                        ))}
                      </View>
                      
                      {/* Label de l'axe Y (en haut à gauche) */}
                      <View style={{ 
                        width: chartWidth,
                        paddingLeft: 5,
                        marginTop: 5,
                      }}>
                        <Text style={{ fontSize: 8, color: '#6b7280' }}>
                          Nombre de loyers
                        </Text>
                      </View>
                    </View>
                  );
                })()}
              </View>
            
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
          {renderFooter()}
        </Page>
      )}
    </Document>
  );
}

