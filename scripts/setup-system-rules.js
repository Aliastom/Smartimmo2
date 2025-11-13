/**
 * Script pour configurer les règles de suggestion de base pour tous les types système
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const systemRules = {
  RENT_RECEIPT: {
    rules: [
      {
        pattern: '(quittance|loyer|receipt|rent[_\\s-]?receipt|mois.*loyer)',
        apply_in: ['transaction', 'lease', 'global'],
        mime_in: ['application/pdf', 'image/*'],
        ocr_keywords: ['quittance', 'loyer', 'mois de', 'mois d\'', 'rent receipt'],
        weight: 10,
        type_code: 'RENT_RECEIPT',
        lock: false
      }
    ],
    defaults_by_context: {
      transaction: 'RENT_RECEIPT',
      lease: 'RENT_RECEIPT',
      global: 'MISC'
    }
  },

  SIGNED_LEASE: {
    rules: [
      {
        pattern: '(bail|contrat.*location|lease).*(sign[é|e]|signed|paraph[é|e]|initialis[é|e])',
        apply_in: ['lease', 'property', 'global'],
        mime_in: ['application/pdf'],
        ocr_keywords: ['bail signé', 'contrat de location', 'loi 89', 'signature', 'paraphe'],
        weight: 9.5,
        type_code: 'SIGNED_LEASE',
        lock: false
      }
    ],
    defaults_by_context: {
      lease: 'SIGNED_LEASE',
      property: 'SIGNED_LEASE',
      global: 'MISC'
    }
  },

  LEASE_DRAFT: {
    rules: [
      {
        pattern: '(bail|contrat).*(brouillon|draft|mod[èe]le|template|projet)',
        apply_in: ['lease', 'property', 'global'],
        mime_in: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        ocr_keywords: ['brouillon', 'modèle', 'draft', 'template', 'projet'],
        weight: 8.5,
        type_code: 'LEASE_DRAFT',
        lock: false
      }
    ],
    defaults_by_context: {
      lease: 'LEASE_DRAFT',
      property: 'LEASE_DRAFT',
      global: 'MISC'
    }
  },

  EDL_IN: {
    rules: [
      {
        pattern: '(état.*des.*lieux|\\bedl\\b|inventaire).*(entr[ée|ee]|entree|\\bin\\b|entrant)',
        apply_in: ['property', 'lease', 'global'],
        mime_in: ['application/pdf', 'image/*'],
        ocr_keywords: ['état des lieux', 'entrée', 'compteurs', 'inventaire', 'EDL entrée'],
        weight: 8.3,
        type_code: 'EDL_IN',
        lock: false
      }
    ],
    defaults_by_context: {
      property: 'EDL_IN',
      lease: 'EDL_IN',
      global: 'MISC'
    }
  },

  EDL_OUT: {
    rules: [
      {
        pattern: '(état.*des.*lieux|\\bedl\\b|inventaire).*(sortie|\\bout\\b|sortant|rendu)',
        apply_in: ['property', 'lease', 'global'],
        mime_in: ['application/pdf', 'image/*'],
        ocr_keywords: ['état des lieux', 'sortie', 'rendu', 'exit', 'EDL sortie'],
        weight: 8.3,
        type_code: 'EDL_OUT',
        lock: false
      }
    ],
    defaults_by_context: {
      property: 'EDL_OUT',
      lease: 'EDL_OUT',
      global: 'MISC'
    }
  },

  RIB: {
    rules: [
      {
        pattern: '(\\biban\\b|\\bbic\\b|\\brib\\b|relev[é|e]|virement|banking|identit[é|e].*bancaire)',
        apply_in: ['tenant', 'lease', 'global', 'transaction'],
        mime_in: ['application/pdf', 'image/*'],
        ocr_keywords: ['IBAN', 'BIC', 'RIB', 'relevé', 'virement', 'identité bancaire'],
        weight: 8.0,
        type_code: 'RIB',
        lock: false
      }
    ],
    defaults_by_context: {
      tenant: 'RIB',
      lease: 'RIB',
      global: 'MISC'
    }
  },

  INSURANCE: {
    rules: [
      {
        pattern: '(assurance|attestation|police|insurance|garantie|assureur)',
        apply_in: ['property', 'lease', 'tenant', 'global'],
        mime_in: ['application/pdf', 'image/*'],
        ocr_keywords: ['assurance', 'attestation', 'police', 'garantie', 'couverture', 'assureur'],
        weight: 7.6,
        type_code: 'INSURANCE',
        lock: false
      }
    ],
    defaults_by_context: {
      property: 'INSURANCE',
      lease: 'INSURANCE',
      tenant: 'INSURANCE',
      global: 'MISC'
    }
  },

  TAX: {
    rules: [
      {
        pattern: '(avis.*imposition|taxe.*fonci[èe]re|imp[oô]ts?|fiscal|\\bifu\\b)',
        apply_in: ['property', 'global', 'tenant'],
        mime_in: ['application/pdf', 'image/*'],
        ocr_keywords: ['avis d\'imposition', 'taxe foncière', 'impôt', 'fiscal', 'IFU'],
        weight: 8.0,
        type_code: 'TAX',
        lock: false
      }
    ],
    defaults_by_context: {
      property: 'TAX',
      global: 'MISC'
    }
  },

  PHOTO: {
    rules: [
      {
        pattern: '(photo|image|picture|visuel|appartement|maison|bien|vue|ext[ée]rieur|int[ée]rieur)',
        apply_in: ['property', 'global'],
        mime_in: ['image/*'],
        ocr_keywords: ['photo', 'image', 'visuel'],
        weight: 6.0,
        type_code: 'PHOTO',
        lock: false
      }
    ],
    defaults_by_context: {
      property: 'PHOTO',
      global: 'MISC'
    }
  },

  MISC: {
    rules: [
      {
        pattern: '(.*)',
        apply_in: ['global'],
        mime_in: ['*/*'],
        ocr_keywords: [],
        weight: 1.0,
        type_code: 'MISC',
        lock: false
      }
    ],
    defaults_by_context: {
      global: 'MISC'
    }
  }
};

async function setupSystemRules() {
  console.log('🔧 Configuration des règles de suggestion pour les types système\n');

  try {
    const systemTypes = await prisma.documentType.findMany({
      where: { isSystem: true }
    });

    console.log(`📊 ${systemTypes.length} types système à configurer\n`);

    for (const type of systemTypes) {
      const rulesConfig = systemRules[type.code];
      
      if (!rulesConfig) {
        console.log(`⚠️ Pas de règles définies pour ${type.code}`);
        continue;
      }

      console.log(`📋 Configuration de ${type.code} (${type.label})`);
      
      // Vérifier si des règles existent déjà
      const existingConfig = type.suggestionConfig ? JSON.parse(type.suggestionConfig) : null;
      const hasRules = existingConfig && existingConfig.rules && existingConfig.rules.length > 0;
      
      if (hasRules) {
        console.log(`   ⚠️ Règles existantes détectées (${existingConfig.rules.length} règles)`);
        console.log(`   🔄 Mise à jour des règles...`);
      } else {
        console.log(`   ➕ Ajout de nouvelles règles...`);
      }

      // Mettre à jour avec les nouvelles règles
      await prisma.documentType.update({
        where: { id: type.id },
        data: {
          suggestionConfig: JSON.stringify(rulesConfig),
          defaultContexts: JSON.stringify(Object.keys(rulesConfig.defaults_by_context || {})),
          lockInFlows: JSON.stringify([]) // Pas de verrous par défaut
        }
      });

      console.log(`   ✅ ${rulesConfig.rules.length} règle(s) configurée(s)`);
      console.log(`   📍 Contextes par défaut: ${Object.keys(rulesConfig.defaults_by_context || {}).join(', ')}`);
      console.log('');
    }

    console.log('🎉 Configuration des règles système terminée !');
    console.log('\n📊 Résumé:');
    console.log('✅ RENT_RECEIPT: Règles pour quittances et loyers');
    console.log('✅ SIGNED_LEASE: Règles pour baux signés');
    console.log('✅ LEASE_DRAFT: Règles pour brouillons de bail');
    console.log('✅ EDL_IN/OUT: Règles pour états des lieux');
    console.log('✅ RIB: Règles pour documents bancaires');
    console.log('✅ INSURANCE: Règles pour assurances');
    console.log('✅ TAX: Règles pour documents fiscaux');
    console.log('✅ PHOTO: Règles pour images/photos');
    console.log('✅ MISC: Règle catch-all par défaut');

  } catch (error) {
    console.error('❌ Erreur lors de la configuration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

setupSystemRules().catch(console.error);
