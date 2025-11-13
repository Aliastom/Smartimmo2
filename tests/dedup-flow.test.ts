/**
 * Tests pour le module DedupFlow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DedupFlowService } from '@/services/dedup-flow.service';
import { DedupFlowInput, DedupFlowContext } from '@/types/dedup-flow';

describe('DedupFlowService', () => {
  let service: DedupFlowService;

  beforeEach(() => {
    service = new DedupFlowService();
  });

  describe('orchestrateFlow', () => {
    it('devrait gérer un doublon exact avec décision "cancel"', async () => {
      const input: DedupFlowInput = {
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
        userDecision: 'cancel'
      };

      const result = await service.orchestrateFlow(input);

      expect(result.success).toBe(true);
      expect(result.data?.flow).toBe('cancel_upload');
      expect(result.data?.duplicateStatus).toBe('exact_duplicate');
      expect(result.data?.userDecision).toBe('cancel');
      expect(result.data?.flags.deleteTempFile).toBe(true);
      expect(result.data?.ui.title).toBe('Upload annulé');
      expect(result.nextStep).toBe('call_api');
    });

    it('devrait gérer un doublon exact avec décision "replace"', async () => {
      const input: DedupFlowInput = {
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
        userDecision: 'replace'
      };

      const result = await service.orchestrateFlow(input);

      expect(result.success).toBe(true);
      expect(result.data?.flow).toBe('replace_document');
      expect(result.data?.duplicateStatus).toBe('exact_duplicate');
      expect(result.data?.userDecision).toBe('replace');
      expect(result.data?.flags.replaceExisting).toBe(true);
      expect(result.data?.ui.title).toBe('Remplacement du document');
      expect(result.data?.api?.endpoint).toBe('/api/documents/doc-123/replace');
      expect(result.nextStep).toBe('call_api');
    });

    it('devrait gérer un doublon exact avec décision "keep_both"', async () => {
      const input: DedupFlowInput = {
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

      const result = await service.orchestrateFlow(input);

      expect(result.success).toBe(true);
      expect(result.data?.flow).toBe('upload_review');
      expect(result.data?.duplicateStatus).toBe('user_forced');
      expect(result.data?.userDecision).toBe('keep_both');
      expect(result.data?.flags.skipDuplicateCheck).toBe(true);
      expect(result.data?.flags.userForcesDuplicate).toBe(true);
      expect(result.data?.ui.title).toBe('Revue de l\'upload – Copie volontaire d\'un doublon');
      expect(result.data?.ui.suggestedFilename).toBe('test (copie).pdf');
      expect(result.nextStep).toBe('show_modal');
    });

    it('devrait gérer un fichier sans doublon', async () => {
      const input: DedupFlowInput = {
        duplicateType: 'not_duplicate',
        tempFile: {
          tempId: 'temp-456',
          originalName: 'new-file.pdf',
          size: 1024000,
          mime: 'application/pdf',
          checksum: 'sha256:xyz789'
        },
        userDecision: 'keep_both'
      };

      const result = await service.orchestrateFlow(input);

      expect(result.success).toBe(true);
      expect(result.data?.flow).toBe('upload_review');
      expect(result.data?.duplicateStatus).toBe('not_duplicate');
      expect(result.data?.flags.skipDuplicateCheck).toBe(false);
      expect(result.data?.flags.userForcesDuplicate).toBe(false);
      expect(result.data?.ui.title).toBe('Revue de l\'upload');
      expect(result.nextStep).toBe('show_modal');
    });

    it('devrait échouer avec des données manquantes', async () => {
      const input = {
        duplicateType: 'exact_duplicate',
        // tempFile manquant
        userDecision: 'cancel'
      } as any;

      const result = await service.orchestrateFlow(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Données d\'entrée manquantes');
      expect(result.nextStep).toBe('close');
    });

    it('devrait échouer avec une décision non supportée', async () => {
      const input: DedupFlowInput = {
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
        userDecision: 'invalid_decision' as any
      };

      const result = await service.orchestrateFlow(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Décision utilisateur non supportée');
    });
  });

  describe('processApiResult', () => {
    it('devrait traiter un résultat API réussi', async () => {
      const output = {
        flow: 'replace_document' as const,
        duplicateStatus: 'exact_duplicate' as const,
        userDecision: 'replace' as const,
        flags: {
          skipDuplicateCheck: false,
          userForcesDuplicate: false,
          replaceExisting: true,
          deleteTempFile: false
        },
        ui: {
          title: 'Remplacement du document',
          primaryAction: {
            label: 'Remplacer',
            action: 'replace' as const
          }
        }
      };

      const apiResult = {
        success: true,
        data: { replacedDocumentId: 'doc-123' }
      };

      const result = await service.processApiResult(output, apiResult);

      expect(result.success).toBe(true);
      expect(result.data?.ui.banner?.type).toBe('success');
      expect(result.data?.ui.banner?.text).toBe('Le document existant a été remplacé avec succès.');
      expect(result.nextStep).toBe('close');
    });

    it('devrait traiter un résultat API échoué', async () => {
      const output = {
        flow: 'replace_document' as const,
        duplicateStatus: 'exact_duplicate' as const,
        userDecision: 'replace' as const,
        flags: {
          skipDuplicateCheck: false,
          userForcesDuplicate: false,
          replaceExisting: true,
          deleteTempFile: false
        },
        ui: {
          title: 'Remplacement du document',
          primaryAction: {
            label: 'Remplacer',
            action: 'replace' as const
          }
        }
      };

      const apiResult = {
        success: false,
        error: 'Document non trouvé'
      };

      const result = await service.processApiResult(output, apiResult);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Document non trouvé');
      expect(result.nextStep).toBe('close');
    });
  });

  describe('generateCopyFilename', () => {
    it('devrait générer un nom de fichier avec extension', () => {
      const service = new DedupFlowService();
      // Accès à la méthode privée via reflection pour les tests
      const result = (service as any).generateCopyFilename('document.pdf');
      expect(result).toBe('document (copie).pdf');
    });

    it('devrait générer un nom de fichier sans extension', () => {
      const service = new DedupFlowService();
      const result = (service as any).generateCopyFilename('document');
      expect(result).toBe('document (copie)');
    });

    it('devrait gérer les fichiers avec plusieurs points', () => {
      const service = new DedupFlowService();
      const result = (service as any).generateCopyFilename('document.backup.pdf');
      expect(result).toBe('document.backup (copie).pdf');
    });
  });
});
