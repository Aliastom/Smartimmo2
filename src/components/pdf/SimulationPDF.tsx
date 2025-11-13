/**
 * Template PDF pour la simulation fiscale immobilière
 * Utilise @react-pdf/renderer pour un rendu professionnel
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { SimulationResult, OptimizationSuggestion } from '@/types/fiscal';

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
  highlightGreen: {
    backgroundColor: '#f0fdf4',
    border: '1 solid #bbf7d0',
    borderRadius: 5,
    padding: 10,
    marginBottom: 5,
  },
  highlightBlue: {
    backgroundColor: '#eff6ff',
    border: '1 solid #bfdbfe',
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
  
  // Badges
  badge: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    padding: '4 8',
    borderRadius: 3,
    fontSize: 8,
    fontWeight: 'bold',
  },
  badgeGreen: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  badgeOrange: {
    backgroundColor: '#fed7aa',
    color: '#c2410c',
  },
  
  // Totaux
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 10,
    borderTop: '2 solid #1e40af',
    fontWeight: 'bold',
    fontSize: 12,
  },
});

interface SimulationPDFProps {
  simulation: SimulationResult;
  suggestions?: OptimizationSuggestion[];
}

export function SimulationPDF({ simulation, suggestions = [] }: SimulationPDFProps) {
  const formatEuro = (amount: number) => {
    // Formatage manuel pour éviter les problèmes de rendu d'espaces
    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    
    // Arrondir à 2 décimales
    const rounded = Math.round(absAmount * 100) / 100;
    const parts = rounded.toFixed(2).split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1];
    
    // Ajouter séparateur de milliers
    const withSeparator = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    
    return `${sign}${withSeparator},${decimalPart} EUR`;
  };
  
  const formatPercent = (rate: number) => {
    const percent = (rate * 100).toFixed(1);
    return `${percent.replace('.', ',')} %`;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Calcul fiscal {simulation.inputs.year}</Text>
              <Text style={[styles.subtitle, { color: '#2563eb', fontSize: 10, fontWeight: 'bold' }]}>
                Simulation SmartImmo
              </Text>
              <Text style={styles.subtitle}>
                Calcul détaillé de l'impôt sur le revenu et des prélèvements sociaux
              </Text>
            </View>
            <View style={{ textAlign: 'right' }}>
              <Text style={{ fontSize: 9, color: '#64748b' }}>
                Généré le
              </Text>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1e40af' }}>
                {new Date(simulation.dateCalcul).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </Text>
              <Text style={{ fontSize: 8, color: '#64748b', marginTop: 2 }}>
                {new Date(simulation.dateCalcul).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </View>
          </View>
          <View style={styles.headerInfo}>
            <Text>Année de revenus : {simulation.inputs.year}</Text>
            <Text>Barèmes fiscaux : {simulation.taxParams.version}</Text>
            <Text>Source : {simulation.taxParams.source}</Text>
          </View>
        </View>

        {/* SECTION 1 : INFORMATIONS PERSONNELLES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INFORMATIONS PERSONNELLES</Text>
          <View style={styles.card}>
            <View style={styles.grid}>
              <Text style={styles.gridLabel}>Salaire net imposable</Text>
              <Text style={styles.gridValue}>{formatEuro(simulation.inputs.foyer.salaire)}</Text>
            </View>
            <View style={styles.grid}>
              <Text style={styles.gridLabel}>Autres revenus</Text>
              <Text style={styles.gridValue}>{formatEuro(simulation.inputs.foyer.autresRevenus)}</Text>
            </View>
            <View style={styles.grid}>
              <Text style={styles.gridLabel}>Nombre de parts fiscales</Text>
              <Text style={styles.gridValue}>{simulation.inputs.foyer.parts}</Text>
            </View>
            <View style={styles.grid}>
              <Text style={styles.gridLabel}>Situation familiale</Text>
              <Text style={styles.gridValue}>
                {simulation.inputs.foyer.isCouple ? 'En couple (marié/pacsé)' : 'Célibataire'}
              </Text>
            </View>
          </View>
        </View>

        {/* SECTION 2 : PATRIMOINE IMMOBILIER */}
        {simulation.biens.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>REVENUS PAR BIEN ({simulation.biens.length} bien(s))</Text>
            
            {simulation.biens.map((bien, i) => {
              const interetsBien = bien.breakdown?.total?.interetsEmprunt || 0;
              const chargesHorsInterets = bien.chargesDeductibles - interetsBien;
              const isDeficit = bien.resultatFiscal < 0;
              
              return (
                <View key={i} style={[
                  styles.card,
                  { backgroundColor: isDeficit ? '#FFEBEB' : '#E8F6EE', borderLeft: `3 solid ${isDeficit ? '#ef4444' : '#10b981'}` }
                ]}>
                  <Text style={styles.cardHeader}>{bien.nom} ({bien.type})</Text>
                  <View style={styles.grid}>
                    <Text style={styles.gridLabel}>Régime fiscal</Text>
                    <Text style={styles.gridValue}>{bien.regimeUtilise === 'micro' ? 'Micro-foncier' : 'Régime réel'}</Text>
                  </View>
                  <View style={styles.grid}>
                    <Text style={styles.gridLabel}>Loyers encaissés</Text>
                    <Text style={styles.gridValue}>{formatEuro(bien.recettesBrutes)}</Text>
                  </View>
                  <View style={styles.grid}>
                    <Text style={styles.gridLabel}>Charges hors intérêts</Text>
                    <Text style={styles.gridValue}>{formatEuro(chargesHorsInterets)}</Text>
                  </View>
                  <View style={styles.grid}>
                    <Text style={styles.gridLabel}>Intérêts d'emprunt</Text>
                    <Text style={styles.gridValue}>{formatEuro(interetsBien)}</Text>
                  </View>
                  {bien.amortissements > 0 && (
                    <View style={styles.grid}>
                      <Text style={styles.gridLabel}>Amortissements</Text>
                      <Text style={styles.gridValue}>{formatEuro(bien.amortissements)}</Text>
                    </View>
                  )}
                  <View style={[styles.grid, { marginTop: 5, paddingTop: 5, borderTop: '1 solid #cbd5e1' }]}>
                    <Text style={[styles.gridLabel, { fontWeight: 'bold' }]}>Résultat fiscal</Text>
                    <Text style={[styles.gridValue, { fontWeight: 'bold', color: isDeficit ? '#dc2626' : '#16a34a' }]}>
                      {formatEuro(bien.resultatFiscal)}
                    </Text>
                  </View>
                  
                  {/* Détail du déficit */}
                  {bien.deficit && bien.deficit > 0 && (
                    <View style={{ marginTop: 8, padding: 8, backgroundColor: '#fee2e2', border: '1 solid #fca5a5', borderRadius: 3 }}>
                      <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#991b1b', marginBottom: 3 }}>
                        DEFICIT TOTAL : {formatEuro(bien.deficit)}
                      </Text>
                      {bien.deficitImputableRevenuGlobal > 0 && (
                        <Text style={{ fontSize: 8, color: '#991b1b' }}>
                          • Imputable revenu global : {formatEuro(bien.deficitImputableRevenuGlobal)}
                        </Text>
                      )}
                      {bien.deficitReportable > 0 && (
                        <Text style={{ fontSize: 8, color: '#991b1b' }}>
                          • Reportable (10 ans) : {formatEuro(bien.deficitReportable)}
                        </Text>
                      )}
                    </View>
                  )}
                  
                  {/* Suggestion de régime */}
                  {bien.regimeUtilise !== bien.regimeSuggere && (
                    <View style={{ marginTop: 8, padding: 6, backgroundColor: '#fef3c7', borderRadius: 3 }}>
                      <Text style={{ fontSize: 8, color: '#92400e' }}>
                        REGIME SUGGERE : {bien.regimeSuggere === 'micro' ? 'Micro-foncier' : 'Régime réel'}
                        {bien.details.economieRegimeReel && ` (gain potentiel : ${formatEuro(Math.abs(bien.details.economieRegimeReel))}/an)`}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
            
            {/* CONSOLIDATION FONCIÈRE GLOBALE */}
            <Text style={[styles.sectionTitle, { marginTop: 15 }]}>CONSOLIDATION FONCIERE (GLOBAL)</Text>
            
            {/* Totaux */}
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9, color: '#64748b', marginBottom: 2 }}>Loyers totaux</Text>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#16a34a' }}>
                    {formatEuro(simulation.biens.reduce((sum, b) => sum + b.recettesBrutes, 0))}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9, color: '#64748b', marginBottom: 2 }}>Charges hors intérêts</Text>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#f97316' }}>
                    {formatEuro(simulation.biens.reduce((sum, b) => {
                      const interets = b.breakdown?.total?.interetsEmprunt || 0;
                      return sum + (b.chargesDeductibles - interets);
                    }, 0))}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9, color: '#64748b', marginBottom: 2 }}>Intérêts totaux</Text>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#dc2626' }}>
                    {formatEuro(simulation.biens.reduce((sum, b) => sum + (b.breakdown?.total?.interetsEmprunt || 0), 0))}
                  </Text>
                </View>
              </View>
            </View>
            
            {/* Résultat global */}
            <View style={styles.highlightBlue}>
              <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 8, color: '#1e40af' }}>
                RESULTAT FONCIER NET GLOBAL (avant imputation)
              </Text>
              <View style={styles.grid}>
                <Text style={styles.gridLabel}>Revenus fonciers nets</Text>
                <Text style={[styles.gridValue, { color: simulation.consolidation.revenusFonciers > 0 ? '#16a34a' : '#dc2626' }]}>
                  {formatEuro(simulation.consolidation.revenusFonciers > 0 
                    ? simulation.consolidation.revenusFonciers 
                    : -(simulation.consolidation.deficitFoncier || 0)
                  )}
                </Text>
              </View>
              <View style={styles.grid}>
                <Text style={styles.gridLabel}>Revenus BIC nets</Text>
                <Text style={styles.gridValue}>{formatEuro(simulation.consolidation.revenusBIC)}</Text>
              </View>
              
              {/* Détails imputation/report si déficit */}
              {simulation.consolidation.deficitFoncier > 0 && (
                <View style={{ marginTop: 8, padding: 8, backgroundColor: '#f8fafc', border: '1 solid #cbd5e1', borderRadius: 3 }}>
                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#475569', marginBottom: 4 }}>
                    DETAILS DU DEFICIT
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                    <Text style={{ fontSize: 8, color: '#64748b' }}>Imputable revenu global :</Text>
                    <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#3b82f6' }}>
                      {formatEuro(simulation.consolidation.deficitImputableRevenuGlobal || 0)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 8, color: '#64748b' }}>Intérêts reportables (10 ans) :</Text>
                    <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#f97316' }}>
                      {formatEuro(simulation.consolidation.deficitReportable || 0)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 7, color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>
                    💡 Les intérêts ne peuvent PAS s'imputer sur le revenu global, mais peuvent compenser des bénéfices fonciers futurs.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* SECTION 3 : CALCUL DE L'IMPÔT */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>IMPACT SUR L'IMPOT SUR LE REVENU (IR)</Text>
          
          {/* Revenu imposable avec détail imputation */}
          <View style={[styles.card, { backgroundColor: '#F3EFFF' }]}>
            {simulation.consolidation.deficitImputableRevenuGlobal > 0 && (
              <View style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1 solid #cbd5e1' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={{ fontSize: 8, color: '#64748b' }}>Revenu global initial :</Text>
                  <Text style={{ fontSize: 8, fontWeight: 'bold' }}>
                    {formatEuro(simulation.ir.revenuImposable + simulation.consolidation.deficitImputableRevenuGlobal)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 8, color: '#3b82f6' }}>Imputation foncière :</Text>
                  <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#3b82f6' }}>
                    -{formatEuro(simulation.consolidation.deficitImputableRevenuGlobal)}
                  </Text>
                </View>
              </View>
            )}
            
            <View style={styles.grid}>
              <Text style={[styles.gridLabel, { fontWeight: 'bold' }]}>
                {simulation.consolidation.deficitImputableRevenuGlobal > 0 ? 'Base imposable corrigée' : 'Revenu imposable total'}
              </Text>
              <Text style={[styles.gridValue, { fontWeight: 'bold', color: '#7c3aed' }]}>
                {formatEuro(simulation.ir.revenuImposable)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 8, color: '#64748b' }}>Nombre de parts</Text>
                <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{simulation.inputs.foyer.parts}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 8, color: '#64748b' }}>Revenu par part</Text>
                <Text style={{ fontSize: 9, fontWeight: 'bold' }}>{formatEuro(simulation.ir.revenuParPart)}</Text>
              </View>
            </View>
            
            {/* Gain fiscal */}
            {simulation.consolidation.deficitImputableRevenuGlobal > 0 && (
              <View style={{ marginTop: 8, padding: 8, backgroundColor: '#E8F6EE', border: '1 solid #86efac', borderRadius: 3 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#166534' }}>
                    💰 Gain fiscal (déficit imputé)
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#166534' }}>
                    -{formatEuro(simulation.consolidation.deficitImputableRevenuGlobal * simulation.ir.trancheMarginate)}
                  </Text>
                </View>
                <Text style={{ fontSize: 7, color: '#15803d' }}>
                  Économie estimée : {formatEuro(simulation.consolidation.deficitImputableRevenuGlobal)} × {formatPercent(simulation.ir.trancheMarginate)} (TMI)
                </Text>
              </View>
            )}
          </View>
          
          {/* Calcul IR */}
          <View style={styles.card}>
            <View style={styles.grid}>
              <Text style={styles.gridLabel}>Impôt brut (avant décote)</Text>
              <Text style={styles.gridValue}>{formatEuro(simulation.ir.impotBrut)}</Text>
            </View>
            {simulation.ir.decote > 0 && (
              <View style={styles.grid}>
                <Text style={[styles.gridLabel, { color: '#16a34a' }]}>Décote</Text>
                <Text style={[styles.gridValue, { color: '#16a34a' }]}>-{formatEuro(simulation.ir.decote)}</Text>
              </View>
            )}
            <View style={[styles.grid, { marginTop: 8, paddingTop: 8, borderTop: '1 solid #cbd5e1' }]}>
              <Text style={[styles.gridLabel, { fontWeight: 'bold', fontSize: 11, color: '#7c3aed' }]}>
                Impôt sur le revenu (IR)
              </Text>
              <Text style={[styles.gridValue, { fontWeight: 'bold', fontSize: 12, color: '#7c3aed' }]}>
                {formatEuro(simulation.ir.impotNet)}
              </Text>
            </View>
          </View>
          
          {/* Taux */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <View style={[styles.card, { flex: 1 }]}>
              <Text style={{ fontSize: 8, color: '#64748b', marginBottom: 2 }}>Taux moyen</Text>
              <Text style={{ fontSize: 10, fontWeight: 'bold' }}>{formatPercent(simulation.ir.tauxMoyen)}</Text>
            </View>
            <View style={[styles.card, { flex: 1 }]}>
              <Text style={{ fontSize: 8, color: '#64748b', marginBottom: 2 }}>Tranche marginale</Text>
              <Text style={{ fontSize: 10, fontWeight: 'bold' }}>{formatPercent(simulation.ir.trancheMarginate)}</Text>
            </View>
          </View>
        </View>

        {/* SECTION 4 : PRÉLÈVEMENTS SOCIAUX */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRELEVEMENTS SOCIAUX (PS)</Text>
          <View style={styles.card}>
            <View style={styles.grid}>
              <Text style={styles.gridLabel}>Base imposable (revenus fonciers + BIC)</Text>
              <Text style={styles.gridValue}>{formatEuro(simulation.ps.base)}</Text>
            </View>
            <View style={styles.grid}>
              <Text style={styles.gridLabel}>Taux PS</Text>
              <Text style={styles.gridValue}>{formatPercent(simulation.ps.taux)}</Text>
            </View>
            <View style={[styles.grid, { marginTop: 8, paddingTop: 8, borderTop: '1 solid #cbd5e1' }]}>
              <Text style={[styles.gridLabel, { fontWeight: 'bold', fontSize: 11, color: '#f97316' }]}>
                Prélèvements sociaux (PS)
              </Text>
              <Text style={[styles.gridValue, { fontWeight: 'bold', fontSize: 12, color: '#f97316' }]}>
                {formatEuro(simulation.ps.montant)}
              </Text>
            </View>
          </View>
        </View>

        {/* PAGE BREAK - Fin section Détails fiscaux */}
        <Text break />

        {/* ========== SECTION 6 : PROJECTIONS ANNUELLES ========== */}
        {simulation.biens.some(b => b.breakdown) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PROJECTIONS ANNUELLES</Text>
            <Text style={{ fontSize: 9, color: '#64748b', marginBottom: 10 }}>
              Données réalisées et projetées pour l'année {simulation.inputs.year}
            </Text>
            
            {simulation.biens
              .filter(b => b.breakdown)
              .map((bien, i) => {
                const bd = bien.breakdown!;
                const totalPasse = bd.passe.recettes - bd.passe.chargesDeductibles - bd.passe.interetsEmprunt;
                const totalProjection = bd.projection.loyersFuturs - bd.projection.chargesFutures - bd.projection.interetsEmpruntFuturs;
                const totalAnnuel = bd.total.recettes - bd.total.chargesDeductibles - bd.total.interetsEmprunt;
                
                return (
                  <View key={i} style={[styles.card, { marginBottom: 12 }]}>
                    <Text style={styles.cardHeader}>{bien.nom}</Text>
                    
                    {/* Tableau 3 colonnes : Passé / Projection / Total */}
                    <View style={{ marginTop: 8 }}>
                      {/* Header */}
                      <View style={{ flexDirection: 'row', backgroundColor: '#e0e7ff', padding: 6, borderRadius: 3 }}>
                        <Text style={{ flex: 1, fontSize: 8, fontWeight: 'bold', color: '#3730a3' }}>Passé (réalisé)</Text>
                        <Text style={{ flex: 1, fontSize: 8, fontWeight: 'bold', color: '#7e22ce', textAlign: 'center' }}>Projection</Text>
                        <Text style={{ flex: 1, fontSize: 8, fontWeight: 'bold', color: '#1e40af', textAlign: 'right' }}>Total annuel</Text>
                      </View>
                      
                      {/* Recettes */}
                      <View style={{ flexDirection: 'row', padding: 6, borderBottom: '1 solid #e2e8f0' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 7, color: '#64748b' }}>Recettes</Text>
                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#16a34a' }}>
                            {formatEuro(bd.passe.recettes)}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 7, color: '#64748b', textAlign: 'center' }}>Loyers futurs</Text>
                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#7e22ce', textAlign: 'center' }}>
                            {formatEuro(bd.projection.loyersFuturs)}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 7, color: '#64748b', textAlign: 'right' }}>Total recettes</Text>
                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#1e40af', textAlign: 'right' }}>
                            {formatEuro(bd.total.recettes)}
                          </Text>
                        </View>
                      </View>
                      
                      {/* Charges */}
                      <View style={{ flexDirection: 'row', padding: 6, borderBottom: '1 solid #e2e8f0' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 7, color: '#64748b' }}>Charges</Text>
                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#dc2626' }}>
                            {formatEuro(bd.passe.chargesDeductibles)}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 7, color: '#64748b', textAlign: 'center' }}>Charges futures</Text>
                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#dc2626', textAlign: 'center' }}>
                            {formatEuro(bd.projection.chargesFutures)}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 7, color: '#64748b', textAlign: 'right' }}>Total charges</Text>
                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#dc2626', textAlign: 'right' }}>
                            {formatEuro(bd.total.chargesDeductibles)}
                          </Text>
                        </View>
                      </View>
                      
                      {/* Intérêts */}
                      <View style={{ flexDirection: 'row', padding: 6, borderBottom: '1 solid #e2e8f0' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 7, color: '#64748b' }}>Intérêts</Text>
                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#f97316' }}>
                            {formatEuro(bd.passe.interetsEmprunt)}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 7, color: '#64748b', textAlign: 'center' }}>Intérêts futurs</Text>
                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#f97316', textAlign: 'center' }}>
                            {formatEuro(bd.projection.interetsEmpruntFuturs)}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 7, color: '#64748b', textAlign: 'right' }}>Total intérêts</Text>
                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#f97316', textAlign: 'right' }}>
                            {formatEuro(bd.total.interetsEmprunt)}
                          </Text>
                        </View>
                      </View>
                      
                      {/* Résultat net */}
                      <View style={{ flexDirection: 'row', padding: 6, backgroundColor: '#f8fafc' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#475569' }}>Résultat</Text>
                          <Text style={{ fontSize: 10, fontWeight: 'bold', color: totalPasse >= 0 ? '#16a34a' : '#dc2626' }}>
                            {formatEuro(totalPasse)}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#475569', textAlign: 'center' }}>Résultat</Text>
                          <Text style={{ fontSize: 10, fontWeight: 'bold', color: totalProjection >= 0 ? '#16a34a' : '#dc2626', textAlign: 'center' }}>
                            {formatEuro(totalProjection)}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#475569', textAlign: 'right' }}>TOTAL</Text>
                          <Text style={{ fontSize: 10, fontWeight: 'bold', color: totalAnnuel >= 0 ? '#16a34a' : '#dc2626', textAlign: 'right' }}>
                            {formatEuro(totalAnnuel)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    
                    {/* Note méthodologie */}
                    <View style={{ marginTop: 8, padding: 6, backgroundColor: '#eff6ff', borderRadius: 3 }}>
                      <Text style={{ fontSize: 7, color: '#1e40af' }}>
                        💡 Passé = transactions réelles | Projection = basée sur baux actifs et échéances planifiées
                      </Text>
                    </View>
                  </View>
                );
              })}
          </View>
        )}

        {/* PAGE BREAK */}
        <Text break />

        {/* SECTION 7 : RÉSUMÉ FINAL */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RESUME FINAL</Text>
          
          {/* Total impôts */}
          <View style={styles.highlightRed}>
            <View style={styles.grid}>
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#dc2626' }}>
                Total impôts (IR + PS)
              </Text>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#dc2626' }}>
                {formatEuro(simulation.resume.totalImpots)}
              </Text>
            </View>
          </View>
          
          {/* Résultat net après fiscalité */}
          <View style={styles.highlightGreen}>
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#166534', marginBottom: 5 }}>
              Résultat net après fiscalité
            </Text>
            <View style={styles.grid}>
              <Text style={{ fontSize: 9, color: '#15803d' }}>Loyers encaissés</Text>
              <Text style={{ fontSize: 9, color: '#15803d' }}>
                {formatEuro(simulation.biens.reduce((sum, b) => sum + b.recettesBrutes, 0))}
              </Text>
            </View>
            <View style={styles.grid}>
              <Text style={{ fontSize: 9, color: '#15803d' }}>- Charges déductibles</Text>
              <Text style={{ fontSize: 9, color: '#15803d' }}>
                -{formatEuro(simulation.biens.reduce((sum, b) => sum + b.chargesDeductibles, 0))}
              </Text>
            </View>
            <View style={styles.grid}>
              <Text style={{ fontSize: 9, color: '#15803d' }}>- Impôts supplémentaires (IR + PS)</Text>
              <Text style={{ fontSize: 9, color: '#15803d' }}>
                -{formatEuro(simulation.resume.impotsSuppTotal)}
              </Text>
            </View>
            <View style={[styles.grid, { marginTop: 5, paddingTop: 5, borderTop: '1 solid #86efac' }]}>
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#166534' }}>
                = Résultat net final
              </Text>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: simulation.resume.beneficeNetImmobilier >= 0 ? '#166534' : '#dc2626' }}>
                {formatEuro(simulation.resume.beneficeNetImmobilier)}
              </Text>
            </View>
          </View>
          
          {/* Indicateurs clés */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <View style={[styles.card, { flex: 1 }]}>
              <Text style={{ fontSize: 8, color: '#64748b', marginBottom: 2 }}>Taux effectif</Text>
              <Text style={{ fontSize: 10, fontWeight: 'bold' }}>{formatPercent(simulation.resume.tauxEffectif)}</Text>
            </View>
            <View style={[styles.card, { flex: 1 }]}>
              <Text style={{ fontSize: 8, color: '#64748b', marginBottom: 2 }}>Rendement net</Text>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#7c3aed' }}>{formatPercent(simulation.resume.rendementNet)}</Text>
            </View>
          </View>
          
          {/* Imputation/Report */}
          {simulation.consolidation.deficitFoncier > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#475569', marginBottom: 8 }}>
                SUIVI DU DEFICIT FONCIER
              </Text>
              
              {/* Barre imputation */}
              <View style={{ backgroundColor: '#eff6ff', border: '1 solid #bfdbfe', borderRadius: 5, padding: 10, marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 8, color: '#1e40af', fontWeight: 'bold' }}>
                    Imputation opérée {simulation.inputs.year}
                  </Text>
                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#3b82f6' }}>
                    {formatEuro(simulation.consolidation.deficitImputableRevenuGlobal || 0)} / {formatEuro(simulation.taxParams.deficitFoncier.plafondImputationRevenuGlobal)}
                  </Text>
                </View>
                <View style={{ backgroundColor: '#cbd5e1', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                  <View style={{ 
                    backgroundColor: '#3b82f6', 
                    height: 8, 
                    width: `${Math.min(100, ((simulation.consolidation.deficitImputableRevenuGlobal || 0) / simulation.taxParams.deficitFoncier.plafondImputationRevenuGlobal) * 100)}%` 
                  }} />
                </View>
                <Text style={{ fontSize: 7, color: '#64748b', marginTop: 2 }}>
                  {(((simulation.consolidation.deficitImputableRevenuGlobal || 0) / simulation.taxParams.deficitFoncier.plafondImputationRevenuGlobal) * 100).toFixed(0)}% du plafond utilisé
                </Text>
              </View>
              
              {/* Intérêts reportés */}
              {simulation.consolidation.deficitReportable > 0 && (
                <View style={{ backgroundColor: '#fff7ed', border: '1 solid #fed7aa', borderRadius: 5, padding: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                    <Text style={{ fontSize: 8, color: '#c2410c', fontWeight: 'bold' }}>
                      Intérêts reportés N+1
                    </Text>
                    <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#f97316' }}>
                      {formatEuro(simulation.consolidation.deficitReportable)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 7, color: '#ea580c' }}>
                    Reportable sur revenus fonciers futurs (reste 9 ans, max {simulation.inputs.year + 10})
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* SECTION 8 : SUGGESTIONS D'OPTIMISATION */}
        {suggestions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SUGGESTIONS D'OPTIMISATION FISCALE</Text>
            <Text style={{ fontSize: 9, color: '#64748b', marginBottom: 10 }}>
              Recommandations personnalisées pour réduire votre fiscalité
            </Text>
            
            {suggestions.map((suggestion, i) => {
              const isRegimeChange = suggestion.type === 'REGIME_CHANGE';
              const isPER = suggestion.type === 'PER';
              const isWorks = suggestion.type === 'WORKS';
              
              // Couleur selon le type
              const bgColor = isPER ? '#dbeafe' : isWorks ? '#d1fae5' : '#fef3c7';
              const borderColor = isPER ? '#60a5fa' : isWorks ? '#34d399' : '#fcd34d';
              const textColor = isPER ? '#1e3a8a' : isWorks ? '#065f46' : '#92400e';
              
              // Badge complexité
              const badgeColor = suggestion.complexite === 'facile' 
                ? { bg: '#dcfce7', text: '#166534' }
                : suggestion.complexite === 'moyenne'
                ? { bg: '#fed7aa', text: '#c2410c' }
                : { bg: '#fecaca', text: '#991b1b' };
              
              return (
                <View key={i} style={{ backgroundColor: bgColor, border: `1 solid ${borderColor}`, borderRadius: 5, padding: 10, marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: textColor }}>
                          {isPER && '🏦 '}
                          {isWorks && '🔧 '}
                          {isRegimeChange && '📋 '}
                          {suggestion.titre}
                        </Text>
                        <View style={{ backgroundColor: badgeColor.bg, padding: '2 6', borderRadius: 3 }}>
                          <Text style={{ fontSize: 7, fontWeight: 'bold', color: badgeColor.text }}>
                            {suggestion.complexite}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 8, color: textColor, lineHeight: 1.4 }}>
                        {suggestion.description}
                      </Text>
                      {suggestion.notes && (
                        <Text style={{ fontSize: 7, color: '#64748b', marginTop: 3, fontStyle: 'italic' }}>
                          💡 {suggestion.notes}
                        </Text>
                      )}
                    </View>
                    
                    <View style={{ marginLeft: 10, alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 7, color: '#64748b', marginBottom: 2 }}>Économie estimée</Text>
                      <View style={{ backgroundColor: '#16a34a', padding: '4 8', borderRadius: 3 }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: 'white' }}>
                          {formatEuro(Math.round(suggestion.economieEstimee))}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
            
            {/* Résumé des économies totales */}
            <View style={{ marginTop: 10, padding: 10, backgroundColor: '#f0fdf4', border: '2 solid #86efac', borderRadius: 5 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#166534' }}>
                  💰 Total des économies potentielles
                </Text>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#166534' }}>
                  {formatEuro(suggestions.reduce((sum, s) => sum + (s.economieEstimee || 0), 0))}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text>
            Document généré par SmartImmo - Simulation fiscale immobilière
          </Text>
          <Text style={{ marginTop: 3 }}>
            Barèmes fiscaux : {simulation.taxParams.version} ({simulation.taxParams.source})
          </Text>
          <Text style={{ marginTop: 3, fontSize: 7, fontStyle: 'italic' }}>
            Ce document est fourni à titre indicatif. Pour toute décision fiscale, consultez un expert-comptable.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

