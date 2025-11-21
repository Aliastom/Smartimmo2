/**
 * COMPÉTENCE D - Simulation & Analyse Financière
 * Assistant patrimonial intelligent pour rentabilité, cashflow, fiscalité et projections
 */

/**
 * Types d'analyses financières
 */
export type FinancialAnalysisType = 
  | 'cashflow'      // Flux de trésorerie
  | 'rendement'     // Rendement brut/net
  | 'fiscalite'     // Optimisation fiscale
  | 'projection'    // Projections futures
  | 'irl'           // Indexation loyer
  | 'tri'           // Taux de rendement interne
  | 'amortissement' // Calcul amortissement LMNP
  | 'optimisation'; // Conseils d'optimisation

/**
 * Données d'un bien pour analyse
 */
export interface PropertyFinancialData {
  id: string;
  name: string;
  acquisitionPrice: number;
  currentValue: number;
  notaryFees: number;
  rentAmount: number; // Loyer mensuel HC
  charges: number; // Charges mensuelles
  deposit: number; // Caution
  acquisitionDate: Date;
  
  // Prêt associé
  loan?: {
    initialCapital: number;
    rate: number;
    monthlyPayment: number;
    startDate: Date;
    endDate: Date;
    remainingCapital: number;
  };
  
  // Fiscalité
  taxRegime?: 'LMNP' | 'FONCIER' | 'MICRO';
  propertyTax?: number; // Taxe foncière annuelle
}

/**
 * Résultat d'analyse financière
 */
export interface FinancialAnalysisResult {
  type: FinancialAnalysisType;
  propertyId?: string;
  propertyName?: string;
  period: {
    start: string;
    end: string;
  };
  
  // Résultats calculés
  cashflow?: {
    monthly: number;
    annual: number;
    breakdown: {
      rentIncome: number;
      expenses: number;
      loanPayment: number;
      taxes: number;
    };
  };
  
  rendement?: {
    brut: number; // %
    net: number; // %
    netNetFiscal: number; // % après impôts
  };
  
  fiscalite?: {
    regime: string;
    revenuImposable: number;
    impotIR: number;
    prelevementsSociaux: number;
    totalImpots: number;
    tauxEffectif: number; // %
  };
  
  projection?: {
    scenario: string;
    impact: number;
    details: string;
  };
  
  // Confiance et méthode
  confidence: number;
  method: string;
  warnings: string[];
}

/**
 * CASHFLOW - Calcul du flux de trésorerie
 */
export function calculateCashflow(
  data: PropertyFinancialData,
  period: 'monthly' | 'annual' = 'monthly'
): FinancialAnalysisResult['cashflow'] {
  const multiplier = period === 'annual' ? 12 : 1;
  
  const rentIncome = data.rentAmount * multiplier;
  const loanPayment = data.loan ? data.loan.monthlyPayment * multiplier : 0;
  const propertyTaxMonthly = data.propertyTax ? data.propertyTax / 12 : 0;
  const expenses = (data.charges + propertyTaxMonthly) * multiplier;
  
  // Estimation impôts mensuels (simplifié : 20% du revenu net)
  const netIncome = rentIncome - expenses - loanPayment;
  const estimatedTaxes = netIncome > 0 ? netIncome * 0.20 : 0;
  
  const cashflowNet = netIncome - estimatedTaxes;
  
  return {
    monthly: period === 'monthly' ? cashflowNet : cashflowNet / 12,
    annual: period === 'annual' ? cashflowNet : cashflowNet * 12,
    breakdown: {
      rentIncome,
      expenses,
      loanPayment,
      taxes: estimatedTaxes,
    },
  };
}

/**
 * RENDEMENT - Calcul brut et net
 */
export function calculateRendement(
  data: PropertyFinancialData
): FinancialAnalysisResult['rendement'] {
  const annualRent = data.rentAmount * 12;
  const totalCost = data.acquisitionPrice + data.notaryFees;
  
  // Rendement brut
  const rendementBrut = (annualRent / totalCost) * 100;
  
  // Rendement net (avant impôts)
  const annualCharges = data.charges * 12;
  const annualPropertyTax = data.propertyTax || 0;
  const annualExpenses = annualCharges + annualPropertyTax + 500; // +500€ assurance estimée
  
  const netRent = annualRent - annualExpenses;
  const rendementNet = (netRent / totalCost) * 100;
  
  // Rendement net-net (après impôts estimés à 30%)
  const netNetRent = netRent * 0.70;
  const rendementNetNet = (netNetRent / totalCost) * 100;
  
  return {
    brut: rendementBrut,
    net: rendementNet,
    netNetFiscal: rendementNetNet,
  };
}

/**
 * FISCALITÉ - Calcul simplifié LMNP vs Foncier
 */
export function calculateFiscalite(
  data: PropertyFinancialData,
  regime: 'LMNP' | 'FONCIER',
  marginalRate: number = 0.30 // Taux marginal IR (30% par défaut)
): FinancialAnalysisResult['fiscalite'] {
  const annualRent = data.rentAmount * 12;
  const annualExpenses = data.charges * 12;
  const annualPropertyTax = data.propertyTax || 0;
  const annualInterests = data.loan 
    ? data.loan.monthlyPayment * 12 - (data.loan.remainingCapital * 0.02) // Approximation
    : 0;
  
  let revenuImposable = 0;
  let impotIR = 0;
  
  if (regime === 'LMNP') {
    // LMNP réel : amortissement déduit
    const amortissableBase = data.acquisitionPrice * 0.85; // Hors terrain (15%)
    const amortissementAnnuel = amortissableBase / 25; // 25 ans
    
    revenuImposable = Math.max(0, 
      annualRent - annualExpenses - annualPropertyTax - annualInterests - amortissementAnnuel
    );
  } else {
    // Foncier : pas d'amortissement
    revenuImposable = annualRent - annualExpenses - annualPropertyTax - annualInterests;
  }
  
  impotIR = revenuImposable * marginalRate;
  const prelevementsSociaux = revenuImposable * 0.172; // 17,2%
  const totalImpots = impotIR + prelevementsSociaux;
  const tauxEffectif = annualRent > 0 ? (totalImpots / annualRent) * 100 : 0;
  
  return {
    regime,
    revenuImposable,
    impotIR,
    prelevementsSociaux,
    totalImpots,
    tauxEffectif,
  };
}

/**
 * INDEXATION IRL - Calcul nouveau loyer
 */
export function calculateIndexation(
  currentRent: number,
  indexRate: number // En %
): {
  newRent: number;
  increase: number;
  increasePercent: number;
} {
  const newRent = currentRent * (1 + indexRate / 100);
  const increase = newRent - currentRent;
  
  return {
    newRent: Math.round(newRent * 100) / 100,
    increase: Math.round(increase * 100) / 100,
    increasePercent: indexRate,
  };
}

/**
 * TRI - Taux de Rendement Interne (simplifié)
 * Note: Implémentation complète nécessiterait une lib financière
 */
export function calculateTRI(
  initialInvestment: number,
  annualCashflows: number[],
  finalValue: number
): number {
  // Approximation simple du TRI
  // En production, utiliser une lib comme 'financial' ou 'irr'
  
  const totalCashflow = annualCashflows.reduce((sum, cf) => sum + cf, 0) + finalValue;
  const years = annualCashflows.length;
  
  // Formule approximative : TRI ≈ (total cashflow / initial investment)^(1/years) - 1
  if (initialInvestment <= 0 || years === 0) return 0;
  
  const ratio = totalCashflow / initialInvestment;
  const tri = (Math.pow(ratio, 1 / years) - 1) * 100;
  
  return Math.round(tri * 100) / 100;
}

/**
 * Analyse complète d'un bien
 */
export async function analyzeProperty(
  data: PropertyFinancialData,
  analysisType: FinancialAnalysisType
): Promise<FinancialAnalysisResult> {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const endOfYear = new Date(now.getFullYear(), 11, 31);
  
  const result: FinancialAnalysisResult = {
    type: analysisType,
    propertyId: data.id,
    propertyName: data.name,
    period: {
      start: startOfYear.toISOString().split('T')[0],
      end: endOfYear.toISOString().split('T')[0],
    },
    confidence: 0.85,
    method: '',
    warnings: [],
  };
  
  switch (analysisType) {
    case 'cashflow':
      result.cashflow = calculateCashflow(data, 'monthly');
      result.method = 'loyers encaissés - charges - prêt - impôts estimés';
      result.confidence = 0.90;
      break;
      
    case 'rendement':
      result.rendement = calculateRendement(data);
      result.method = '(revenu annuel net / coût total) × 100';
      result.confidence = 0.95;
      break;
      
    case 'fiscalite':
      const regimeLMNP = calculateFiscalite(data, 'LMNP');
      const regimeFoncier = calculateFiscalite(data, 'FONCIER');
      
      result.fiscalite = regimeLMNP.totalImpots < regimeFoncier.totalImpots
        ? regimeLMNP
        : regimeFoncier;
      
      result.method = 'Comparaison LMNP vs Foncier, régime optimal retenu';
      result.warnings.push('Estimation simplifiée, consulter expert-comptable');
      result.confidence = 0.75;
      break;
      
    case 'irl':
      // Sera calculé avec un taux spécifique fourni
      result.method = 'loyer × (1 + taux IRL / 100)';
      result.confidence = 1.0;
      break;
      
    default:
      result.method = 'Analyse en cours de développement';
      result.confidence = 0.50;
      result.warnings.push('Type d\'analyse non encore implémenté');
  }
  
  return result;
}

/**
 * Formatte un résultat financier en texte
 */
export function formatFinancialResult(result: FinancialAnalysisResult): string {
  let answer = '';
  
  const propertyLabel = result.propertyName 
    ? `**[${result.propertyName}]** ` 
    : '';
  
  switch (result.type) {
    case 'cashflow':
      if (result.cashflow) {
        const cf = result.cashflow;
        const sign = cf.monthly >= 0 ? '+' : '';
        answer = `${propertyLabel}Cashflow net mensuel : **${sign}${cf.monthly.toFixed(0)} €**.

Détail :
• Loyers encaissés : **${cf.breakdown.rentIncome.toFixed(0)} €**
• Charges : **−${cf.breakdown.expenses.toFixed(0)} €**
• Prêt : **−${cf.breakdown.loanPayment.toFixed(0)} €**
• Impôts estimés : **−${cf.breakdown.taxes.toFixed(0)} €**

📐 Méthode : ${result.method}`;
      }
      break;
      
    case 'rendement':
      if (result.rendement) {
        answer = `${propertyLabel}Rendement :

• Brut : **${result.rendement.brut.toFixed(2)} %**
• Net (avant impôts) : **${result.rendement.net.toFixed(2)} %**
• Net-net (après impôts) : **${result.rendement.netNetFiscal.toFixed(2)} %**

📐 Méthode : ${result.method}`;
      }
      break;
      
    case 'fiscalite':
      if (result.fiscalite) {
        answer = `${propertyLabel}Régime **${result.fiscalite.regime}** :

• Revenu imposable : **${result.fiscalite.revenuImposable.toFixed(0)} €**
• Impôt IR : **${result.fiscalite.impotIR.toFixed(0)} €**
• Prélèvements sociaux (17,2%) : **${result.fiscalite.prelevementsSociaux.toFixed(0)} €**
• Total impôts : **${result.fiscalite.totalImpots.toFixed(0)} €**
• Taux effectif : **${result.fiscalite.tauxEffectif.toFixed(1)} %**

📐 Méthode : ${result.method}`;
      }
      break;
  }
  
  // Ajouter warnings si présents
  if (result.warnings.length > 0) {
    answer += `\n\n⚠️ Avertissements :\n${result.warnings.map(w => `• ${w}`).join('\n')}`;
  }
  
  // Ajouter confiance si < 0.90
  if (result.confidence < 0.90) {
    answer += `\n\n📊 Confiance : ${(result.confidence * 100).toFixed(0)}% (estimation)`;
  }
  
  return answer;
}

/**
 * Détecte le type d'analyse depuis la question
 */
export function detectFinancialAnalysisType(question: string): FinancialAnalysisType | null {
  const q = question.toLowerCase();
  
  if (q.match(/cashflow|cash.?flow|trésorerie|flux/)) return 'cashflow';
  if (q.match(/rendement|rentabilité|roi/)) return 'rendement';
  if (q.match(/fiscal|impôt|lmnp|foncier|amortissement/)) return 'fiscalite';
  if (q.match(/index|irl|ilat|icc/)) return 'irl';
  if (q.match(/tri|taux de rendement interne/)) return 'tri';
  if (q.match(/projection|prévoir|simuler|si.*alors/)) return 'projection';
  if (q.match(/optimis|réduire.*impôt|conseil.*fiscal/)) return 'optimisation';
  
  return null;
}






















