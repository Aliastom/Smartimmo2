/**
 * Exemples d'utilisation de DedupAI
 */

import { dedupAI } from '@/services/dedup-ai.service';

// Exemple 1: Doublon exact par checksum
export function exempleDoublonExact() {
  const tempFile = {
    id: 'temp-123',
    name: 'quittance_janvier_2024.pdf',
    bytes: 1024000,
    size_kb: 1000,
    pages: 1,
    ocr_text: 'Quittance de loyer janvier 2024 - Montant: 1200€ - Locataire: Jean Dupont',
    ocr_quality: 0.95,
    detected_type: 'quittance',
    period: '2024-01-01',
    context: { propertyId: 'prop-123', tenantId: 'tenant-456' },
    checksum: 'sha256:abc123def456'
  };

  const existingCandidates = [{
    id: 'doc-789',
    name: 'quittance_janvier_2024.pdf',
    uploadedAt: '2024-01-15T10:30:00Z',
    size_kb: 1000,
    pages: 1,
    ocr_text: 'Quittance de loyer janvier 2024 - Montant: 1200€ - Locataire: Jean Dupont',
    ocr_quality: 0.90,
    type: 'quittance',
    period: '2024-01-01',
    context: { propertyId: 'prop-123', tenantId: 'tenant-456' },
    checksum: 'sha256:abc123def456'
  }];

  const result = dedupAI.analyze(tempFile, existingCandidates);
  
  console.log('=== DOUBLON EXACT ===');
  console.log('Type:', result.duplicateType);
  console.log('Action suggérée:', result.suggestedAction);
  console.log('Document matché:', result.matchedDocument.name);
  console.log('Signaux:', result.signals);
  console.log('UI:', result.ui);
  
  return result;
}

// Exemple 2: Doublon probable (similarité élevée)
export function exempleDoublonProbable() {
  const tempFile = {
    id: 'temp-456',
    name: 'avis_taxe_fonciere_2024.pdf',
    bytes: 2048000,
    size_kb: 2000,
    pages: 2,
    ocr_text: 'Avis de taxe foncière 2024 - Bien: 12 rue de la Paix - Montant: 1500€',
    ocr_quality: 0.98,
    detected_type: 'taxe_fonciere',
    period: '2024-01-01',
    context: { propertyId: 'prop-789' }
  };

  const existingCandidates = [{
    id: 'doc-321',
    name: 'avis_taxe_fonciere_2024.pdf',
    uploadedAt: '2024-01-10T14:20:00Z',
    size_kb: 1800,
    pages: 2,
    ocr_text: 'Avis de taxe foncière 2024 - Bien: 12 rue de la Paix - Montant: 1500€',
    ocr_quality: 0.85,
    type: 'taxe_fonciere',
    period: '2024-01-01',
    context: { propertyId: 'prop-789' },
    checksum: 'sha256:xyz789abc123'
  }];

  const result = dedupAI.analyze(tempFile, existingCandidates);
  
  console.log('=== DOUBLON PROBABLE ===');
  console.log('Type:', result.duplicateType);
  console.log('Action suggérée:', result.suggestedAction);
  console.log('Similarité textuelle:', Math.round(result.signals.text_similarity * 100) + '%');
  console.log('Qualité OCR nouveau vs existant:', result.signals.ocr_quality_new, 'vs', result.signals.ocr_quality_existing);
  console.log('UI:', result.ui);
  
  return result;
}

// Exemple 3: Doublon potentiel (incertitude)
export function exempleDoublonPotentiel() {
  const tempFile = {
    id: 'temp-789',
    name: 'facture_electricite.pdf',
    bytes: 512000,
    size_kb: 500,
    pages: 1,
    ocr_text: 'Facture électricité janvier 2024 - Consommation: 150 kWh - Montant: 80€',
    ocr_quality: 0.75,
    detected_type: 'facture',
    period: '2024-01-01',
    context: { propertyId: 'prop-456', tenantId: 'tenant-123' }
  };

  const existingCandidates = [{
    id: 'doc-654',
    name: 'facture_electricite.pdf',
    uploadedAt: '2024-01-05T09:15:00Z',
    size_kb: 600,
    pages: 1,
    ocr_text: 'Facture électricité janvier 2024 - Consommation: 150 kWh - Montant: 80€',
    ocr_quality: 0.90,
    type: 'facture',
    period: '2024-01-01',
    context: { propertyId: 'prop-456', tenantId: 'tenant-123' },
    checksum: 'sha256:def456ghi789'
  }];

  const result = dedupAI.analyze(tempFile, existingCandidates);
  
  console.log('=== DOUBLON POTENTIEL ===');
  console.log('Type:', result.duplicateType);
  console.log('Action suggérée:', result.suggestedAction);
  console.log('Période match:', result.signals.period_match);
  console.log('Contexte match:', result.signals.context_match);
  console.log('UI:', result.ui);
  
  return result;
}

// Exemple 4: Aucun doublon
export function exempleAucunDoublon() {
  const tempFile = {
    id: 'temp-999',
    name: 'contrat_assurance.pdf',
    bytes: 1536000,
    size_kb: 1500,
    pages: 3,
    ocr_text: 'Contrat d\'assurance habitation - Police: AH123456 - Validité: 2024-2025',
    ocr_quality: 0.92,
    detected_type: 'assurance',
    period: '2024-01-01',
    context: { propertyId: 'prop-999' }
  };

  const existingCandidates = [{
    id: 'doc-111',
    name: 'quittance_janvier.pdf',
    uploadedAt: '2024-01-15T10:30:00Z',
    size_kb: 1000,
    pages: 1,
    ocr_text: 'Quittance de loyer janvier 2024 - Montant: 1200€',
    ocr_quality: 0.90,
    type: 'quittance',
    period: '2024-01-01',
    context: { propertyId: 'prop-111' },
    checksum: 'sha256:abc123'
  }];

  const result = dedupAI.analyze(tempFile, existingCandidates);
  
  console.log('=== AUCUN DOUBLON ===');
  console.log('Type:', result.duplicateType);
  console.log('Action suggérée:', result.suggestedAction);
  console.log('Document matché:', result.matchedDocument.id);
  console.log('UI:', result.ui);
  
  return result;
}

// Exemple 5: Cas complexe avec plusieurs candidats
export function exempleCandidatsMultiples() {
  const tempFile = {
    id: 'temp-555',
    name: 'avis_taxe_2024.pdf',
    bytes: 1024000,
    size_kb: 1000,
    pages: 1,
    ocr_text: 'Avis de taxe foncière 2024 - Bien: 15 avenue des Champs - Montant: 2000€',
    ocr_quality: 0.88,
    detected_type: 'taxe_fonciere',
    period: '2024-01-01',
    context: { propertyId: 'prop-555' }
  };

  const existingCandidates = [
    {
      id: 'doc-222',
      name: 'avis_taxe_2023.pdf',
      uploadedAt: '2023-01-15T10:30:00Z',
      size_kb: 1000,
      pages: 1,
      ocr_text: 'Avis de taxe foncière 2023 - Bien: 15 avenue des Champs - Montant: 1800€',
      ocr_quality: 0.85,
      type: 'taxe_fonciere',
      period: '2023-01-01',
      context: { propertyId: 'prop-555' },
      checksum: 'sha256:taxe2023'
    },
    {
      id: 'doc-333',
      name: 'avis_taxe_2024.pdf',
      uploadedAt: '2024-01-10T14:20:00Z',
      size_kb: 1000,
      pages: 1,
      ocr_text: 'Avis de taxe foncière 2024 - Bien: 15 avenue des Champs - Montant: 2000€',
      ocr_quality: 0.82,
      type: 'taxe_fonciere',
      period: '2024-01-01',
      context: { propertyId: 'prop-555' },
      checksum: 'sha256:taxe2024'
    },
    {
      id: 'doc-444',
      name: 'quittance_janvier.pdf',
      uploadedAt: '2024-01-05T09:15:00Z',
      size_kb: 800,
      pages: 1,
      ocr_text: 'Quittance de loyer janvier 2024 - Montant: 1200€',
      ocr_quality: 0.90,
      type: 'quittance',
      period: '2024-01-01',
      context: { propertyId: 'prop-555' },
      checksum: 'sha256:quittance'
    }
  ];

  const result = dedupAI.analyze(tempFile, existingCandidates);
  
  console.log('=== CANDIDATS MULTIPLES ===');
  console.log('Type:', result.duplicateType);
  console.log('Action suggérée:', result.suggestedAction);
  console.log('Meilleur match:', result.matchedDocument.name);
  console.log('Similarité avec le meilleur match:', Math.round(result.signals.text_similarity * 100) + '%');
  console.log('UI:', result.ui);
  
  return result;
}

// Fonction pour exécuter tous les exemples
export function executerTousLesExemples() {
  console.log('🧪 Exécution de tous les exemples DedupAI\n');
  
  exempleDoublonExact();
  console.log('\n' + '='.repeat(50) + '\n');
  
  exempleDoublonProbable();
  console.log('\n' + '='.repeat(50) + '\n');
  
  exempleDoublonPotentiel();
  console.log('\n' + '='.repeat(50) + '\n');
  
  exempleAucunDoublon();
  console.log('\n' + '='.repeat(50) + '\n');
  
  exempleCandidatsMultiples();
  
  console.log('\n✅ Tous les exemples ont été exécutés');
}
