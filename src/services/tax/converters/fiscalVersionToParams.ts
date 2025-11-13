/**
 * Converter : FiscalVersion (BDD) → TaxParams (format simulation)
 * 
 * Convertit les données stockées en PostgreSQL au format attendu
 * par le simulateur fiscal et l'optimiseur
 */

import type { TaxParams } from '@/types/fiscal';

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
    irBrackets: jsonData.irBrackets || [
      { lower: 0, upper: 11294, rate: 0.00 },
      { lower: 11294, upper: 28797, rate: 0.11 },
      { lower: 28797, upper: 82341, rate: 0.30 },
      { lower: 82341, upper: 177106, rate: 0.41 },
      { lower: 177106, upper: null, rate: 0.45 },
    ],
    
    // ========== DÉCOTE IR ==========
    irDecote: jsonData.irDecote ? {
      threshold: jsonData.irDecote.seuilCelibataire || 1929,
      formula: (tax: number, parts: number) => {
        const seuilCelib = jsonData.irDecote.seuilCelibataire || 1929;
        const seuilCouple = jsonData.irDecote.seuilCouple || 3858;
        const facteur = jsonData.irDecote.facteur || 0.75;
        
        const seuil = parts === 1 ? seuilCelib : seuilCouple;
        const decote = seuil - (facteur * tax);
        return Math.max(0, decote);
      }
    } : {
      threshold: 1929,
      formula: (tax: number, parts: number) => {
        const seuil = parts === 1 ? 1929 : 3858;
        const decote = seuil - (0.75 * tax);
        return Math.max(0, decote);
      }
    },
    
    // ========== ABATTEMENT FORFAITAIRE SALAIRES ==========
    salaryDeduction: jsonData.salaryDeduction || {
      taux: 0.10,      // 10% (Article 83 CGI)
      min: 472,        // Minimum 2025
      max: 13522,      // Maximum 2025
    },
    
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
    
    irDecote: normalized.irDecote ? {
      threshold: normalized.irDecote.seuilCelibataire,
      formula: (tax: number, parts: number) => {
        const seuil = parts === 1 
          ? normalized.irDecote.seuilCelibataire 
          : normalized.irDecote.seuilCouple;
        const facteur = normalized.irDecote.facteur || 0.75;
        return Math.max(0, seuil - (facteur * tax));
      }
    } : undefined,
    
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

