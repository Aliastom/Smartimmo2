/**
 * Provider OpenFisca - Source primaire programmatique
 * Récupère les barèmes IR, décote et PS depuis OpenFisca-France
 */

import { ofGet, healthcheck, getVersion } from './client';
import { mapOpenFiscaToPartials } from './map';
import { TaxPartial } from '../../sources/types';

export class OpenfiscaProvider {
  /**
   * Vérifie si OpenFisca est disponible
   */
  async isAvailable(): Promise<boolean> {
    return await healthcheck();
  }
  
  /**
   * Récupère les données fiscales pour une année donnée
   */
  async fetchPartials(year: number): Promise<TaxPartial[]> {
    try {
      // Vérifier la disponibilité
      const available = await this.isAvailable();
      if (!available) {
        console.warn('[OpenFiscaProvider] Service non disponible');
        return [];
      }
      
      // Récupérer la version
      const version = await getVersion();
      console.log(`[OpenFiscaProvider] Version: ${version}`);
      
      // Récupérer les paramètres
      // L'endpoint exact dépend de votre déploiement OpenFisca
      // Options courantes:
      // - /parameters
      // - /parameter/{name}
      // - /spec (puis parser les paramètres)
      
      const params = await this.fetchParameters(year);
      
      // Mapper vers TaxPartial
      const partials = mapOpenFiscaToPartials(year, params, version || undefined);
      
      console.log(`[OpenFiscaProvider] ${partials.length} section(s) extraite(s)`);
      
      return partials;
      
    } catch (error: any) {
      console.error('[OpenFiscaProvider] Erreur:', error.message);
      return [];
    }
  }
  
  /**
   * Récupère les paramètres depuis OpenFisca
   * Utilise les endpoints individuels /parameter/{id}
   */
  private async fetchParameters(year: number): Promise<any> {
    try {
      const params: any = {};
      
      // Liste des paramètres à récupérer (IDs corrigés via exploration de /parameters)
      // Ces IDs correspondent à la structure RÉELLE d'OpenFisca-France 174.2.8
      const parameterIds = [
        // IR : Barème (depuis 1945)
        'impot_revenu.bareme_ir_depuis_1945.bareme',
        
        // IR : Décote (plusieurs paramètres)
        'impot_revenu.calcul_impot_revenu.plaf_qf.decote.seuil_celib',
        'impot_revenu.calcul_impot_revenu.plaf_qf.decote.seuil_couple',
        'impot_revenu.calcul_impot_revenu.plaf_qf.decote.taux',
        
        // PS : Prélèvements sociaux sur revenus du patrimoine
        // IMPORTANT : OpenFisca 174.2.8 NE modélise PAS la CRDS (0.5%)
        // Taux réel 2025 = 17.2% (CSG 9.2% + Solidarité 7.5% + CRDS 0.5%)
        // Taux OpenFisca max = 16.7% (CSG 9.2% + Solidarité 7.5%)
        'taxation_capital.prelevements_sociaux.csg.taux_global.revenus_du_patrimoine',
        'taxation_capital.prelevements_sociaux.prelevement_social.revenus_du_patrimoine',
        'taxation_capital.prelevements_sociaux.contribution_sociale_cnav',
        'taxation_capital.prelevements_sociaux.prelevements_solidarite.revenus_du_patrimoine', // 7.5% depuis 2018
        
        // Micro BIC : Vente de marchandises
        'impot_revenu.calcul_revenus_imposables.rpns.micro.microentreprise.regime_micro_bic.marchandises.plafond',
        'impot_revenu.calcul_revenus_imposables.rpns.micro.microentreprise.regime_micro_bic.marchandises.taux',
        
        // Micro BIC : Services
        'impot_revenu.calcul_revenus_imposables.rpns.micro.microentreprise.regime_micro_bic.services.plafond',
        'impot_revenu.calcul_revenus_imposables.rpns.micro.microentreprise.regime_micro_bic.services.taux',
        
        // Micro BNC
        'impot_revenu.calcul_revenus_imposables.rpns.micro.microentreprise.regime_micro_bnc.plafond',
        'impot_revenu.calcul_revenus_imposables.rpns.micro.microentreprise.regime_micro_bnc.taux',
        
        // Micro foncier
        'impot_revenu.calcul_revenus_imposables.rpns.micro.microfoncier.plafond_recettes',
        'impot_revenu.calcul_revenus_imposables.rpns.micro.microfoncier.taux',
        
        // IS : Impôt sur les sociétés
        'taxation_societes.impot_societe.taux_normal',
        'taxation_societes.impot_societe.taux_reduit',
      ];
      
      // Récupérer chaque paramètre individuellement
      for (const id of parameterIds) {
        try {
          const data = await ofGet(`/parameter/${id}`);
          
          // Stocker avec la structure hiérarchique
          const parts = id.split('.');
          let current = params;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
          }
          current[parts[parts.length - 1]] = data;
          
          console.log(`[OpenFisca] ✓ ${id}`);
        } catch (error: any) {
          console.warn(`[OpenFisca] ✗ ${id} non disponible`);
        }
      }
      
      return params;
      
    } catch (error) {
      console.error('[OpenFiscaProvider] Erreur fetch parameters:', error);
      throw error;
    }
  }
  
  /**
   * Extrait les paramètres depuis /spec
   */
  private extractFromSpec(spec: any, year: number): any {
    // Parser le spec OpenAPI pour extraire les paramètres
    // Structure dépend de la version OpenFisca
    
    const params: any = {};
    
    // Tenter d'extraire depuis definitions ou components
    if (spec.definitions) {
      params.definitions = spec.definitions;
    }
    
    if (spec.components?.schemas) {
      params.schemas = spec.components.schemas;
    }
    
    return params;
  }
}

/**
 * Instance singleton
 */
export const openfiscaProvider = new OpenfiscaProvider();

