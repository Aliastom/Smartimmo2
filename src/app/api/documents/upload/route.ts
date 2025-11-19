import { NextRequest, NextResponse } from 'next/server';
import { classificationService } from '@/services/ClassificationService';
import { DocumentRecognitionService } from '@/services/DocumentRecognitionService';
import { sha256Hex } from '@/lib/hash';
import { cleanupExpiredTemps, generateTempId } from '@/lib/cleanupTemp';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { dedupAI } from '@/services/dedup-ai.service';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { getStorageService } from '@/services/storage.service';

const documentRecognitionService = new DocumentRecognitionService();



/**
 * Utilitaire pour garantir qu'une valeur est une string
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

const ensureText = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v && typeof (v as any).toString === "function") return (v as any).toString();
  return "";
};

/**
 * POST /api/documents/upload
 * Upload temporaire avec stockage sur disque + meta.json
 */
export async function POST(request: NextRequest) {
  try {
    // Nettoyage des fichiers temporaires expirÃ©s
    cleanupExpiredTemps().catch(console.error);

    const user = await requireAuth();
    const organizationId = user.organizationId;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const scope = (formData.get('scope') as string) || 'global';
    const scopeId = formData.get('scopeId') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Aucun fichier fourni' },
        { status: 400 }
      );
    }

    if (scope !== 'global' && scopeId) {
      let scopeEntityExists: { id: string } | null = null;
      switch (scope) {
        case 'property':
          scopeEntityExists = await prisma.property.findFirst({
            where: { id: scopeId, organizationId },
            select: { id: true },
          });
          break;
        case 'lease':
          scopeEntityExists = await prisma.lease.findFirst({
            where: { id: scopeId, organizationId },
            select: { id: true },
          });
          break;
        case 'tenant':
          scopeEntityExists = await prisma.tenant.findFirst({
            where: { id: scopeId, organizationId },
            select: { id: true },
          });
          break;
        case 'transaction':
          scopeEntityExists = await prisma.transaction.findFirst({
            where: { id: scopeId, organizationId },
            select: { id: true },
          });
          break;
        case 'loan':
          scopeEntityExists = await prisma.loan.findFirst({
            where: { id: scopeId, organizationId },
            select: { id: true },
          });
          break;
        default:
          break;
      }

      if (!scopeEntityExists) {
        return NextResponse.json(
          { success: false, error: 'Entité liée introuvable ou non autorisée' },
          { status: 404 }
        );
      }
    }

    // VÃ©rifier la taille (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: `Fichier trop volumineux (max 50MB). Taille: ${(file.size / 1024 / 1024).toFixed(1)}MB` },
        { status: 400 }
      );
    }

    // Lire le fichier en buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Calculer le hash SHA-256
    const sha256 = sha256Hex(buffer);

    // GÃ©nÃ©rer tempId et extension
    const tempId = generateTempId();
    const ext = file.name.split('.').pop() || 'bin';
    const tempFileName = `${tempId}.${ext}`;
    
    // Stocker le fichier temporaire (local ou Supabase selon STORAGE_TYPE)
    const storageService = getStorageService();
    const tempKey = `tmp/${tempId}.${ext}`;
    let tempFilePath: string;
    
    // Sur Vercel avec Supabase, stocker dans Supabase Storage
    // Sinon, stocker en local dans /tmp
    if (process.env.STORAGE_TYPE === 'supabase') {
      try {
        // Upload vers Supabase Storage avec préfixe tmp/
        await storageService.uploadWithKey(buffer, tempKey, file.type || 'application/octet-stream');
        tempFilePath = tempKey; // Utiliser la clé comme chemin pour Supabase
        console.log('[Upload] Fichier temporaire stocké dans Supabase Storage:', tempKey);
      } catch (uploadError: any) {
        console.error('[Upload] Erreur upload vers Supabase Storage:', uploadError);
        throw new Error(`Échec de l'upload vers Supabase: ${uploadError.message || 'Erreur inconnue'}`);
      }
    } else {
      // Stockage local
      const tempDir = join(tmpdir(), 'smartimmo', 'uploads');
      await mkdir(tempDir, { recursive: true });
      tempFilePath = join(tempDir, tempFileName);
      await writeFile(tempFilePath, buffer);
      console.log('[Upload] Fichier temporaire stocké en local:', tempFilePath);
    }
    
    // Sauvegarder les métadonnées (toujours en local dans /tmp pour Supabase aussi)
    const tempDir = join(tmpdir(), 'smartimmo', 'uploads');
    await mkdir(tempDir, { recursive: true });
    const metaFilePath = join(tempDir, `${tempId}.meta.json`);

    // Continuer l'analyse (l'agent Dedup gÃ¨re la dÃ©tection de doublons)
    let rawText = '';
    let extractionSource: 'pdf-parse' | 'tesseract' | 'pdf-ocr' = 'pdf-parse';
    
    try {
      // Appel OCR
      const ocrFormData = new FormData();
      ocrFormData.append('file', file);
      
      const ocrResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ocr`, {
        method: 'POST',
        body: ocrFormData,
      });

      if (ocrResponse.ok) {
        const ocrResult = await ocrResponse.json();
        if (ocrResult.ok) {
          rawText = ensureText(ocrResult?.text);
          extractionSource = ocrResult.meta?.source || 'pdf-parse';
        }
      }
    } catch (ocrError) {
      console.error('[Upload] Erreur extraction OCR:', ocrError);
    }

    if (!rawText) {
      console.warn('[Upload] OCR vide ou non exploitable pour', file.name);
    }

    // Classification
    let predictions: Array<{typeCode: string, label: string, score: number, threshold: number}> = [];
    let autoAssigned = false;
    let assignedTypeCode: string | null = null;

    // Classification : essayer d'abord avec le texte, puis fallback sur le nom de fichier
    if (rawText && rawText.trim().length > 0) {
      console.log('[Upload] Classification du texte extrait:', rawText.length, 'caractÃ¨res');
      
      // Utiliser la classification complÃ¨te pour rÃ©cupÃ©rer les seuils configurÃ©s
      const classificationResult = await classificationService.classify(rawText, {
        name: file.name,
        size: file.size,
        ocrStatus: 'unknown'
      });
      
      predictions = Array.isArray(classificationResult.classification.top3) 
        ? classificationResult.classification.top3.map(r => ({
            typeCode: r.typeCode,
            label: r.typeLabel,
            score: r.normalizedScore,
            threshold: r.threshold
          }))
        : [];

      // Auto-assigner selon le seuil configurÃ© pour le meilleur type
      if (classificationResult.classification.autoAssigned && classificationResult.classification.top3.length > 0) {
        autoAssigned = true;
        assignedTypeCode = classificationResult.classification.top3[0].typeCode;
      }
    } else {
      // Fallback : analyse par nom de fichier pour les images sans OCR
      console.log('[Upload] Pas de texte extrait - tentative d\'analyse par nom de fichier pour', file.name);
      try {
        const filenameResult = await documentRecognitionService.analyzeByFilename(file.name);
        if (filenameResult.success && filenameResult.predictions && filenameResult.predictions.length > 0) {
          predictions = filenameResult.predictions.map(pred => ({
            typeCode: pred.typeCode,
            label: pred.label,
            score: pred.score,
            threshold: pred.threshold
          }));
          console.log('[Upload] Prédictions générées par nom de fichier:', predictions.length);
          
          // Auto-assigner si la meilleure prédiction dépasse son seuil
          if (predictions.length > 0 && predictions[0].score >= predictions[0].threshold) {
            autoAssigned = true;
            assignedTypeCode = predictions[0].typeCode;
          }
        }
      } catch (error) {
        console.error('[Upload] Erreur lors de l\'analyse par nom de fichier:', error);
      }
    }

    // Extraire un aperÃ§u du texte
    const textPreview = rawText ? rawText.slice(0, 500) : '';
    const textSnippet = rawText && rawText.length > 200
      ? rawText.substring(0, 200) + '...'
      : rawText || '';

    // Tentative d'extraction de champs (seulement si on a du texte)
    const extractedFields = rawText ? extractFields(rawText) : {};

    // === AGENT DEDUP - DÃ©tection intelligente de doublons ===
    let dedupResult = null;
    console.log('[Upload] DÃ©but de l\'analyse DedupAI...');
    console.log('[Upload] SHA256 calculÃ©:', sha256);
    console.log('[Upload] Texte OCR extrait:', rawText.length, 'caractÃ¨res');
    try {
      // Chercher les candidats potentiels en base
      // On ne filtre PAS par type ou contexte pour dÃ©tecter tous les doublons possibles
      // MAIS on exclut les documents brouillons (draft) qui ne sont pas de vrais doublons
      const candidates = await prisma.document.findMany({
        where: {
          organizationId,
          deletedAt: null,
          status: {
            not: 'draft' // Exclure les documents brouillons
          },
          uploadSessionId: null, // Exclure les documents temporaires (staging)
          // On pourrait rechercher par checksum pour les doublons exacts
          // mais DedupAI le fera automatiquement
        },
        select: {
          id: true,
          filenameOriginal: true,
          createdAt: true,
          mime: true,
          size: true,
          fileSha256: true,
          DocumentType: {
            select: {
              code: true,
              label: true
            }
          },
          // RÃ©cupÃ©rer le texte OCR pour comparaison
          extractedText: true
        },
        take: 50, // Limiter Ã  50 candidats pour une meilleure dÃ©tection
        orderBy: {
          createdAt: 'desc'
        }
      });

      console.log('[Upload] Candidats trouvÃ©s en base:', candidates.length);

      // PrÃ©parer les candidats pour l'agent Dedup
      const dedupCandidates = candidates.map(doc => ({
        id: doc.id,
        name: doc.filenameOriginal,
        uploadedAt: doc.createdAt.toISOString(),
        mime: doc.mime,
        size: doc.size,
        pages: 1, // TODO: RÃ©cupÃ©rer le nombre de pages depuis les mÃ©tadonnÃ©es
        checksum: doc.fileSha256 ? `sha256:${doc.fileSha256}` : '',
        ocr: {
          quality: 0.8, // TODO: RÃ©cupÃ©rer la qualitÃ© OCR depuis les mÃ©tadonnÃ©es
          textPreview: doc.extractedText?.slice(0, 500) || ''
        },
        extracted: {
          type: doc.DocumentType?.label || 'Type inconnu',
          // TODO: Extraire la pÃ©riode depuis les champs du document
        },
        context: {
          propertyId: scope === 'property' ? scopeId : undefined,
          leaseId: scope === 'lease' ? scopeId : undefined,
          tenantId: scope === 'tenant' ? scopeId : undefined,
        },
        url: `/documents/${doc.id}/preview`
      }));

      // Analyser avec DedupAI
      const tempFile = {
        id: tempId,
        name: file.name,
        bytes: file.size,
        size_kb: Math.round(file.size / 1024),
        pages: 1, // TODO: Calculer le nombre de pages
        ocr_text: rawText,
        ocr_quality: 0.8, // TODO: Calculer la qualitÃ© OCR
        detected_type: assignedTypeCode || 'autre',
        period: extractedFields.period ? extractedFields.period.from : undefined,
        context: {
          propertyId: scope === 'property' ? scopeId : undefined,
          leaseId: scope === 'lease' ? scopeId : undefined,
          tenantId: scope === 'tenant' ? scopeId : undefined,
        },
        checksum: `sha256:${sha256}`
      };

      const existingCandidates = candidates.map(doc => ({
        id: doc.id,
        name: doc.filenameOriginal,
        uploadedAt: doc.createdAt.toISOString(),
        size_kb: Math.round(doc.size / 1024),
        pages: 1, // TODO: RÃ©cupÃ©rer le nombre de pages depuis les mÃ©tadonnÃ©es
        ocr_text: doc.extractedText || '',
        ocr_quality: 0.8, // TODO: RÃ©cupÃ©rer la qualitÃ© OCR depuis les mÃ©tadonnÃ©es
        type: doc.DocumentType?.label || 'Type inconnu',
        period: undefined, // TODO: Extraire la pÃ©riode depuis les champs du document
        context: {
          propertyId: scope === 'property' ? scopeId : undefined,
          leaseId: scope === 'lease' ? scopeId : undefined,
          tenantId: scope === 'tenant' ? scopeId : undefined,
        },
        checksum: doc.fileSha256 ? `sha256:${doc.fileSha256}` : ''
      }));

      console.log('[Upload] DedupAI input:', {
        tempFileName: tempFile.name,
        tempChecksum: tempFile.checksum,
        candidatesCount: existingCandidates.length,
        candidates: existingCandidates.map(c => ({
          name: c.name,
          checksum: c.checksum,
          ocrLength: c.ocr_text.length
        }))
      });

      dedupResult = dedupAI.analyze(tempFile, existingCandidates);

      console.log('[Upload] DedupAI result:', {
        duplicateType: dedupResult.duplicateType,
        suggestedAction: dedupResult.suggestedAction,
        matchedDocument: dedupResult.matchedDocument?.name,
        textSimilarity: dedupResult.signals?.text_similarity ? Math.round(dedupResult.signals.text_similarity * 100) + '%' : '0%',
        checksumMatch: dedupResult.signals?.checksum_match || false
      });

    } catch (dedupError) {
      console.error('[Upload] Erreur Agent Dedup:', dedupError);
      console.error('[Upload] Stack trace:', dedupError.stack);
      // En cas d'erreur, continuer sans dÃ©duplication
    }

    // Ã‰crire le fichier meta.json
    const meta = {
      tempId,
      originalName: file.name,
      size: file.size,
      mime: file.type || 'application/octet-stream',
      ext,
      filePath: tempFilePath,
      createdAt: Date.now(),
      expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes
      sha256,
      scope,
      scopeId,
      organizationId,
      isDuplicate: dedupResult ? dedupResult.duplicateType !== 'none' : false,
      dedupResult: dedupResult || null,
      // Ajouter le texte OCR complet pour la finalisation
      extractedText: rawText, // Texte complet pour la finalisation
      extractionSource: extractionSource,
      predictions: predictions,
      autoAssigned: autoAssigned,
      assignedTypeCode: assignedTypeCode,
    };
    await writeFile(metaFilePath, JSON.stringify(meta, null, 2));

    // RÃ©ponse JSON avec rÃ©sultats de l'agent Dedup
    return NextResponse.json({
      success: true,
      data: {
        tempId,
        filename: file.name,
        sha256,
        mime: file.type || "application/octet-stream",
        size: file.size,
        textPreview,
        textLength: rawText.length,
        predictions,
        autoAssigned,
        assignedTypeCode,
        // RÃ©sultats de DedupAI
        dedupResult: dedupResult ? {
          duplicateType: dedupResult.duplicateType,
          suggestedAction: dedupResult.suggestedAction,
          matchedDocument: dedupResult.matchedDocument,
          signals: dedupResult.signals,
          ui: dedupResult.ui,
          isDuplicate: dedupResult.duplicateType !== 'none'
        } : {
          duplicateType: 'none',
          suggestedAction: 'proceed',
          isDuplicate: false
        },
        // CompatibilitÃ© avec l'ancien systÃ¨me
        duplicate: {
          isDuplicate: dedupResult ? dedupResult.duplicateType !== 'none' : false,
          ...(dedupResult?.matchedDocument ? {
            ofDocumentId: dedupResult.matchedDocument.id,
            documentName: dedupResult.matchedDocument.name,
            documentType: 'Type dÃ©tectÃ©',
            uploadedAt: new Date().toISOString(),
            reason: dedupResult.duplicateType === 'exact_duplicate' ? 'same_hash' : 'similar_content'
          } : {})
        },
        extractedPreview: {
          textSnippet,
          textLength: rawText.length,
          source: extractionSource,
          fields: extractedFields,
        }
      }
    });

  } catch (error) {
    console.error('[Upload] Erreur:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors du traitement du fichier',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}

/**
 * Fonction d'extraction de champs simples
 */
function extractFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const normalized = text.normalize('NFKC').toLowerCase();
  
  // Montants
  const amountPattern = /(\d[\d\s\u00A0.,]{2,})\s*â‚¬/g;
  const amounts = [...normalized.matchAll(amountPattern)];
  if (amounts.length > 0) {
    fields.amount_paid = amounts[0][1].replace(/\s/g, ' ').trim() + ' â‚¬';
  }
  
  // Dates
  const datePattern = /\b(\d{1,2})[\/\-.](\ d{1,2})[\/\-.](\d{2,4})\b/g;
  const dates = [...normalized.matchAll(datePattern)];
  if (dates.length > 0) {
    fields.date = dates[0][0];
  }
  
  // Mois/AnnÃ©e
  const monthPattern = /(janvier|fÃ©vrier|mars|avril|mai|juin|juillet|aoÃ»t|septembre|octobre|novembre|dÃ©cembre)\s*(\d{4})/i;
  const monthMatch = text.match(monthPattern);
  if (monthMatch) {
    fields.period_month = monthMatch[1];
    fields.period_year = monthMatch[2];
  }
  
  // AnnÃ©e seule
  const yearPattern = /\b(20\d{2})\b/;
  const yearMatch = text.match(yearPattern);
  if (yearMatch && !fields.period_year) {
    fields.period_year = yearMatch[1];
  }
  
  return fields;
}
