/**
 * Générateur de PDF style CERFA simplifié
 * Ressemble au formulaire officiel 2042/2044
 */

import jsPDF from 'jspdf';
import type { SimulationResult } from '@/types/fiscal';

export function generateCerfaPDF(simulation: SimulationResult) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  let y = 20;

  const formatEuro = (amount: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  
  // Helper pour texte avec gestion de longueur
  const addText = (text: string, x: number, yPos: number, options?: any) => {
    const maxWidth = options?.maxWidth || contentWidth;
    if (doc.getTextWidth(text) > maxWidth) {
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, x, yPos, options);
      return lines.length * 5; // hauteur approximative
    }
    doc.text(text, x, yPos, options);
    return 0;
  };

  // ============================================================================
  // EN-TÊTE STYLE CERFA
  // ============================================================================
  
  // Cadre bleu officiel
  doc.setDrawColor(41, 128, 185);
  doc.setLineWidth(2);
  doc.rect(margin - 5, 10, contentWidth + 10, pageHeight - 20);
  
  doc.setDrawColor(41, 128, 185);
  doc.setLineWidth(0.5);
  doc.rect(margin - 3, 12, contentWidth + 6, pageHeight - 24);

  // Logo Republique Francaise (sans accents pour compatibilité)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 128, 185);
  doc.text('REPUBLIQUE FRANCAISE', margin, y);
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('DIRECTION GENERALE DES FINANCES PUBLIQUES', margin, y);
  y += 10;

  // Titre principal
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`DECLARATION DES REVENUS ${simulation.inputs.year}`, pageWidth / 2, y, { align: 'center' });
  y += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Guide de remplissage genere par SmartImmo', pageWidth / 2, y, { align: 'center' });
  y += 3;
  
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR');
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  doc.text(`Genere le ${dateStr} a ${timeStr}`, pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Ligne de separation
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ============================================================================
  // SECTION 1 : INFORMATIONS PERSONNELLES
  // ============================================================================
  
  doc.setFillColor(41, 128, 185);
  doc.rect(margin, y - 5, contentWidth, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('A. INFORMATIONS PERSONNELLES', margin + 2, y);
  y += 10;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  doc.text('Nombre de parts fiscales :', margin + 5, y);
  doc.setFont('helvetica', 'bold');
  doc.text(`${simulation.inputs.foyer?.parts || 1}`, margin + 65, y);
  y += 6;
  
  doc.setFont('helvetica', 'normal');
  doc.text('Situation familiale :', margin + 5, y);
  doc.setFont('helvetica', 'bold');
  doc.text(simulation.inputs.foyer?.isCouple ? 'En couple' : 'Celibataire', margin + 65, y);
  y += 10;

  // ============================================================================
  // SECTION 2 : FORMULAIRE 2042 - DECLARATION PRINCIPALE
  // ============================================================================
  
  doc.setFillColor(46, 204, 113);
  doc.rect(margin, y - 5, contentWidth, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('B. FORMULAIRE 2042 - DECLARATION DE REVENUS', margin + 2, y);
  y += 12;

  // Tableau des cases
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  
  const col1 = margin;
  const col2 = margin + 25;
  const col3 = margin + 105;
  const col4 = margin + 145;
  const colWidth1 = 25;
  const colWidth2 = 80;
  const colWidth3 = 40;
  const colWidth4 = contentWidth - 170;
  
  // En-tete tableau
  doc.setFillColor(240, 240, 240);
  doc.rect(col1, y - 4, colWidth1, 7, 'F');
  doc.rect(col2, y - 4, colWidth2, 7, 'F');
  doc.rect(col3, y - 4, colWidth3, 7, 'F');
  doc.rect(col4, y - 4, colWidth4, 7, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.text('CASE', col1 + 2, y);
  doc.text('LIBELLE', col2 + 2, y);
  doc.text('MONTANT', col3 + 2, y);
  doc.text('DECLARANT', col4 + 2, y);
  y += 7;

  // Lignes du tableau 2042
  const rows2042 = [
    { code: '1AJ', libelle: 'Salaires nets imposables', montant: simulation.inputs.foyer.salaire, declarant: 'Declarant 1' }
  ];
  
  if (simulation.consolidation.revenusFonciers !== 0) {
    rows2042.push({ 
      code: '4BA', 
      libelle: 'Revenus fonciers nets', 
      montant: simulation.consolidation.revenusFonciers, 
      declarant: 'Foyer' 
    });
  }
  
  if (simulation.per && simulation.per.deductionUtilisee > 0) {
    rows2042.push({ 
      code: '6NS', 
      libelle: 'Cotisations PER deductibles', 
      montant: simulation.per.deductionUtilisee, 
      declarant: 'Foyer' 
    });
  }

  rows2042.forEach(row => {
    doc.setDrawColor(220, 220, 220);
    doc.line(col1, y - 4, pageWidth - margin, y - 4);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(46, 204, 113);
    doc.text(row.code, col1 + 2, y);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(row.libelle, col2 + 2, y, { maxWidth: colWidth2 - 4 });
    
    doc.setFont('helvetica', 'bold');
    doc.text(formatEuro(Math.abs(row.montant)), col3 + colWidth3 - 2, y, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    doc.text(row.declarant, col4 + 2, y);
    y += 7;
  });

  y += 5;

  // ============================================================================
  // SECTION 3 : FORMULAIRE 2044 - REVENUS FONCIERS
  // ============================================================================
  
  doc.setFillColor(46, 204, 113);
  doc.rect(margin, y - 5, contentWidth, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('C. FORMULAIRE 2044 - REVENUS FONCIERS', margin + 2, y);
  y += 12;

  const totalLoyers = simulation.biens.reduce((sum, b) => sum + (b.recettesBrutes || 0), 0);
  const totalCharges = simulation.biens.reduce((sum, b) => sum + (b.chargesDeductibles || 0), 0);

  // En-tete tableau 2044
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  
  const col2044_1 = margin;
  const col2044_2 = margin + 25;
  const col2044_3 = margin + 125;
  
  doc.setFillColor(240, 240, 240);
  doc.rect(col2044_1, y - 4, 25, 7, 'F');
  doc.rect(col2044_2, y - 4, 100, 7, 'F');
  doc.rect(col2044_3, y - 4, contentWidth - 125, 7, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.text('CASE', col2044_1 + 2, y);
  doc.text('LIBELLE', col2044_2 + 2, y);
  doc.text('MONTANT', col2044_3 + 2, y);
  y += 7;

  // Lignes 2044
  const cases2044 = [
    { code: '211', libelle: 'Loyers encaisses', montant: totalLoyers },
    { code: '229', libelle: 'Charges deductibles totales', montant: totalCharges },
    { code: '420', libelle: 'Resultat foncier', montant: simulation.consolidation.revenusFonciers },
  ];

  cases2044.forEach(caseItem => {
    doc.setDrawColor(220, 220, 220);
    doc.line(col2044_1, y - 4, pageWidth - margin, y - 4);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(46, 204, 113);
    doc.text(caseItem.code, col2044_1 + 2, y);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(caseItem.libelle, col2044_2 + 2, y);
    
    doc.setFont('helvetica', 'bold');
    doc.text(formatEuro(Math.abs(caseItem.montant)), pageWidth - margin - 2, y, { align: 'right' });
    y += 7;
  });

  y += 10;

  // ============================================================================
  // SECTION 4 : RECAPITULATIF PAR BIEN
  // ============================================================================
  
  if (y > pageHeight - 60) {
    doc.addPage();
    y = 20;
  }

  doc.setFillColor(41, 128, 185);
  doc.rect(margin, y - 5, contentWidth, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`D. DETAIL PAR BIEN (${simulation.biens.length} propriete(s))`, margin + 2, y);
  y += 12;

  simulation.biens.forEach((bien, index) => {
    if (y > pageHeight - 35) {
      doc.addPage();
      y = 25;
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    const nomTruncated = bien.nom.length > 30 ? bien.nom.substring(0, 30) + '...' : bien.nom;
    doc.text(`${index + 1}. ${nomTruncated}`, margin + 5, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`(${bien.type} - Regime ${bien.regime === 'micro' ? 'Micro' : 'Reel'})`, margin + 65, y);
    y += 6;

    doc.setFontSize(8);
    doc.text(`Loyers : ${formatEuro(bien.recettesBrutes)}`, margin + 10, y);
    doc.text(`Charges : ${formatEuro(bien.chargesDeductibles)}`, margin + 65, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(bien.resultatFiscal >= 0 ? 46 : 200, bien.resultatFiscal >= 0 ? 204 : 0, bien.resultatFiscal >= 0 ? 113 : 0);
    doc.text(`Resultat : ${formatEuro(bien.resultatFiscal)}`, margin + 120, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    y += 8;
  });

  y += 5;

  // ============================================================================
  // SECTION 5 : RESUME FISCAL
  // ============================================================================
  
  if (y > pageHeight - 50) {
    doc.addPage();
    y = 25;
  }

  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y - 5, contentWidth, 8, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('E. RESUME FISCAL', margin + 2, y);
  y += 12;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  const resumeData = [
    { label: 'Revenu imposable total', value: simulation.ir.revenuImposable },
    { label: 'Impot sur le revenu (IR)', value: simulation.ir.impotNet },
    { label: 'Prelevements sociaux (PS)', value: simulation.ps.montant || 0 },
    { label: 'Total impots', value: simulation.ir.impotNet + (simulation.ps.montant || 0) },
  ];

  resumeData.forEach(item => {
    doc.text(item.label, margin + 5, y);
    doc.setFont('helvetica', 'bold');
    doc.text(formatEuro(item.value), pageWidth - margin - 5, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 6;
  });

  // ============================================================================
  // PIED DE PAGE
  // ============================================================================
  
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  const footer1 = 'Ce document est un guide de remplissage genere automatiquement par SmartImmo.';
  const footer2 = 'Il ne remplace pas les formulaires officiels CERFA disponibles sur impots.gouv.fr';
  doc.text(footer1, pageWidth / 2, pageHeight - 15, { align: 'center' });
  doc.text(footer2, pageWidth / 2, pageHeight - 10, { align: 'center' });
  
  // Numero de page
  doc.setFont('helvetica', 'bold');
  doc.text('1', pageWidth - margin - 5, pageHeight - 10);

  // ============================================================================
  // GÉNÉRATION
  // ============================================================================
  
  const filename = `Declaration_en_ligne_des_revenus_${simulation.inputs.year}_le_${now.toLocaleDateString('fr-FR').replace(/\//g, '_')}_a_${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(/:/g, '_')}_.pdf`;
  
  doc.save(filename);
}

