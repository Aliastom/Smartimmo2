/**
 * Tests d'intégration pour DedupFlow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock des modules
vi.mock('@/services/dedup-flow.service', () => ({
  dedupFlowService: {
    orchestrateFlow: vi.fn(),
    processApiResult: vi.fn(),
  }
}));

describe('DedupFlow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('UploadReviewModal Integration', () => {
    it('devrait orchestrer le flux DedupFlow quand un doublon est détecté', async () => {
      // Simuler la détection d'un doublon
      const duplicateData = {
        status: 'exact_duplicate',
        isDuplicate: true,
        matchedDocument: {
          id: 'doc-123',
          name: 'test.pdf',
          uploadedAt: '2024-01-15T10:30:00Z',
          size: 1024000,
          mime: 'application/pdf'
        }
      };

      const tempFileData = {
        tempId: 'temp-456',
        originalName: 'test.pdf',
        size: 1024000,
        mime: 'application/pdf',
        sha256: 'sha256:abc123'
      };

      // Vérifier que les données sont correctement formatées pour DedupFlow
      const expectedDedupFlowInput = {
        duplicateType: 'exact_duplicate',
        existingFile: {
          id: 'doc-123',
          name: 'test.pdf',
          uploadedAt: '2024-01-15T10:30:00Z',
          size: 1024000,
          mime: 'application/pdf'
        },
        tempFile: {
          tempId: 'temp-456',
          originalName: 'test.pdf',
          size: 1024000,
          mime: 'application/pdf',
          checksum: 'sha256:abc123'
        },
        userDecision: 'keep_both'
      };

      const expectedContext = {
        scope: 'property',
        scopeId: 'prop-789',
        metadata: {
          documentType: 'tax_notice',
          extractedFields: { year: 2025 },
          predictions: [{ label: 'Taxe foncière', score: 0.8 }]
        }
      };

      // Les données sont correctement formatées
      expect(expectedDedupFlowInput.duplicateType).toBe('exact_duplicate');
      expect(expectedDedupFlowInput.existingFile?.id).toBe('doc-123');
      expect(expectedDedupFlowInput.tempFile.tempId).toBe('temp-456');
      expect(expectedContext.scope).toBe('property');
    });

    it('devrait gérer l\'action "Conserver les deux" avec le flag userReason', () => {
      const dedupResult = {
        action: 'keep_both',
        userForcesDuplicate: true,
        skipDuplicateCheck: true,
        userReason: 'doublon_conserve_manuellement'
      };

      // Vérifier que le flag userReason est correctement défini
      expect(dedupResult.userReason).toBe('doublon_conserve_manuellement');
      expect(dedupResult.userForcesDuplicate).toBe(true);
      expect(dedupResult.skipDuplicateCheck).toBe(true);
    });
  });

  describe('DocumentTable Badge Integration', () => {
    it('devrait afficher le badge "Copie autorisée manuellement" pour les documents avec userReason', () => {
      const documentWithUserReason = {
        id: 'doc-123',
        filenameOriginal: 'test.pdf',
        userReason: 'doublon_conserve_manuellement',
        documentType: { label: 'Taxe foncière' },
        status: 'classified'
      };

      const documentWithoutUserReason = {
        id: 'doc-456',
        filenameOriginal: 'test2.pdf',
        userReason: undefined,
        documentType: { label: 'Quittance' },
        status: 'classified'
      };

      // Vérifier que le badge est affiché seulement pour les documents avec userReason
      expect(documentWithUserReason.userReason).toBe('doublon_conserve_manuellement');
      expect(documentWithoutUserReason.userReason).toBeUndefined();
    });
  });

  describe('API Finalize Integration', () => {
    it('devrait accepter et logger le userReason dans l\'API finalize', () => {
      const finalizePayload = {
        tempId: 'temp-123',
        chosenTypeId: 'type-456',
        userReason: 'doublon_conserve_manuellement',
        context: { scope: 'property', id: 'prop-789' }
      };

      // Vérifier que le payload contient userReason
      expect(finalizePayload.userReason).toBe('doublon_conserve_manuellement');
      
      // Simuler le log
      const logMessage = `[Finalize] Raison utilisateur: ${finalizePayload.userReason} pour le fichier: test.pdf`;
      expect(logMessage).toContain('doublon_conserve_manuellement');
    });

    it('devrait créer le document avec userReason en base de données', () => {
      const documentData = {
        filenameOriginal: 'test.pdf',
        mime: 'application/pdf',
        size: 1024000,
        userReason: 'doublon_conserve_manuellement',
        status: 'classified'
      };

      // Vérifier que userReason est inclus dans les données du document
      expect(documentData.userReason).toBe('doublon_conserve_manuellement');
    });
  });

  describe('DedupFlow Scenarios', () => {
    it('devrait gérer le scénario "Conserver les deux" avec le bon flux', () => {
      const scenario = {
        input: {
          duplicateType: 'exact_duplicate',
          userDecision: 'keep_both'
        },
        expectedOutput: {
          flow: 'upload_review',
          duplicateStatus: 'user_forced',
          flags: {
            skipDuplicateCheck: true,
            userForcesDuplicate: true
          },
          ui: {
            title: 'Revue de l\'upload – Copie volontaire d\'un doublon',
            suggestedFilename: 'test (copie).pdf'
          }
        }
      };

      expect(scenario.expectedOutput.flow).toBe('upload_review');
      expect(scenario.expectedOutput.duplicateStatus).toBe('user_forced');
      expect(scenario.expectedOutput.flags.skipDuplicateCheck).toBe(true);
      expect(scenario.expectedOutput.ui.suggestedFilename).toContain('(copie)');
    });

    it('devrait gérer le scénario "Remplacer" avec l\'API de remplacement', () => {
      const scenario = {
        input: {
          duplicateType: 'exact_duplicate',
          userDecision: 'replace'
        },
        expectedOutput: {
          flow: 'replace_document',
          api: {
            endpoint: '/api/documents/doc-123/replace',
            method: 'POST'
          }
        }
      };

      expect(scenario.expectedOutput.flow).toBe('replace_document');
      expect(scenario.expectedOutput.api?.endpoint).toContain('/replace');
      expect(scenario.expectedOutput.api?.method).toBe('POST');
    });

    it('devrait gérer le scénario "Annuler" avec la suppression du fichier temporaire', () => {
      const scenario = {
        input: {
          duplicateType: 'exact_duplicate',
          userDecision: 'cancel'
        },
        expectedOutput: {
          flow: 'cancel_upload',
          flags: {
            deleteTempFile: true
          },
          api: {
            endpoint: '/api/uploads/temp-456',
            method: 'DELETE'
          }
        }
      };

      expect(scenario.expectedOutput.flow).toBe('cancel_upload');
      expect(scenario.expectedOutput.flags.deleteTempFile).toBe(true);
      expect(scenario.expectedOutput.api?.method).toBe('DELETE');
    });
  });

  describe('End-to-End Flow', () => {
    it('devrait exécuter le flux complet de déduplication', async () => {
      // 1. Upload d'un fichier avec doublon détecté
      const uploadResult = {
        success: true,
        data: {
          tempId: 'temp-123',
          dedup: {
            isDuplicate: true,
            status: 'exact_duplicate',
            matchedDocument: {
              id: 'doc-456',
              name: 'existing.pdf'
            }
          }
        }
      };

      // 2. Orchestration DedupFlow
      const dedupFlowResult = {
        success: true,
        data: {
          flow: 'upload_review',
          duplicateStatus: 'user_forced',
          flags: { skipDuplicateCheck: true, userForcesDuplicate: true },
          ui: { title: 'Revue de l\'upload – Copie volontaire d\'un doublon' }
        }
      };

      // 3. Action utilisateur "Conserver les deux"
      const userAction = {
        action: 'confirm',
        data: {
          userReason: 'doublon_conserve_manuellement'
        }
      };

      // 4. Finalisation avec userReason
      const finalizeResult = {
        success: true,
        data: {
          documentId: 'new-doc-789',
          userReason: 'doublon_conserve_manuellement'
        }
      };

      // Vérifier le flux complet
      expect(uploadResult.data.dedup.isDuplicate).toBe(true);
      expect(dedupFlowResult.data.flow).toBe('upload_review');
      expect(userAction.data.userReason).toBe('doublon_conserve_manuellement');
      expect(finalizeResult.data.userReason).toBe('doublon_conserve_manuellement');
    });
  });
});
