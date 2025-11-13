/**
 * Configuration centralisée des sources de scraping
 * URLs vérifiées et à jour pour le scraping des barèmes fiscaux
 */

export interface SourceUrl {
  path: string;
  label: string;
  section: string;
  verified: string | null; // Date de dernière vérification
  notes?: string;
}

export interface SourceConfig {
  name: string;
  baseUrl: string;
  status: 'active' | 'inactive';
  urls?: SourceUrl[];
  parameters?: Array<{ id: string; label: string; section: string }>;
}

/**
 * Configuration des sources de scraping
 * Mise à jour: 08/11/2025
 */
export const TAX_SOURCES_CONFIG: Record<string, SourceConfig> = {
  OPENFISCA: {
    name: 'OpenFisca-France',
    baseUrl: process.env.OPENFISCA_BASE_URL || 'http://localhost:2000',
    status: 'active',
    parameters: [
      // IR
      { id: 'impot_revenu.bareme_ir_depuis_1945.bareme', label: 'Barème IR', section: 'IR' },
      
      // IR_DECOTE
      { id: 'impot_revenu.calcul_impot_revenu.plaf_qf.decote.seuil_celib', label: 'Décote seuil célib', section: 'IR_DECOTE' },
      { id: 'impot_revenu.calcul_impot_revenu.plaf_qf.decote.seuil_couple', label: 'Décote seuil couple', section: 'IR_DECOTE' },
      { id: 'impot_revenu.calcul_impot_revenu.plaf_qf.decote.taux', label: 'Décote taux', section: 'IR_DECOTE' },
      
      // PS
      { id: 'taxation_capital.prelevements_sociaux.csg.taux_global.revenus_du_patrimoine', label: 'CSG patrimoine', section: 'PS' },
      { id: 'taxation_capital.prelevements_sociaux.prelevement_social.revenus_du_patrimoine', label: 'PS patrimoine', section: 'PS' },
      { id: 'taxation_capital.prelevements_sociaux.contribution_sociale_cnav', label: 'CNAV', section: 'PS' },
      
      // MICRO
      { id: 'impot_revenu.calcul_revenus_imposables.rpns.micro.microentreprise.regime_micro_bic.marchandises.plafond', label: 'Micro BIC marchandises plafond', section: 'MICRO' },
      { id: 'impot_revenu.calcul_revenus_imposables.rpns.micro.microentreprise.regime_micro_bic.marchandises.taux', label: 'Micro BIC marchandises taux', section: 'MICRO' },
      { id: 'impot_revenu.calcul_revenus_imposables.rpns.micro.microentreprise.regime_micro_bic.services.plafond', label: 'Micro BIC services plafond', section: 'MICRO' },
      { id: 'impot_revenu.calcul_revenus_imposables.rpns.micro.microentreprise.regime_micro_bic.services.taux', label: 'Micro BIC services taux', section: 'MICRO' },
      { id: 'impot_revenu.calcul_revenus_imposables.rpns.micro.microentreprise.regime_micro_bnc.plafond', label: 'Micro BNC plafond', section: 'MICRO' },
      { id: 'impot_revenu.calcul_revenus_imposables.rpns.micro.microentreprise.regime_micro_bnc.taux', label: 'Micro BNC taux', section: 'MICRO' },
      { id: 'impot_revenu.calcul_revenus_imposables.rpns.micro.microfoncier.plafond_recettes', label: 'Micro foncier plafond', section: 'MICRO' },
      { id: 'impot_revenu.calcul_revenus_imposables.rpns.micro.microfoncier.taux', label: 'Micro foncier taux', section: 'MICRO' },
    ]
  },

  BOFIP: {
    name: 'BOFIP (Bulletin Officiel des Finances Publiques)',
    baseUrl: 'https://bofip.impots.gouv.fr',
    status: 'active',
    urls: [
      {
        path: '/bofip/2491-PGP.html/identifiant=BOI-IR-LIQ-20-10-20250414',
        label: 'Barème IR 2025 (revenus 2024)',
        section: 'IR',
        verified: '2025-11-08',
        notes: 'Table HTML avec 5 tranches : 0-11497, 11498-29315, 29316-83823, 83824-180294, >180294'
      },
      {
        path: '/bofip/2495-PGP.html/identifiant=BOI-IR-LIQ-20-20-30-20250414',
        label: 'Décote IR 2025',
        section: 'IR_DECOTE',
        verified: '2025-11-08',
        notes: 'Seuils: 889€ (célib), 1470€ (couple), Taux: 45.25%'
      },
      {
        path: '/bofip/1733-PGP.html',
        label: 'Prélèvements sociaux',
        section: 'PS',
        verified: null,
        notes: 'À METTRE À JOUR - URL obsolète'
      },
      {
        path: '/bofip/3973-PGP.html/identifiant=BOI-RFPI-DECLA-10-20160706',
        label: 'Régime micro-foncier (15000€, 30%)',
        section: 'MICRO',
        verified: '2025-11-08',
        notes: 'Seuil 15 000€, Abattement 30%, Version en vigueur depuis 06/03/2025'
      },
    ]
  },

  DGFIP: {
    name: 'DGFiP / impots.gouv.fr',
    baseUrl: 'https://www.impots.gouv.fr',
    status: 'active',
    urls: [
      {
        path: '/particulier/questions/je-mets-en-location-un-logement-vide-comment-declarer-les-loyers-percus',
        label: 'Micro-foncier (15 000€, 30%)',
        section: 'MICRO',
        verified: '2025-11-08',
        notes: 'Seuil 15 000€, Abattement 30%'
      },
    ]
  },

  SERVICE_PUBLIC: {
    name: 'Service-Public.fr',
    baseUrl: 'https://www.service-public.fr',
    status: 'inactive', // URLs obsolètes (404 ou mauvaises pages)
    urls: [
      {
        path: '/particuliers/vosdroits/F23267',
        label: 'Micro-entreprise (404)',
        section: 'MICRO',
        verified: null,
        notes: 'URL invalide - page supprimée'
      },
      {
        path: '/particuliers/vosdroits/F32744',
        label: 'Location meublée (mauvaise section)',
        section: 'DEFICIT',
        verified: null,
        notes: 'Page existante mais parle de LMNP, pas de déficit foncier'
      },
    ]
  },

  ECONOMIE_GOUV: {
    name: 'Ministère de l\'Économie',
    baseUrl: 'https://www.economie.gouv.fr',
    status: 'active',
    urls: [
      {
        path: '/particuliers/gerer-mon-argent/gerer-mon-budget-et-mon-epargne/comment-fonctionne-le-plan-depargne',
        label: 'PER (Plan Épargne Retraite)',
        section: 'PER',
        verified: '2025-11-08',
        notes: 'Plafonds PER : Salariés 10%/35194€, Indépendants 10%/351936€+15%'
      },
    ]
  },

  LEGIFRANCE: {
    name: 'Legifrance',
    baseUrl: 'https://www.legifrance.gouv.fr',
    status: 'inactive', // Bloqué par Cloudflare (403)
    urls: [
      {
        path: '/codes/section_lc/LEGISCTA000006173390',
        label: 'CGI Article 197 (barème IR)',
        section: 'IR',
        verified: null,
        notes: 'Bloqué par Cloudflare - source de cross-check uniquement'
      },
    ]
  }
};

/**
 * Récupère les URLs pour une source donnée
 */
export function getSourceUrls(sourceName: keyof typeof TAX_SOURCES_CONFIG): SourceUrl[] {
  return TAX_SOURCES_CONFIG[sourceName]?.urls || [];
}

/**
 * Récupère l'URL complète pour un chemin donné
 */
export function getFullUrl(sourceName: keyof typeof TAX_SOURCES_CONFIG, path: string): string {
  const baseUrl = TAX_SOURCES_CONFIG[sourceName]?.baseUrl || '';
  return `${baseUrl}${path}`;
}

/**
 * Export pour compatibilité avec SourceConfigModal et configLoader
 */
export const DEFAULT_SOURCES = TAX_SOURCES_CONFIG;

