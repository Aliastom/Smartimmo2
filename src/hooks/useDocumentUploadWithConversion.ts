import { useState, useCallback } from 'react';
import { useDocumentUpload, type UploadProgress } from './useDocumentUpload';
import type { ConversionFile } from '@/components/documents/ConversionWarningModal';
import type { ConversionProgress } from '@/components/documents/ConversionLoader';

interface UseDocumentUploadWithConversionOptions {
  propertyId?: string;
  leaseId?: string;
  tenantId?: string;
  transactionId?: string;
  loanId?: string;
  tags?: string[];
  onSuccess?: (documentIds: string[]) => void;
  onError?: (error: string) => void;
  onConversionStart?: (files: ConversionFile[]) => void;
  onConversionProgress?: (progress: ConversionProgress) => void;
  onConversionComplete?: () => void;
}

// Formats nécessitant une conversion (synchrone avec le service)
const CONVERSION_FORMATS = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc', 
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.oasis.opendocument.presentation': 'odp',
  'text/plain': 'txt',
  'application/rtf': 'rtf'
};

export function useDocumentUploadWithConversion(options: UseDocumentUploadWithConversionOptions = {}) {
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [conversionFiles, setConversionFiles] = useState<ConversionFile[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showConversionLoader, setShowConversionLoader] = useState(false);
  const [conversionProgress, setConversionProgress] = useState<ConversionProgress>({
    fileIndex: 0,
    fileName: '',
    totalFiles: 0,
    currentStep: '',
    steps: [],
    overallProgress: 0
  });

  // Hook d'upload original
  const originalUpload = useDocumentUpload({
    ...options,
    onSuccess: (documentIds) => {
      // Masquer le loader de conversion si actif
      setShowConversionLoader(false);
      options.onConversionComplete?.();
      options.onSuccess?.(documentIds);
    },
    onError: (error) => {
      setShowConversionLoader(false);
      options.onError?.(error);
    }
  });

  /**
   * Vérifie si un fichier nécessite une conversion
   */
  const needsConversion = useCallback((file: File): boolean => {
    return file.type in CONVERSION_FORMATS;
  }, []);

  /**
   * Analyse les fichiers et détermine lesquels nécessitent une conversion
   */
  const analyzeFiles = useCallback((files: File[]): { 
    needsConversion: ConversionFile[], 
    ready: File[] 
  } => {
    const needsConversionFiles: ConversionFile[] = [];
    const readyFiles: File[] = [];

    files.forEach(file => {
      if (needsConversion(file)) {
        needsConversionFiles.push({
          name: file.name,
          type: file.type,
          size: file.size,
          extension: CONVERSION_FORMATS[file.type as keyof typeof CONVERSION_FORMATS] || 'unknown'
        });
      } else {
        readyFiles.push(file);
      }
    });

    return { needsConversion: needsConversionFiles, ready: readyFiles };
  }, [needsConversion]);

  /**
   * Simule le progress de conversion (sera remplacé par le vrai monitoring)
   */
  const simulateConversionProgress = useCallback((files: File[]) => {
    files.forEach((file, fileIndex) => {
      const steps = [
        { id: 'validation', label: 'Validation du fichier', status: 'completed' as const },
        { id: 'conversion', label: 'Conversion en PDF', status: 'active' as const },
        { id: 'ocr', label: 'Extraction du texte', status: 'pending' as const },
        { id: 'classification', label: 'Classification automatique', status: 'pending' as const },
        { id: 'complete', label: 'Finalisation', status: 'pending' as const }
      ];

      let currentStep = 0;
      const progressInterval = setInterval(() => {
        if (currentStep < steps.length) {
          const updatedSteps = steps.map((step, index) => {
            if (index < currentStep) return { ...step, status: 'completed' as const };
            if (index === currentStep) return { ...step, status: 'active' as const };
            return { ...step, status: 'pending' as const };
          });

          const overallProgress = ((fileIndex / files.length) + (currentStep / (steps.length * files.length))) * 100;

          setConversionProgress({
            fileIndex,
            fileName: file.name,
            totalFiles: files.length,
            currentStep: steps[currentStep]?.label || '',
            steps: updatedSteps,
            overallProgress: Math.min(overallProgress, 95) // Cap à 95% jusqu'à la fin
          });

          options.onConversionProgress?.({
            fileIndex,
            fileName: file.name,
            totalFiles: files.length,
            currentStep: steps[currentStep]?.label || '',
            steps: updatedSteps,
            overallProgress: Math.min(overallProgress, 95)
          });

          currentStep++;
        } else {
          clearInterval(progressInterval);
          if (fileIndex === files.length - 1) {
            // Dernier fichier, finaliser
            setConversionProgress(prev => ({ ...prev, overallProgress: 100 }));
            setTimeout(() => {
              setShowConversionLoader(false);
            }, 1000);
          }
        }
      }, 800); // Plus réaliste pour la conversion
    });
  }, [options]);

  /**
   * Upload avec gestion automatique de la conversion
   */
  const uploadWithConversion = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    const analysis = analyzeFiles(files);

    // Si des fichiers nécessitent une conversion, afficher la modal
    if (analysis.needsConversion.length > 0) {
      setConversionFiles(analysis.needsConversion);
      setPendingFiles(files);
      setShowConversionModal(true);
      return;
    }

    // Sinon, upload direct
    await originalUpload.upload(files);
  }, [analyzeFiles, originalUpload]);

  /**
   * Confirme la conversion et lance l'upload
   */
  const confirmConversion = useCallback(async () => {
    setShowConversionModal(false);
    setShowConversionLoader(true);
    
    options.onConversionStart?.(conversionFiles);
    
    // Simuler le progress de conversion
    simulateConversionProgress(pendingFiles);
    
    // L'upload réel se fera via l'API OCR modifiée qui gère la conversion
    await originalUpload.upload(pendingFiles);
  }, [conversionFiles, pendingFiles, originalUpload, options, simulateConversionProgress]);

  /**
   * Annule l'upload avec conversion
   */
  const cancelConversion = useCallback(() => {
    setShowConversionModal(false);
    setConversionFiles([]);
    setPendingFiles([]);
  }, []);

  /**
   * Reset complet incluant les états de conversion
   */
  const reset = useCallback(() => {
    originalUpload.reset();
    setShowConversionModal(false);
    setShowConversionLoader(false);
    setConversionFiles([]);
    setPendingFiles([]);
    setConversionProgress({
      fileIndex: 0,
      fileName: '',
      totalFiles: 0,
      currentStep: '',
      steps: [],
      overallProgress: 0
    });
  }, [originalUpload]);

  return {
    // États originaux
    uploads: originalUpload.uploads,
    isUploading: originalUpload.isUploading,
    
    // Nouveaux états pour la conversion
    showConversionModal,
    conversionFiles,
    showConversionLoader,
    conversionProgress,
    
    // Actions
    upload: uploadWithConversion,
    confirmConversion,
    cancelConversion,
    reset,
    
    // Utilitaires
    needsConversion,
    analyzeFiles
  };
}

