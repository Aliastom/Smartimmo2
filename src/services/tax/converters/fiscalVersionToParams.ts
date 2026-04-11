/**
 * Converter : FiscalVersion (BDD) → TaxParams (format simulation)
 * 
 * Convertit les données stockées en PostgreSQL au format attendu
 * par le simulateur fiscal et l'optimiseur
 */

import type { TaxParams } from '@/types/fiscal';
import { buildIrDecoteFromStored } from '@/services/tax/irDecoteDGFiP';

/** Repli uniquement si `jsonData.irBrackets` est absent (aligné version publiée 2026.1, revenus 2025 / décl. 2026). */
const FALLBACK_IR_BRACKETS_WHEN_JSON_MISSING: TaxParams['irBrackets'] = [
  { lower: 0, upper: 11600, rate: 0.0 },
  { lower: 11600, upper: 29579, rate: 0.11 },
  { lower: 29579, upper: 84577, rate: 0.3 },
  { lower: 84577, upper: 181917, rate: 0.41 },
  { lower: 181917, upper: null, rate: 0.45 },
];

interface FiscalVersionWithParams {
  id: string;
  code: string;
  year: number;
  status: string;
  validatedBy?: string | null;
  publishedAt?: Date | null;
  createdAt: Date;
  params: {
    jsonData: string;
  };
}

/**
 * Convertit une FiscalVersion (BDD) vers TaxParams (simulation)
 */
export function fiscalVersionToTaxParams(
  version: FiscalVersionWithParams
): TaxParams {
  const jsonData = JSON.parse(version.params.jsonData);
  
  return {
    version: version.code,
    year: version.year,
    
    // ========== BARÈME IR ==========
    irBrackets: jsonData.irBrackets?.length
      ? jsonData.irBrackets
      : FALLBACK_IR_BRACKETS_WHEN_JSON_MISSING,
    
    // ========== DÉCOTE IR (JSON admin — formule DGFiP côté moteur) ==========
    irDecote: buildIrDecoteFromStored(jsonData.irDecote ?? {}),
    
    // ========== ABATTEMENT FORFAITAIRE SALAIRES ==========
    salaryDeduction: jsonData.salaryDeduction || {
      taux: 0.1,
      min: 472,
      max: 13522,
    },

    pensionSocialesDeductiblesEstime: jsonData.pensionSocialesDeductiblesEstime,
    
    // ========== PRÉLÈVEMENTS SOCIAUX ==========
    psRate: jsonData.psRate || 0.172,
    
    // ========== RÉGIMES MICRO ==========
    micro: {
      // Micro-foncier
      foncierAbattement: jsonData.micro?.foncier?.abattement || 0.30,
      foncierPlafond: jsonData.micro?.foncier?.plafond || 15000,
      
      // Micro-BIC (meublé)
      bicAbattement: jsonData.micro?.bic?.abattement || 0.50,
      bicPlafond: jsonData.micro?.bic?.plafond || 77700,
      
      // Meublé de tourisme classé
      meubleTourismeAbattement: jsonData.micro?.meubleTourisme?.abattement || 0.71,
      meubleTourismePlafond: jsonData.micro?.meubleTourisme?.plafond || 188700,
    },
    
    // ========== DÉFICIT FONCIER ==========
    deficitFoncier: {
      plafondImputationRevenuGlobal: jsonData.deficitFoncier?.plafondImputationRevenuGlobal || 10700,
      dureeReport: jsonData.deficitFoncier?.dureeReport || 10,
    },
    
    // ========== PER ==========
    per: {
      tauxPlafond: jsonData.per?.tauxPlafond || 0.10,
      plancherLegal: jsonData.per?.plancherLegal || 4399,
      dureeReportReliquats: jsonData.per?.dureeReportReliquats || 3,
    },
    
    // ========== LMP ==========
    lmp: {
      recettesMin: jsonData.lmp?.recettesMin || 23000,
      tauxRecettesProMin: jsonData.lmp?.tauxRecettesProMin || 0.50,
      inscriptionRCSObligatoire: jsonData.lmp?.inscriptionRCSObligatoire ?? true,
    },
    
    // ========== SCI IS ==========
    sciIS: {
      tauxReduit: jsonData.sciIS?.tauxReduit || 0.15,
      plafondTauxReduit: jsonData.sciIS?.plafondTauxReduit || 42500,
      tauxNormal: jsonData.sciIS?.tauxNormal || 0.25,
    },
    
    // ========== MÉTADONNÉES ==========
    source: `Version ${version.code} (${version.status})`,
    dateMAJ: version.publishedAt || version.createdAt,
    validatedBy: version.validatedBy || 'system',
  };
}

/**
 * Convertit un objet NormalizedTaxParams (scraping) vers TaxParams (simulation)
 * Utilisé pour fallback ou preview
 */
export function normalizedToTaxParams(
  normalized: any,
  year: number,
  version: string
): TaxParams {
  return {
    version,
    year,
    
    irBrackets: normalized.irBrackets || [],
    
    irDecote: normalized.irDecote
      ? buildIrDecoteFromStored(normalized.irDecote)
      : undefined,
    
    psRate: normalized.psRate,
    micro: normalized.micro || {},
    deficitFoncier: normalized.deficitFoncier || {},
    per: normalized.per || {},
    lmp: normalized.lmp || {},
    sciIS: normalized.sciIS || {},
    
    source: 'Normalized data',
    dateMAJ: new Date(),
    validatedBy: 'system'
  };
}

