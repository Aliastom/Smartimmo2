/**
 * Mapping des paramètres OpenFisca vers NormalizedTaxParams
 */

import { TaxPartial } from '../../sources/types';

/**
 * Mappe les données OpenFisca vers des TaxPartial
 * 
 * Note: La structure exacte dépend de la version d'OpenFisca-France
 * Ce code utilise une structure générique qui devra être ajustée
 */
export function mapOpenFiscaToPartials(year: number, ofData: any, ofVersion?: string): TaxPartial[] {
  const partials: TaxPartial[] = [];
  const fetchedAt = new Date();
  
  try {
    // IR : Barème progressif
    // OpenFisca structure: parameters.impot_revenu.bareme
    const irResult = extractIRBrackets(ofData, year);
    if (irResult && irResult.brackets.length > 0) {
      partials.push({
        section: 'IR',
        data: { irBrackets: irResult.brackets },
        meta: {
          source: 'BOFIP', // OpenFisca n'est pas dans TaxSource, on map à BOFIP pour la priorité
          url: `OpenFisca v${ofVersion || 'unknown'}`,
          fetchedAt,
          hash: JSON.stringify(irResult.brackets),
          confidence: 'high',
          notes: `Barème IR extrait d'OpenFisca-France v${ofVersion || 'unknown'} | Valide jusqu'au: ${irResult.validUntil || 'inconnu'} | Dernière mise à jour: ${irResult.lastUpdate || 'inconnu'}`
        }
      });
    }
    
    // IR : Décote
    const irDecoteResult = extractIRDecote(ofData, year);
    if (irDecoteResult) {
      partials.push({
        section: 'IR_DECOTE',
        data: { irDecote: irDecoteResult.decote },
        meta: {
          source: 'BOFIP',
          url: `OpenFisca v${ofVersion || 'unknown'}`,
          fetchedAt,
          hash: JSON.stringify(irDecoteResult.decote),
          confidence: 'high',
          notes: `Décote IR extraite d'OpenFisca-France v${ofVersion || 'unknown'} | Valide jusqu'au: ${irDecoteResult.validUntil || 'inconnu'} | Dernière mise à jour: ${irDecoteResult.lastUpdate || 'inconnu'}`
        }
      });
    }
    
    // PS : Prélèvements sociaux
    const psResult = extractPSRate(ofData, year);
    if (psResult !== null) {
      partials.push({
        section: 'PS',
        data: { psRate: psResult.rate },
        meta: {
          source: 'BOFIP',
          url: `OpenFisca v${ofVersion || 'unknown'}`,
          fetchedAt,
          hash: psResult.rate.toString(),
          confidence: 'high',
          notes: `Taux PS extrait d'OpenFisca-France v${ofVersion || 'unknown'} | Valide jusqu'au: ${psResult.validUntil || 'inconnu'} | Dernière mise à jour: ${psResult.lastUpdate || 'inconnu'}`
        }
      });
    }
    
    // MICRO : Régimes micro (BIC, BNC, foncier)
    const microResult = extractMicro(ofData, year);
    if (microResult) {
      partials.push({
        section: 'MICRO',
        data: { micro: microResult.micro },
        meta: {
          source: 'BOFIP',
          url: `OpenFisca v${ofVersion || 'unknown'}`,
          fetchedAt,
          hash: JSON.stringify(microResult.micro),
          confidence: 'high',
          notes: `Régimes micro extraits d'OpenFisca-France v${ofVersion || 'unknown'} | Valide jusqu'au: ${microResult.validUntil || 'inconnu'} | Dernière mise à jour: ${microResult.lastUpdate || 'inconnu'}`
        }
      });
    }

    // SCI_IS : Impôt sur les sociétés
    const isResult = extractIS(ofData, year);
    if (isResult) {
      partials.push({
        section: 'SCI_IS',
        data: { sciIS: isResult.sciIS },
        meta: {
          source: 'BOFIP',
          url: `OpenFisca v${ofVersion || 'unknown'}`,
          fetchedAt,
          hash: JSON.stringify(isResult.sciIS),
          confidence: 'high',
          notes: `Taux IS extraits d'OpenFisca-France v${ofVersion || 'unknown'} | Valide jusqu'au: ${isResult.validUntil || 'inconnu'} | Dernière mise à jour: ${isResult.lastUpdate || 'inconnu'}`
        }
      });
    }
    
  } catch (error) {
    console.error('[OpenFisca] Erreur mapping:', error);
  }
  
  return partials;
}

/**
 * Extrait le barème IR depuis les paramètres OpenFisca
 * Structure réelle d'OpenFisca: /parameter/{id} retourne { values: { "YYYY-MM-DD": valeur } }
 * IMPORTANT: Le barème est dans impot_revenu.bareme_ir_depuis_1945.bareme (pas impot_revenu.bareme)
 */
function extractIRBrackets(ofData: any, year: number): {
  brackets: Array<{ lower: number; upper: number | null; rate: number }>;
  validUntil?: string;
  lastUpdate?: string;
} | null {
  try {
    // OpenFisca retourne les paramètres avec une structure temporelle
    // { id: "...", values: { "YYYY-MM-DD": [...] } }
    
    // Nouveau chemin corrigé après exploration de /parameters
    const baremeParam = ofData?.impot_revenu?.bareme_ir_depuis_1945?.bareme;
    if (!baremeParam) {
      console.warn('[OpenFisca] Paramètre bareme non trouvé (cherché: impot_revenu.bareme_ir_depuis_1945.bareme)');
      return null;
    }
    
    // IMPORTANT: Le barème IR a une structure DIFFÉRENTE !
    // "brackets" est un OBJET avec des dates comme clés : { "2024-01-01": { "0": 0, "11295": 0, ... } }
    let baremeData = null;
    
    if (baremeParam.brackets && typeof baremeParam.brackets === 'object') {
      // Prendre la dernière date disponible dans brackets
      const dates = Object.keys(baremeParam.brackets).sort();
      const lastDate = dates[dates.length - 1];
      if (lastDate) {
        baremeData = baremeParam.brackets[lastDate];
        console.log(`[OpenFisca] Barème trouvé pour date ${lastDate} (dernière disponible dans brackets)`);
      }
    } else if (baremeParam.values) {
      // Structure ancienne : values avec dates (au cas où)
      const dates = Object.keys(baremeParam.values).sort();
      const lastDate = dates[dates.length - 1];
      if (lastDate) {
        baremeData = baremeParam.values[lastDate];
        console.log(`[OpenFisca] Barème trouvé pour date ${lastDate} (dernière disponible dans values)`);
      }
    }
    
    if (!baremeData) {
      console.warn('[OpenFisca] Barème IR non trouvé pour', year);
      console.log('[OpenFisca] Structure reçue:', Object.keys(baremeParam));
      return null;
    }
    
    // Convertir l'objet { "0": 0, "11295": 0, "28798": 0.11, ... } en array de tranches
    let bareme: Array<{ lower: number; upper: number | null; rate: number }> = [];
    
    if (Array.isArray(baremeData)) {
      // Si c'est déjà un array, on l'utilise tel quel
      bareme = baremeData;
    } else if (typeof baremeData === 'object') {
      // Sinon, on convertit l'objet en array
      const seuils = Object.keys(baremeData).map(Number).sort((a, b) => a - b);
      
      for (let i = 0; i < seuils.length; i++) {
        const lower = seuils[i];
        const upper = i < seuils.length - 1 ? seuils[i + 1] : null;
        const rate = Number(baremeData[String(lower)]);
        
        bareme.push({ lower, upper, rate });
      }
      
      console.log(`[OpenFisca] Barème converti: ${bareme.length} tranches depuis objet`);
    }
    
    if (bareme.length === 0) {
      console.warn('[OpenFisca] Aucune tranche dans le barème');
      return null;
    }
    
    // Convertir au format attendu (si nécessaire)
    const brackets = bareme.map((tranche: any) => {
      // Si déjà au bon format, on garde tel quel
      if ('lower' in tranche && 'rate' in tranche) {
        return tranche;
      }
      // Sinon, on convertit
      return {
        lower: Number(tranche.seuil || tranche.min || tranche.lower || 0),
        upper: tranche.plafond !== undefined ? Number(tranche.plafond) : (tranche.max !== undefined ? Number(tranche.max) : (tranche.upper !== undefined ? tranche.upper : null)),
        rate: Number(tranche.taux || tranche.rate || tranche.rate || 0)
      };
    });
    
    console.log(`[OpenFisca] Barème IR extrait: ${brackets.length} tranches`);
    
    // Filtrer les tranches invalides
    const validBrackets = brackets.filter((b: any) => 
      typeof b.lower === 'number' && 
      typeof b.rate === 'number'
    );
    
    // Extraire les métadonnées de date
    const validUntil = baremeParam.metadata?.last_value_still_valid_on || undefined;
    const lastUpdate = baremeParam.brackets ? Object.keys(baremeParam.brackets).sort().slice(-1)[0] : undefined;
    
    console.log(`[OpenFisca] Barème IR - Dernière mise à jour: ${lastUpdate}, Valide jusqu'au: ${validUntil}`);
    
    return {
      brackets: validBrackets,
      validUntil,
      lastUpdate
    };
    
  } catch (error) {
    console.error('[OpenFisca] Erreur extraction IR brackets:', error);
    return null;
  }
}

/**
 * Extrait la décote IR depuis les paramètres OpenFisca
 * IMPORTANT: La décote est éclatée en 3 paramètres séparés dans OpenFisca
 */
function extractIRDecote(ofData: any, year: number): {
  decote: any;
  validUntil?: string;
  lastUpdate?: string;
} | null {
  try {
    // Nouveau chemin corrigé : impot_revenu.calcul_impot_revenu.plaf_qf.decote.*
    const decotePath = ofData?.impot_revenu?.calcul_impot_revenu?.plaf_qf?.decote;
    if (!decotePath) {
      console.warn('[OpenFisca] Paramètre décote non trouvé (cherché: impot_revenu.calcul_impot_revenu.plaf_qf.decote)');
      return null;
    }
    
    // Fonction helper pour prendre la dernière valeur disponible
    const getLastValue = (param: any): number | null => {
      if (!param?.values) return null;
      const dates = Object.keys(param.values).sort();
      const lastDate = dates[dates.length - 1];
      return lastDate ? Number(param.values[lastDate]) : null;
    };
    
    // Extraire seuil_celib (dernière valeur disponible)
    const seuilCelib = getLastValue(decotePath.seuil_celib);
    
    // Extraire seuil_couple (dernière valeur disponible)
    const seuilCouple = getLastValue(decotePath.seuil_couple);
    
    // Extraire taux (dernière valeur disponible)
    const taux = getLastValue(decotePath.taux);
    
    if (seuilCelib === null || seuilCouple === null || taux === null) {
      console.warn('[OpenFisca] Décote IR incomplète pour', year, { seuilCelib, seuilCouple, taux });
      return null;
    }
    
    console.log(`[OpenFisca] Décote IR extraite: seuil celib ${seuilCelib}, couple ${seuilCouple}, taux ${taux}`);
    
    // Extraire les métadonnées de date (prendre la plus conservatrice des 3 paramètres)
    const validUntilDates = [
      decotePath.seuil_celib?.metadata?.last_value_still_valid_on,
      decotePath.seuil_couple?.metadata?.last_value_still_valid_on,
      decotePath.taux?.metadata?.last_value_still_valid_on
    ].filter(Boolean);
    
    const validUntil = validUntilDates.length > 0 ? validUntilDates.sort()[0] : undefined; // Plus ancienne = plus conservatrice
    
    const lastUpdateDates = [
      decotePath.seuil_celib?.values ? Object.keys(decotePath.seuil_celib.values).sort().slice(-1)[0] : null,
      decotePath.seuil_couple?.values ? Object.keys(decotePath.seuil_couple.values).sort().slice(-1)[0] : null,
      decotePath.taux?.values ? Object.keys(decotePath.taux.values).sort().slice(-1)[0] : null
    ].filter(Boolean);
    
    const lastUpdate = lastUpdateDates.length > 0 ? lastUpdateDates.sort().slice(-1)[0] : undefined; // Plus récente
    
    return {
      decote: {
        seuilCelibataire: seuilCelib,
        seuilCouple: seuilCouple,
        facteur: taux
      },
      validUntil,
      lastUpdate
    };
    
  } catch (error) {
    console.error('[OpenFisca] Erreur extraction décote:', error);
    return null;
  }
}

/**
 * Extrait le taux de prélèvements sociaux depuis OpenFisca
 * Les PS sont composés de plusieurs contributions (CSG, prélèvement social, etc.)
 */
function extractPSRate(ofData: any, year: number): {
  rate: number;
  validUntil?: string;
  lastUpdate?: string;
} | null {
  try {
    const taxation = ofData?.taxation_capital?.prelevements_sociaux;
    if (!taxation) {
      console.warn('[OpenFisca] Paramètres prélèvements sociaux non trouvés');
      return null;
    }
    
    // Fonction helper pour prendre la dernière valeur disponible
    const getLastValue = (param: any): number | null => {
      if (!param?.values) return null;
      const dates = Object.keys(param.values).sort();
      const lastDate = dates[dates.length - 1];
      return lastDate ? Number(param.values[lastDate]) : null;
    };
    
    let total = 0;
    let found = false;
    
    // CSG sur revenus du patrimoine
    const csg = taxation?.csg?.taux_global?.revenus_du_patrimoine;
    const csgVal = getLastValue(csg);
    if (csgVal !== null) {
      total += csgVal;
      found = true;
      console.log(`[OpenFisca] CSG patrimoine: ${csgVal} (dernière valeur)`);
    }
    
    // Prélèvement social sur revenus du patrimoine
    const ps = taxation?.prelevement_social?.revenus_du_patrimoine;
    const psVal = getLastValue(ps);
    if (psVal !== null) {
      total += psVal;
      found = true;
      console.log(`[OpenFisca] Prélèvement social: ${psVal} (dernière valeur)`);
    }
    
    // Contribution sociale (CNAV)
    const cnav = taxation?.contribution_sociale_cnav;
    const cnavVal = getLastValue(cnav);
    if (cnavVal !== null) {
      total += cnavVal;
      found = true;
      console.log(`[OpenFisca] CNAV: ${cnavVal} (dernière valeur)`);
    }
    
    // Prélèvements solidarité (remplace CAPS depuis 2018)
    const solidarite = taxation?.prelevements_solidarite?.revenus_du_patrimoine;
    const solidariteVal = getLastValue(solidarite);
    if (solidariteVal !== null) {
      total += solidariteVal;
      found = true;
      console.log(`[OpenFisca] Prélèvements solidarité: ${solidariteVal} (dernière valeur)`);
    }
    
    if (!found) {
      console.warn('[OpenFisca] Aucun taux PS trouvé pour', year);
      return null;
    }
    
    // ATTENTION : OpenFisca ne modélise PAS la CRDS (0.5%)
    // Taux réel 2025 = 17.2%, Taux OpenFisca max = 16.7%
    console.log(`[OpenFisca] Taux PS total: ${total} (CRDS 0.5% non modélisée par OpenFisca)`);
    
    // Extraire les métadonnées de date
    const validUntilDates = [
      csg?.metadata?.last_value_still_valid_on,
      ps?.metadata?.last_value_still_valid_on,
      cnav?.metadata?.last_value_still_valid_on,
      solidarite?.metadata?.last_value_still_valid_on
    ].filter(Boolean);
    
    const validUntil = validUntilDates.length > 0 ? validUntilDates.sort()[0] : undefined;
    
    const lastUpdateDates = [
      csg?.values ? Object.keys(csg.values).sort().slice(-1)[0] : null,
      ps?.values ? Object.keys(ps.values).sort().slice(-1)[0] : null,
      cnav?.values ? Object.keys(cnav.values).sort().slice(-1)[0] : null,
      solidarite?.values ? Object.keys(solidarite.values).sort().slice(-1)[0] : null
    ].filter(Boolean);
    
    const lastUpdate = lastUpdateDates.length > 0 ? lastUpdateDates.sort().slice(-1)[0] : undefined;
    
    console.log(`[OpenFisca] PS - Valide jusqu'au: ${validUntil}, Dernière MAJ: ${lastUpdate}`);
    
    // OpenFisca retourne déjà en fraction (0.172 = 17.2%)
    return { rate: total, validUntil, lastUpdate };
    
  } catch (error) {
    console.error('[OpenFisca] Erreur extraction PS:', error);
    return null;
  }
}

/**
 * Extrait les régimes micro (BIC, BNC, foncier) depuis OpenFisca
 * Chemin: impot_revenu.calcul_revenus_imposables.rpns.micro.*
 */
function extractMicro(ofData: any, year: number): {
  micro: any;
  validUntil?: string;
  lastUpdate?: string;
} | null {
  try {
    const microPath = ofData?.impot_revenu?.calcul_revenus_imposables?.rpns?.micro;
    if (!microPath) {
      console.warn('[OpenFisca] Paramètres micro non trouvés');
      return null;
    }
    
    // Fonction helper pour prendre la dernière valeur disponible
    const getLastValue = (param: any): number | null => {
      if (!param?.values) return null;
      const dates = Object.keys(param.values).sort();
      const lastDate = dates[dates.length - 1];
      return lastDate ? Number(param.values[lastDate]) : null;
    };
    
    const micro: any = {};
    let found = false;
    
    // BIC marchandises (vente)
    const bicMarch = microPath?.microentreprise?.regime_micro_bic?.marchandises;
    const bicMarchPlafond = getLastValue(bicMarch?.plafond);
    const bicMarchTaux = getLastValue(bicMarch?.taux);
    if (bicMarchPlafond !== null && bicMarchTaux !== null) {
      if (!micro.bic) micro.bic = {};
      micro.bic.vente = {
        plafond: bicMarchPlafond,
        abattement: bicMarchTaux
      };
      found = true;
      console.log(`[OpenFisca] Micro BIC vente: plafond ${micro.bic.vente.plafond}, abattement ${micro.bic.vente.abattement}`);
    }
    
    // BIC services
    const bicServ = microPath?.microentreprise?.regime_micro_bic?.services;
    const bicServPlafond = getLastValue(bicServ?.plafond);
    const bicServTaux = getLastValue(bicServ?.taux);
    if (bicServPlafond !== null && bicServTaux !== null) {
      if (!micro.bic) micro.bic = {};
      micro.bic.services = {
        plafond: bicServPlafond,
        abattement: bicServTaux
      };
      found = true;
      console.log(`[OpenFisca] Micro BIC services: plafond ${micro.bic.services.plafond}, abattement ${micro.bic.services.abattement}`);
    }
    
    // BNC
    const bnc = microPath?.microentreprise?.regime_micro_bnc;
    const bncPlafond = getLastValue(bnc?.plafond);
    const bncTaux = getLastValue(bnc?.taux);
    if (bncPlafond !== null && bncTaux !== null) {
      micro.bnc = {
        plafond: bncPlafond,
        abattement: bncTaux
      };
      found = true;
      console.log(`[OpenFisca] Micro BNC: plafond ${micro.bnc.plafond}, abattement ${micro.bnc.abattement}`);
    }
    
    // Micro foncier
    const foncier = microPath?.microfoncier;
    const foncierPlafond = getLastValue(foncier?.plafond_recettes);
    const foncierTaux = getLastValue(foncier?.taux);
    if (foncierPlafond !== null && foncierTaux !== null) {
      micro.foncier = {
        plafond: foncierPlafond,
        abattement: foncierTaux
      };
      found = true;
      console.log(`[OpenFisca] Micro foncier: plafond ${micro.foncier.plafond}, abattement ${micro.foncier.abattement}`);
    }
    
    if (!found) {
      console.warn('[OpenFisca] Aucun régime micro trouvé pour', year);
      return null;
    }
    
    console.log(`[OpenFisca] Régimes micro extraits: ${Object.keys(micro).join(', ')}`);
    
    // Extraire les métadonnées de date de tous les sous-paramètres
    const allValidUntil = [
      bicMarch?.plafond?.metadata?.last_value_still_valid_on,
      bicMarch?.taux?.metadata?.last_value_still_valid_on,
      bicServ?.plafond?.metadata?.last_value_still_valid_on,
      bicServ?.taux?.metadata?.last_value_still_valid_on,
      bnc?.plafond?.metadata?.last_value_still_valid_on,
      bnc?.taux?.metadata?.last_value_still_valid_on,
      foncier?.plafond_recettes?.metadata?.last_value_still_valid_on,
      foncier?.taux?.metadata?.last_value_still_valid_on,
    ].filter(Boolean);
    
    const validUntil = allValidUntil.length > 0 ? allValidUntil.sort()[0] : undefined;
    
    const allLastUpdate = [
      bicMarch?.plafond?.values ? Object.keys(bicMarch.plafond.values).sort().slice(-1)[0] : null,
      bicServ?.plafond?.values ? Object.keys(bicServ.plafond.values).sort().slice(-1)[0] : null,
      bnc?.plafond?.values ? Object.keys(bnc.plafond.values).sort().slice(-1)[0] : null,
      foncier?.plafond_recettes?.values ? Object.keys(foncier.plafond_recettes.values).sort().slice(-1)[0] : null,
    ].filter(Boolean);
    
    const lastUpdate = allLastUpdate.length > 0 ? allLastUpdate.sort().slice(-1)[0] : undefined;
    
    console.log(`[OpenFisca] MICRO - Valide jusqu'au: ${validUntil}, Dernière MAJ: ${lastUpdate}`);
    
    return { micro, validUntil, lastUpdate };
    
  } catch (error) {
    console.error('[OpenFisca] Erreur extraction micro:', error);
    return null;
  }
}

/**
 * Extrait les taux d'IS depuis OpenFisca
 * Structure: taxation_societes.impot_societe.taux_normal / taux_reduit
 */
function extractIS(ofData: any, year: number): {
  sciIS: any;
  validUntil?: string;
  lastUpdate?: string;
} | null {
  try {
    const isPath = ofData?.taxation_societes?.impot_societe;
    if (!isPath) {
      console.warn('[OpenFisca] Paramètres IS non trouvés');
      return null;
    }
    
    // Fonction helper pour prendre la dernière valeur disponible
    const getLastValue = (param: any): number | null => {
      if (!param?.values) return null;
      const dates = Object.keys(param.values).sort();
      const lastDate = dates[dates.length - 1];
      return lastDate ? Number(param.values[lastDate]) : null;
    };
    
    const tauxNormal = getLastValue(isPath.taux_normal);
    const tauxReduit = getLastValue(isPath.taux_reduit);
    
    if (tauxNormal === null || tauxReduit === null) {
      console.warn('[OpenFisca] Taux IS incomplets');
      return null;
    }
    
    // IMPORTANT : Garder les décimales [0,1] pour validation (PAS de multiplication par 100)
    // Le validateur attend 0.25 (pas 25), 0.15 (pas 15)
    const sciIS = {
      tauxNormal: tauxNormal, // 0.25 (25%)
      tauxReduit: tauxReduit, // 0.15 (15%)
    };
    
    console.log(`[OpenFisca] Taux IS extraits: normal ${(sciIS.tauxNormal * 100).toFixed(0)}% (${sciIS.tauxNormal}), réduit ${(sciIS.tauxReduit * 100).toFixed(0)}% (${sciIS.tauxReduit})`);
    
    // Métadonnées
    const validUntil = isPath.taux_normal?.metadata?.last_value_still_valid_on || 
                      isPath.taux_reduit?.metadata?.last_value_still_valid_on;
    
    const lastUpdateNormal = isPath.taux_normal?.values ? Object.keys(isPath.taux_normal.values).sort().slice(-1)[0] : null;
    const lastUpdateReduit = isPath.taux_reduit?.values ? Object.keys(isPath.taux_reduit.values).sort().slice(-1)[0] : null;
    const lastUpdate = [lastUpdateNormal, lastUpdateReduit].filter(Boolean).sort().slice(-1)[0] || undefined;
    
    console.log(`[OpenFisca] IS - Valide jusqu'au: ${validUntil || 'inconnu'}, Dernière MAJ: ${lastUpdate || 'inconnu'}`);
    
    return { sciIS, validUntil, lastUpdate };
    
  } catch (error) {
    console.error('[OpenFisca] Erreur extraction IS:', error);
    return null;
  }
}

