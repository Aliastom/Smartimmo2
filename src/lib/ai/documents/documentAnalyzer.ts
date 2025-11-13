/**
 * COMPÉTENCE E - Analyse Documentaire Avancée (OCR + DOCX)
 * Lecture, extraction, classification et association automatique de documents
 */

/**
 * Types de documents reconnus
 */
export type DocumentType = 
  | 'bail'              // Contrat de location
  | 'quittance'         // Quittance de loyer
  | 'facture'           // Facture (travaux, entretien, etc.)
  | 'taxe'              // Taxe foncière, ordures ménagères
  | 'releve_bancaire'   // Relevé de compte
  | 'assurance'         // Attestation, quittance assurance
  | 'autre';            // Divers

/**
 * Résultat d'extraction de document
 */
export interface DocumentExtraction {
  type: DocumentType;
  confidence: number; // 0.0 à 1.0
  
  // Champs extraits
  montant?: number;
  date?: Date;
  period?: string; // AAAA-MM
  annee?: number;
  
  // Entités associées
  bienId?: string;
  bailId?: string;
  locataire?: string;
  fournisseur?: string;
  
  // Métadonnées
  nature?: string; // entretien, taxe foncière, etc.
  reference?: string;
  keywords: string[];
  
  // Vérifications
  anomalies: string[];
  isDuplicate: boolean;
  needsManualReview: boolean;
}

/**
 * Plan d'actions pour un document
 */
export interface DocumentActionPlan {
  actions: Array<{
    op: 'classify' | 'link' | 'validate' | 'flag' | 'analyze';
    entity: string;
    set?: Record<string, any>;
    where?: Record<string, any>;
  }>;
}

/**
 * ÉTAPE 1 - Extraction de texte brut
 */
export function cleanText(rawText: string): string {
  return rawText
    .replace(/\n+/g, ' ') // Convertir retours à la ligne en espaces
    .replace(/\s+/g, ' ') // Normaliser espaces multiples
    .trim();
}

/**
 * ÉTAPE 2 - Extraction des valeurs clés
 */
export function extractKeyValues(text: string): {
  montants: number[];
  dates: Date[];
  keywords: string[];
} {
  const montants: number[] = [];
  const dates: Date[] = [];
  const keywords: string[] = [];
  
  // Extraction des montants (avec gestion des espaces séparateurs)
  // Formats supportés : 1 248,00 € ou 1248,00 € ou 1.248,00 €
  const montantRegex = /(\d{1,3}(?:[\s.]\d{3})*[.,]\d{2})\s*€/g;
  let match;
  while ((match = montantRegex.exec(text)) !== null) {
    let montantStr = match[1];
    
    // Déterminer le séparateur décimal (virgule ou point)
    const hasComma = montantStr.includes(',');
    const hasPoint = montantStr.includes('.');
    
    if (hasComma && hasPoint) {
      // Format mixte : 1.248,00 (point = milliers, virgule = décimal)
      montantStr = montantStr.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
      // Format FR : 1 248,00 (virgule = décimal)
      montantStr = montantStr.replace(/\s/g, '').replace(',', '.');
    } else if (hasPoint && montantStr.split('.').length > 2) {
      // Format : 1.248.00 (points = milliers)
      montantStr = montantStr.replace(/\./g, '');
    } else {
      // Supprimer espaces seulement
      montantStr = montantStr.replace(/\s/g, '');
    }
    
    const montant = parseFloat(montantStr);
    if (montant > 0 && !isNaN(montant)) {
      montants.push(montant);
    }
  }
  
  // Extraction des dates
  const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g;
  while ((match = dateRegex.exec(text)) !== null) {
    try {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]) - 1;
      let year = parseInt(match[3]);
      if (year < 100) year += 2000;
      
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        dates.push(date);
      }
    } catch (e) {
      // Ignorer dates invalides
    }
  }
  
  // Extraction des mots-clés
  const keywordPatterns = [
    'quittance', 'reçu', 'recue', 'facture', 'bail', 'contrat',
    'taxe', 'fonciere', 'foncière', 'ordures', 'assurance', 'releve', 'relevé',
    'loyer', 'charges', 'entretien', 'travaux', 'réparation', 'reparation',
    'banque', 'compte', 'location',
  ];
  
  const textLower = text.toLowerCase();
  for (const keyword of keywordPatterns) {
    const normalizedKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normalizedText = textLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    if (normalizedText.includes(normalizedKeyword) || textLower.includes(keyword)) {
      // Ajouter le mot-clé original (sans accent) pour uniformité
      const baseKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!keywords.includes(baseKeyword)) {
        keywords.push(baseKeyword);
      }
    }
  }
  
  return { montants, dates, keywords };
}

/**
 * ÉTAPE 3 - Détection du type de document
 */
export function detectDocumentType(
  text: string,
  keywords: string[]
): { type: DocumentType; confidence: number } {
  const textLower = text.toLowerCase();
  const textNormalized = textLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Règles de classification par priorité
  
  // Quittance de loyer
  if (keywords.includes('quittance') || keywords.includes('recu') || keywords.includes('recue')) {
    if (keywords.includes('loyer')) {
      return { type: 'quittance', confidence: 0.95 };
    }
    return { type: 'quittance', confidence: 0.80 };
  }
  
  // Taxe foncière (AVANT bail/contrat car mots peuvent coexister)
  if (keywords.includes('taxe') || textNormalized.includes('taxe')) {
    if (keywords.includes('fonciere') || textNormalized.includes('fonciere')) {
      return { type: 'taxe', confidence: 0.95 };
    }
    if (textNormalized.includes('ordures')) {
      return { type: 'taxe', confidence: 0.85 };
    }
  }
  
  // Bail / Contrat
  if (keywords.includes('bail') || keywords.includes('contrat')) {
    if (keywords.includes('location') || textLower.includes('locataire')) {
      return { type: 'bail', confidence: 0.95 };
    }
    return { type: 'bail', confidence: 0.75 };
  }
  
  // Facture
  if (keywords.includes('facture')) {
    if (keywords.includes('travaux') || keywords.includes('entretien') || keywords.includes('reparation')) {
      return { type: 'facture', confidence: 0.90 };
    }
    return { type: 'facture', confidence: 0.85 };
  }
  
  // Assurance
  if (keywords.includes('assurance')) {
    return { type: 'assurance', confidence: 0.90 };
  }
  
  // Relevé bancaire
  if (keywords.includes('releve') || textNormalized.includes('releve')) {
    if (keywords.includes('banque') || keywords.includes('compte') || textNormalized.includes('banque')) {
      return { type: 'releve_bancaire', confidence: 0.85 };
    }
  }
  
  // Autre par défaut
  return { type: 'autre', confidence: 0.50 };
}

/**
 * ÉTAPE 4 - Association automatique
 */
export function associateDocument(
  extraction: Partial<DocumentExtraction>,
  availableProperties: Array<{ id: string; address: string; rentAmount: number }>,
  availableLeases: Array<{ id: string; propertyId: string; rentAmount: number; tenantName: string }>
): { bienId?: string; bailId?: string; confidence: number } {
  let bienId: string | undefined;
  let bailId: string | undefined;
  let confidence = 0.5;
  
  // Association par montant (loyer)
  if (extraction.montant && extraction.type === 'quittance') {
    const matchingLease = availableLeases.find(
      l => Math.abs(l.rentAmount - extraction.montant!) < 5
    );
    
    if (matchingLease) {
      bailId = matchingLease.id;
      bienId = matchingLease.propertyId;
      confidence = 0.90;
    }
  }
  
  // Association par adresse (dans le texte du document)
  // Note: nécessiterait le texte complet pour chercher l'adresse
  
  return { bienId, bailId, confidence };
}

/**
 * ÉTAPE 5 - Détection d'anomalies
 */
export function detectAnomalies(extraction: DocumentExtraction): string[] {
  const anomalies: string[] = [];
  
  // Montant incohérent
  if (extraction.montant !== undefined) {
    if (extraction.montant > 100000) {
      anomalies.push('Montant très élevé (> 100 000 €)');
    }
    if (extraction.montant === 0) {
      anomalies.push('Montant nul');
    }
  }
  
  // Date invalide ou future
  if (extraction.date) {
    const now = new Date();
    if (extraction.date > now) {
      anomalies.push('Date dans le futur');
    }
    if (extraction.date.getFullYear() < 2000) {
      anomalies.push('Date trop ancienne');
    }
  }
  
  // Type avec faible confiance
  if (extraction.confidence < 0.70) {
    anomalies.push('Classification incertaine (confiance < 70%)');
  }
  
  // Champs manquants critiques
  if (extraction.type === 'quittance' && !extraction.period) {
    anomalies.push('Période manquante pour quittance');
  }
  
  if (extraction.type === 'facture' && !extraction.montant) {
    anomalies.push('Montant manquant pour facture');
  }
  
  return anomalies;
}

/**
 * Extraction de période depuis les noms de mois
 */
function extractPeriodFromText(text: string): { period?: string; annee?: number; date?: Date } {
  const textLower = text.toLowerCase();
  
  // Mapping des mois français
  const monthsMap: Record<string, number> = {
    janvier: 0, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
    juillet: 6, aout: 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11,
  };
  
  // Chercher année (4 chiffres)
  const yearMatch = text.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
  
  // Chercher nom de mois
  for (const [monthName, monthIndex] of Object.entries(monthsMap)) {
    if (textLower.includes(monthName)) {
      const period = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      const date = new Date(year, monthIndex, 1);
      return { period, annee: year, date };
    }
  }
  
  return { annee: year };
}

/**
 * ANALYSE COMPLÈTE D'UN DOCUMENT
 */
export async function analyzeDocument(
  rawText: string,
  metadata?: { fileName: string; uploadDate: Date }
): Promise<DocumentExtraction> {
  // ÉTAPE 1 : Nettoyage
  const cleanedText = cleanText(rawText);
  
  // ÉTAPE 2 : Extraction des valeurs
  const extracted = extractKeyValues(cleanedText);
  
  // ÉTAPE 3 : Détection du type
  const typeDetection = detectDocumentType(cleanedText, extracted.keywords);
  
  // ÉTAPE 4 : Construction du résultat
  const result: DocumentExtraction = {
    type: typeDetection.type,
    confidence: typeDetection.confidence,
    montant: extracted.montants[0], // Premier montant trouvé
    date: extracted.dates[0], // Première date trouvée
    keywords: extracted.keywords,
    anomalies: [],
    isDuplicate: false,
    needsManualReview: false,
  };
  
  // Extraction de la période (AAAA-MM)
  // Priorité 1 : depuis date extraite
  if (result.date) {
    const year = result.date.getFullYear();
    const month = String(result.date.getMonth() + 1).padStart(2, '0');
    result.period = `${year}-${month}`;
    result.annee = year;
  }
  // Priorité 2 : depuis nom de mois dans le texte
  else {
    const periodFromText = extractPeriodFromText(rawText);
    if (periodFromText.period) {
      result.period = periodFromText.period;
      result.annee = periodFromText.annee;
      result.date = periodFromText.date;
    } else if (periodFromText.annee) {
      result.annee = periodFromText.annee;
    }
  }
  
  // ÉTAPE 5 : Détection d'anomalies
  result.anomalies = detectAnomalies(result);
  
  // Flag pour revue manuelle
  result.needsManualReview = 
    result.confidence < 0.70 || 
    result.anomalies.length > 0 ||
    (!result.montant && result.type !== 'bail');
  
  return result;
}

/**
 * Génère un plan d'actions pour un document
 */
export function generateDocumentActionPlan(
  extraction: DocumentExtraction
): DocumentActionPlan {
  const actions: DocumentActionPlan['actions'] = [];
  
  // Classification
  const classifyAction: any = {
    op: 'classify',
    entity: 'documents',
    set: {
      type: extraction.type,
      status: extraction.needsManualReview ? 'pending' : 'classified',
    },
  };
  
  if (extraction.montant) classifyAction.set.montant = extraction.montant;
  if (extraction.period) classifyAction.set.period = extraction.period;
  if (extraction.bienId) classifyAction.set.bienId = extraction.bienId;
  if (extraction.bailId) classifyAction.set.bailId = extraction.bailId;
  if (extraction.nature) classifyAction.set.nature = extraction.nature;
  
  actions.push(classifyAction);
  
  // Liaison avec transaction si montant connu
  if (extraction.montant && extraction.date && extraction.type !== 'bail') {
    actions.push({
      op: 'link',
      entity: 'transactions',
      where: {
        montant: extraction.montant,
        date: extraction.date.toISOString().split('T')[0],
        tolerance: 5, // ±5€
      },
    });
  }
  
  // Flag si anomalies
  if (extraction.anomalies.length > 0) {
    actions.push({
      op: 'flag',
      entity: 'documents',
      set: {
        anomalies: extraction.anomalies,
        needsReview: true,
      },
    });
  }
  
  return { actions };
}

/**
 * Formate le résultat d'analyse en texte
 */
export function formatDocumentAnalysis(
  extraction: DocumentExtraction,
  actionPlan: DocumentActionPlan
): string {
  let answer = `Document classé comme **${extraction.type}**`;
  
  // Montant
  if (extraction.montant) {
    answer += ` (${extraction.montant.toFixed(2)} €)`;
  }
  
  // Entité associée
  if (extraction.bienId) {
    answer += ` – Bien ${extraction.bienId}`;
  } else if (extraction.bailId) {
    answer += ` – Bail ${extraction.bailId}`;
  }
  
  // Période
  if (extraction.period) {
    answer += ` – ${extraction.period}`;
  }
  
  answer += '.';
  
  // Méthode
  answer += `\n\n📐 Méthode : OCR + mots-clés (${extraction.keywords.slice(0, 3).join(', ')}).`;
  answer += `\n📊 Confiance : ${(extraction.confidence * 100).toFixed(0)}%`;
  
  // Anomalies
  if (extraction.anomalies.length > 0) {
    answer += `\n\n⚠️ Anomalies détectées :\n${extraction.anomalies.map(a => `• ${a}`).join('\n')}`;
  }
  
  // Revue manuelle
  if (extraction.needsManualReview) {
    answer += `\n\n🔍 Revue manuelle recommandée.`;
  }
  
  // Plan d'actions JSON
  answer += `\n\n${JSON.stringify(actionPlan)}`;
  
  return answer;
}

