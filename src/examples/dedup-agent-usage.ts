/**
 * Exemples d'utilisation de l'agent Dedup
 * Ce fichier montre comment intégrer l'agent dans le workflow d'upload
 */

import { getDedupAgent } from '@/services/dedup-agent.service';
import { DedupInput, DedupOutput } from '@/types/dedup';

// ===== Exemple 1 : Doublon exact (checksum identique) =====

export async function example1_ExactDuplicate() {
  const input: DedupInput = {
    newFile: {
      tempId: 'tmp_123abc',
      name: 'quittance_juin_2025_Jasmin.pdf',
      mime: 'application/pdf',
      size: 328900,
      pages: 1,
      checksum: 'sha256:abc123def456...', // Identique au candidat
      ocr: {
        chars: 892,
        quality: 0.7,
        text: 'Quittance de loyer pour le mois de juin 2025. Locataire: M. Jasmin...',
      },
      extracted: {
        typePredictions: [{ label: 'Quittance de Loyer', score: 0.61 }],
        period: { from: '2025-05-05', to: '2025-06-05' },
      },
      context: {
        propertyId: 'prop_123',
        tenant: 'Jasmin',
      },
    },
    candidates: [
      {
        id: 'doc_abc',
        name: 'quittance_juin_2025_Jasmin.pdf',
        uploadedAt: '2025-06-15T18:42:00Z',
        mime: 'application/pdf',
        size: 329120,
        pages: 1,
        checksum: 'sha256:abc123def456...', // Identique !
        ocr: {
          quality: 0.68,
          textPreview: 'Quittance de loyer pour le mois de juin 2025...',
        },
        extracted: {
          type: 'Quittance de Loyer',
          period: { from: '2025-05-05', to: '2025-06-05' },
        },
        context: {
          propertyId: 'prop_123',
          tenant: 'Jasmin',
        },
        url: '/documents/doc_abc/preview',
      },
    ],
  };

  const agent = getDedupAgent({ enableDebugLogs: true });
  const result = await agent.analyze(input);

  console.log('=== Exemple 1: Doublon Exact ===');
  console.log('Status:', result.status); // "exact_duplicate"
  console.log('Action suggérée:', result.suggestedAction); // "cancel"
  console.log('Niveau modal:', result.modal.level); // "danger"
  console.log('Titre:', result.modal.title); // "Doublon exact détecté"
  console.log('Message:', result.modal.message);
  console.log('CTA principal:', result.modal.primaryCta); // { action: "cancel", label: "Annuler" }
  console.log('Signaux:', result.signals);
  console.log('---\n');

  return result;
}

// ===== Exemple 2 : Quasi-doublon (même contenu, taille différente) =====

export async function example2_ProbableDuplicate_NewBetter() {
  const input: DedupInput = {
    newFile: {
      tempId: 'tmp_456def',
      name: 'contrat_bail_2025_HD.pdf',
      mime: 'application/pdf',
      size: 1250000, // Plus grand
      pages: 8,
      checksum: 'sha256:xyz789...',
      ocr: {
        chars: 4200,
        quality: 0.92, // Meilleure qualité
        text: 'CONTRAT DE LOCATION Article 1: Les parties...',
      },
      extracted: {
        typePredictions: [{ label: 'Bail', score: 0.85 }],
        period: { from: '2025-01-01', to: '2028-01-01' },
      },
      context: {
        propertyId: 'prop_456',
        leaseId: 'lease_789',
      },
    },
    candidates: [
      {
        id: 'doc_xyz',
        name: 'contrat_bail_2025_SD.pdf',
        uploadedAt: '2025-01-10T09:15:00Z',
        mime: 'application/pdf',
        size: 850000, // Plus petit
        pages: 8,
        checksum: 'sha256:different123...',
        ocr: {
          quality: 0.75, // Moins bonne qualité
          textPreview: 'CONTRAT DE LOCATION Article 1: Les parties...',
        },
        extracted: {
          type: 'Bail',
          period: { from: '2025-01-01', to: '2028-01-01' },
        },
        context: {
          propertyId: 'prop_456',
          leaseId: 'lease_789',
        },
        url: '/documents/doc_xyz/preview',
      },
    ],
  };

  const agent = getDedupAgent();
  const result = await agent.analyze(input);

  console.log('=== Exemple 2: Quasi-Doublon (Nouveau Meilleur) ===');
  console.log('Status:', result.status); // "probable_duplicate"
  console.log('Action suggérée:', result.suggestedAction); // "replace"
  console.log('Niveau modal:', result.modal.level); // "warning"
  console.log('Comparaison qualité:', result.signals.qualityComparison); // "new_better"
  console.log('Différences:', result.signals.differences);
  console.log('CTA principal:', result.modal.primaryCta); // { action: "replace", label: "Remplacer..." }
  console.log('---\n');

  return result;
}

// ===== Exemple 3 : Pas de doublon =====

export async function example3_NotDuplicate() {
  const input: DedupInput = {
    newFile: {
      tempId: 'tmp_789ghi',
      name: 'facture_electricite_juillet_2025.pdf',
      mime: 'application/pdf',
      size: 185000,
      pages: 2,
      checksum: 'sha256:unique123...',
      ocr: {
        chars: 1200,
        quality: 0.88,
        text: 'EDF - Facture électricité Juillet 2025...',
      },
      extracted: {
        typePredictions: [{ label: 'Facture', score: 0.92 }],
        period: { from: '2025-07-01', to: '2025-07-31' },
      },
      context: {
        propertyId: 'prop_789',
      },
    },
    candidates: [
      {
        id: 'doc_old',
        name: 'facture_electricite_juin_2025.pdf',
        uploadedAt: '2025-06-20T14:30:00Z',
        mime: 'application/pdf',
        size: 182000,
        pages: 2,
        checksum: 'sha256:different456...',
        ocr: {
          quality: 0.86,
          textPreview: 'EDF - Facture électricité Juin 2025...', // Mois différent
        },
        extracted: {
          type: 'Facture',
          period: { from: '2025-06-01', to: '2025-06-30' }, // Période différente
        },
        context: {
          propertyId: 'prop_789',
        },
        url: '/documents/doc_old/preview',
      },
    ],
  };

  const agent = getDedupAgent();
  const result = await agent.analyze(input);

  console.log('=== Exemple 3: Pas de Doublon ===');
  console.log('Status:', result.status); // "not_duplicate"
  console.log('Action suggérée:', result.suggestedAction); // "keep_both"
  console.log('Similarité textuelle:', result.signals.textSimilarity); // < 0.9
  console.log('Même période:', result.signals.samePeriod); // false
  console.log('---\n');

  return result;
}

// ===== Exemple 4 : Quasi-doublon avec contextes différents =====

export async function example4_DifferentContexts() {
  const input: DedupInput = {
    newFile: {
      tempId: 'tmp_abc999',
      name: 'etat_des_lieux.pdf',
      mime: 'application/pdf',
      size: 750000,
      pages: 5,
      checksum: 'sha256:context123...',
      ocr: {
        chars: 3500,
        quality: 0.8,
        text: 'État des lieux d\'entrée...',
      },
      extracted: {
        typePredictions: [{ label: 'État des Lieux', score: 0.77 }],
      },
      context: {
        propertyId: 'prop_AAA', // Propriété différente
        leaseId: 'lease_111',
      },
    },
    candidates: [
      {
        id: 'doc_similar',
        name: 'etat_des_lieux.pdf',
        uploadedAt: '2024-12-01T10:00:00Z',
        mime: 'application/pdf',
        size: 755000,
        pages: 5,
        checksum: 'sha256:different789...',
        ocr: {
          quality: 0.81,
          textPreview: 'État des lieux d\'entrée...',
        },
        extracted: {
          type: 'État des Lieux',
        },
        context: {
          propertyId: 'prop_BBB', // Propriété différente !
          leaseId: 'lease_222',
        },
        url: '/documents/doc_similar/preview',
      },
    ],
  };

  const agent = getDedupAgent();
  const result = await agent.analyze(input);

  console.log('=== Exemple 4: Quasi-Doublon mais Contextes Différents ===');
  console.log('Status:', result.status); // "probable_duplicate"
  console.log('Action suggérée:', result.suggestedAction); // "keep_both" (contextes différents)
  console.log('Même contexte:', result.signals.sameContext); // false
  console.log('CTA secondaire:', result.modal.secondaryCta); // { action: "keep_both", ... }
  console.log('---\n');

  return result;
}

// ===== Fonction utilitaire : Intégration dans le workflow d'upload =====

export async function handleDocumentUploadWithDedup(
  newFile: DedupInput['newFile'],
  existingDocuments: DedupInput['candidates']
): Promise<{ action: 'proceed' | 'cancel' | 'replace'; dedupResult?: DedupOutput }> {
  const agent = getDedupAgent();

  const result = await agent.analyze({
    newFile,
    candidates: existingDocuments,
  });

  // Si pas de doublon, procéder normalement
  if (result.status === 'not_duplicate') {
    return { action: 'proceed' };
  }

  // Si doublon détecté, retourner le résultat pour affichage de la modale
  return {
    action: result.suggestedAction === 'cancel' ? 'cancel' : 'proceed',
    dedupResult: result,
  };
}

// ===== Exécuter tous les exemples =====

export async function runAllExamples() {
  console.log('\n🚀 === EXEMPLES D\'UTILISATION DE L\'AGENT DEDUP ===\n');

  await example1_ExactDuplicate();
  await example2_ProbableDuplicate_NewBetter();
  await example3_NotDuplicate();
  await example4_DifferentContexts();

  console.log('✅ Tous les exemples ont été exécutés avec succès!\n');
}

// Décommenter pour exécuter les exemples
// runAllExamples();

