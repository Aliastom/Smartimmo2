/**
 * Exemple d'utilisation du module DedupFlow
 * 
 * Montre comment intégrer DedupFlow dans un composant d'upload
 */

import React, { useState } from 'react';
import { DedupFlowModal } from '@/components/DedupFlowModal';
import { useDedupFlow } from '@/hooks/useDedupFlow';
import { DedupFlowInput, DedupFlowContext } from '@/types/dedup-flow';

export function DedupFlowExample() {
  const [showModal, setShowModal] = useState(false);
  const { flowOutput, isProcessing, error, orchestrateFlow, processApiResult, reset } = useDedupFlow();

  // Simulation d'un upload avec doublon détecté
  const handleUploadWithDuplicate = async () => {
    const input: DedupFlowInput = {
      duplicateType: 'exact_duplicate',
      existingFile: {
        id: 'doc-123',
        name: 'Avis_de_taxes_foncieres_2025.pdf',
        uploadedAt: '2024-01-15T10:30:00Z',
        size: 1024000,
        mime: 'application/pdf'
      },
      tempFile: {
        tempId: 'temp-456',
        originalName: 'Avis_de_taxes_foncieres_2025.pdf',
        size: 1024000,
        mime: 'application/pdf',
        checksum: 'sha256:abc123...'
      },
      userDecision: 'keep_both' // Simule le choix de l'utilisateur
    };

    const context: DedupFlowContext = {
      scope: 'property',
      scopeId: 'prop-789',
      metadata: {
        documentType: 'tax_notice',
        extractedFields: {
          year: 2025,
          type: 'taxe_fonciere'
        }
      }
    };

    await orchestrateFlow(input, context);
    setShowModal(true);
  };

  // Gestionnaire d'action de la modale
  const handleModalAction = async (action: 'confirm' | 'replace' | 'cancel', data?: any) => {
    console.log('[DedupFlowExample] Action:', action, data);

    switch (action) {
      case 'confirm':
        // Simuler l'enregistrement du document
        const confirmResult = {
          success: true,
          data: { documentId: 'new-doc-123' }
        };
        await processApiResult(data, confirmResult);
        break;

      case 'replace':
        // Simuler le remplacement du document
        const replaceResult = {
          success: true,
          data: { replacedDocumentId: 'doc-123' }
        };
        await processApiResult(data, replaceResult);
        break;

      case 'cancel':
        // Simuler l'annulation
        const cancelResult = {
          success: true,
          data: { tempFileDeleted: true }
        };
        await processApiResult(data, cancelResult);
        break;
    }

    // Fermer la modale après traitement
    setTimeout(() => {
      setShowModal(false);
      reset();
    }, 2000);
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">Exemple DedupFlow</h2>
      
      <div className="space-y-2">
        <button
          onClick={handleUploadWithDuplicate}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={isProcessing}
        >
          {isProcessing ? 'Traitement...' : 'Simuler upload avec doublon'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">Erreur: {error}</p>
        </div>
      )}

      {flowOutput && (
        <div className="p-4 bg-gray-50 border rounded-lg">
          <h3 className="font-semibold mb-2">Sortie du flux:</h3>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(flowOutput, null, 2)}
          </pre>
        </div>
      )}

      {/* Modale DedupFlow */}
      {flowOutput && (
        <DedupFlowModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            reset();
          }}
          flowOutput={flowOutput}
          onAction={handleModalAction}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
}

// Exemple d'intégration dans un composant d'upload existant
export function UploadWithDedupFlow() {
  const [files, setFiles] = useState<File[]>([]);
  const { flowOutput, orchestrateFlow, reset } = useDedupFlow();

  const handleFileUpload = async (file: File) => {
    // 1. Upload temporaire
    const formData = new FormData();
    formData.append('file', file);
    
    const uploadResponse = await fetch('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });
    
    const uploadResult = await uploadResponse.json();
    
    if (!uploadResult.success) {
      throw new Error('Erreur lors de l\'upload');
    }

    // 2. Si doublon détecté, orchestrer le flux
    if (uploadResult.data.dedup?.isDuplicate) {
      const input: DedupFlowInput = {
        duplicateType: uploadResult.data.dedup.status === 'exact_duplicate' ? 'exact_duplicate' : 'probable_duplicate',
        existingFile: uploadResult.data.dedup.matchedDocument,
        tempFile: {
          tempId: uploadResult.data.tempId,
          originalName: file.name,
          size: file.size,
          mime: file.type,
          checksum: uploadResult.data.sha256
        },
        userDecision: 'keep_both' // Sera mis à jour selon le choix de l'utilisateur
      };

      await orchestrateFlow(input);
    }
  };

  return (
    <div>
      {/* Interface d'upload */}
      <input
        type="file"
        onChange={(e) => {
          if (e.target.files) {
            setFiles(Array.from(e.target.files));
          }
        }}
        multiple
      />
      
      <button
        onClick={() => files.forEach(handleFileUpload)}
        disabled={files.length === 0}
      >
        Uploader les fichiers
      </button>

      {/* Modale DedupFlow */}
      {flowOutput && (
        <DedupFlowModal
          isOpen={!!flowOutput}
          onClose={reset}
          flowOutput={flowOutput}
          onAction={(action, data) => {
            console.log('Action utilisateur:', action, data);
            // Traiter l'action selon le type
          }}
        />
      )}
    </div>
  );
}
