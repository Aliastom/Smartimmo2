import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { documentConversionService } from '@/services/DocumentConversionService';
import { DocxTextExtractor } from '@/services/DocxTextExtractor';

/**
 * Normalisation du texte
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Garantit qu'une valeur est une string
 */
const ensureText = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v && typeof (v as any).toString === "function") return (v as any).toString();
  return "";
};

/**
 * POST /api/ocr
 * Extraction de texte depuis PDF ou image
 * Utilise pdf-parse@1.1.1 (CommonJS) + Tesseract.js fallback
 */
export async function POST(req: Request) {
  const runId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    const form = await req.formData();
    const file = form.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Aucun fichier fourni' 
      }, { status: 400 });
    }

    // Charger le buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Test sanity : buffer vide
    if (buffer.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Fichier vide'
      }, { status: 400 });
    }

    // Calculer SHA-256
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    const fileType = file.type?.toLowerCase() || '';
    const fileName = file.name?.toLowerCase() || '';
    
    let processBuffer = buffer;
    let actualFileType = fileType;
    let conversionInfo: { converted: boolean; originalType?: string; conversionTimeMs?: number } = { converted: false };
    
    // ============ EXTRACTION DIRECTE DOCX (AVANT CONVERSION) ============
    // Essayer d'extraire directement le texte depuis DOCX/DOC avec mammoth
    let directExtractionText = '';
    let directExtractionSuccess = false;
    
    if (DocxTextExtractor.isSupportedMimeType(fileType) || DocxTextExtractor.isSupportedFilename(fileName)) {
      console.log('[OCR] Document Word détecté - extraction directe avec mammoth...');
      
      try {
        const extractionStartTime = Date.now();
        directExtractionText = await DocxTextExtractor.extractTextFromBuffer(buffer);
        const extractionDuration = Date.now() - extractionStartTime;
        
        if (directExtractionText && directExtractionText.trim().length > 5) {
          directExtractionSuccess = true;
          console.log(`[OCR] Extraction directe DOCX réussie: ${directExtractionText.length} caractères en ${extractionDuration}ms`);
        } else {
          console.log('[OCR] Extraction directe DOCX: texte trop court, fallback sur conversion PDF');
        }
      } catch (docxError) {
        console.error('[OCR] Erreur extraction directe DOCX:', docxError);
        console.log('[OCR] Fallback sur conversion PDF');
      }
    }
    
    // ============ CONVERSION AUTOMATIQUE (FALLBACK) ============
    // Vérifier si le fichier nécessite une conversion vers PDF
    // Mais seulement si l'extraction directe DOCX a échoué
    if (!directExtractionSuccess && documentConversionService.needsConversion(fileType)) {
      console.log(`[OCR] Conversion nécessaire: ${fileType} → PDF`);
      
      const conversionResult = await documentConversionService.convertToPDF(buffer, fileType, file.name);
      
      if (conversionResult.success && conversionResult.pdfBuffer) {
        processBuffer = conversionResult.pdfBuffer;
        actualFileType = 'application/pdf';
        conversionInfo = {
          converted: true,
          originalType: fileType,
          conversionTimeMs: conversionResult.conversionTimeMs
        };
        console.log(`[OCR] Conversion réussie en ${conversionResult.conversionTimeMs}ms`);
      } else {
        console.error('[OCR] Échec conversion:', conversionResult.error);
        return NextResponse.json({
          ok: false,
          error: 'Erreur lors de la conversion du document',
          details: conversionResult.error || 'Conversion échouée'
        }, { status: 500 });
      }
    }
    
    // Détection type fichier (après conversion potentielle ou extraction directe)
    const isPDF = actualFileType === 'application/pdf' || fileName.endsWith('.pdf') || conversionInfo.converted;
    const isImage = actualFileType.startsWith('image/') || 
                    fileName.endsWith('.jpg') || 
                    fileName.endsWith('.jpeg') || 
                    fileName.endsWith('.png');
    const isDirectDocxSuccess = directExtractionSuccess;

    let raw = '';
    let raw2 = '';
    let source: 'pdf-parse' | 'tesseract' | 'converted-pdf' | 'docx-direct' = conversionInfo.converted ? 'converted-pdf' : 'pdf-parse';
    let pagesOcred: number | undefined;

    if (isDirectDocxSuccess) {
      // ============ TRAITEMENT DOCX DIRECT ============
      console.log('[OCR] Utilisation du texte extrait directement depuis DOCX');
      
      raw = directExtractionText.trim();
      source = 'docx-direct';
      
      console.log(`[OCR] Texte DOCX direct: ${raw.length} caractères`);
      
    } else if (isPDF) {
      // ============ TRAITEMENT PDF ============
      
      try {
        console.log('[OCR] Extraction texte PDF avec pdf-parse...');
        
        // Import dynamique de pdf-parse via son chemin CJS
        const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
        
        // Extraire le texte (utiliser le buffer converti si nécessaire)
        const result = await pdfParse(processBuffer);
        raw = ensureText(result?.text).trim();
        
        console.log(`[OCR] pdf-parse extracted ${raw.length} chars`);
        
        // Si texte < 80 chars → PDF scanné → fallback OCR Tesseract
        if (raw.length < 80) {
          console.log('[OCR] PDF appears scanned (< 80 chars), switching to Tesseract OCR');
          source = 'tesseract';
          
          try {
            const { createWorker } = await import('tesseract.js');
            const worker = await createWorker('fra+eng');
            await worker.setParameters({ preserve_interword_spaces: '1' });
            
            // Pour un PDF scanné, on OCR le buffer directement
            // (Tesseract peut gérer les PDF multi-pages)
            const { data: ocrData } = await worker.recognize(processBuffer);
            raw2 = ensureText(ocrData?.text).trim();
            
            await worker.terminate();
            
            console.log(`[OCR] Tesseract extracted ${raw2.length} chars from PDF`);
            
          } catch (tesseractError) {
            console.error('[OCR] Erreur Tesseract fallback:', tesseractError);
            // Continuer avec le texte de pdf-parse même s'il est court
            raw2 = '';
          }
        }
        
      } catch (pdfError) {
        console.error('[OCR] Erreur pdf-parse:', pdfError);
        return NextResponse.json({
          ok: false,
          error: 'Erreur lors de l\'extraction du PDF',
          details: pdfError instanceof Error ? pdfError.message : 'Erreur PDF'
        }, { status: 500 });
      }

    } else if (isImage) {
      // ============ TRAITEMENT IMAGE AVEC OCR.SPACE API (GRATUIT, SANS CARTE BANCAIRE) ============
      console.log('[OCR] Image détectée - Utilisation de OCR.space API (gratuit)');
      
      try {
        // Convertir le buffer en base64 pour l'API
        const imageContent = buffer.toString('base64');
        
        // Optionnel : clé API OCR.space (gratuit sans clé, mais limité à 25k/jour avec clé)
        const ocrSpaceApiKey = process.env.OCR_SPACE_API_KEY || 'helloworld'; // 'helloworld' = clé par défaut gratuite
        
        console.log('[OCR] Appel OCR.space API pour l\'image...');
        console.log('[OCR] Taille de l\'image:', buffer.length, 'bytes');
        
        // Appel à l'API REST OCR.space (gratuit, 25 000 requêtes/jour)
        const ocrSpaceResponse = await fetch(
          'https://api.ocr.space/parse/image',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              base64Image: `data:${actualFileType};base64,${imageContent}`,
              apikey: ocrSpaceApiKey,
              language: 'fre', // Français
              isOverlayRequired: 'false',
              detectOrientation: 'true',
              scale: 'true',
            }),
          }
        );

        console.log('[OCR] Réponse OCR.space API status:', ocrSpaceResponse.status);

        if (!ocrSpaceResponse.ok) {
          const errorData = await ocrSpaceResponse.json().catch(() => ({}));
          console.error('[OCR] Erreur OCR.space API:', errorData);
          throw new Error(
            `OCR.space API error: ${ocrSpaceResponse.status} ${ocrSpaceResponse.statusText}. ${JSON.stringify(errorData)}`
          );
        }

        const ocrSpaceResult = await ocrSpaceResponse.json();
        console.log('[OCR] Résultat OCR.space API:', JSON.stringify(ocrSpaceResult).substring(0, 500));
        
        // Vérifier si l'OCR a réussi
        if (ocrSpaceResult.OCRExitCode === 1 && ocrSpaceResult.ParsedResults && ocrSpaceResult.ParsedResults.length > 0) {
          // Le texte extrait est dans ParsedText
          raw = ocrSpaceResult.ParsedResults[0].ParsedText || '';
          console.log(`[OCR] OCR.space extrait ${raw.length} caractères`);
          console.log('[OCR] Extrait (premiers 200 caractères):', raw.substring(0, 200));
        } else {
          // Aucun texte détecté ou erreur
          console.log('[OCR] Aucun texte détecté dans l\'image (ExitCode:', ocrSpaceResult.OCRExitCode, ')');
          raw = '';
        }

        source = 'tesseract'; // Garder le même nom de source pour compatibilité
        pagesOcred = 1; // Une image = une page
        
      } catch (ocrError: any) {
        console.error('[OCR] Erreur OCR.space:', ocrError);
        return NextResponse.json({
          ok: false,
          error: 'Erreur lors de l\'OCR de l\'image',
          details: ocrError.message || 'Erreur inconnue lors de l\'appel à OCR.space API'
        }, { status: 500 });
      }
      
    } else {
      // Cas des formats non supportés (ni PDF, ni image, ni convertible)
      const supportedFormats = documentConversionService.getSupportedFormats();
      const supportedTypes = supportedFormats.map(f => f.extension).join(', ');
      
      return NextResponse.json({
        ok: false,
        error: 'Type de fichier non supporté',
        details: `Type: ${fileType || 'inconnu'}, Nom: ${fileName}. Types supportés: PDF, images (JPG/PNG), documents Office (${supportedTypes})`
      }, { status: 400 });
    }

    // 4) Sécurité contre les crashs - garantir que base est une string
    const base = typeof raw === 'string' && raw ? raw : (raw2 || '');
    
    // Normalisation
    const normalized = normalizeText(base);

    // Test sanity : texte trop court
    if (normalized.length < 5) {
      console.warn(`[OCR] bytes:${buffer.length} sha256:${sha256} source:${source} length:${normalized.length} - NO TEXT EXTRACTED`);
      return NextResponse.json({
        ok: false,
        error: 'no_text_extracted',
        details: 'Aucun texte exploitable n\'a pu être extrait du document'
      }, { status: 422 });
    }

    // Preview : premiers 300 caractères du texte brut
    const preview = base.slice(0, 300);
    const duration = Date.now() - startTime;

    // Logs serveur
    console.log(`[OCR] source:${source} length:${normalized.length} bytes:${buffer.length} sha256:${sha256} duration:${duration}ms`);

    // 3) Réponse JSON conforme
    return NextResponse.json({
      ok: true,
      runId,
      configVersion: 'v1',
      source,
      length: normalized.length,
      preview,
      text: normalized,
      meta: {
        source,
        sha256,
        ...(pagesOcred !== undefined && { pagesOcred }),
        duration,
        // Informations de conversion
        ...(conversionInfo.converted && {
          converted: true,
          originalType: conversionInfo.originalType,
          convertedToPdf: true,
          conversionTimeMs: conversionInfo.conversionTimeMs
        })
      }
    });

  } catch (err: any) {
    console.error('[OCR] Fatal:', err);
    return NextResponse.json({ 
      ok: false, 
      runId, 
      error: String(err?.message || err),
      details: err?.stack || 'Erreur inconnue'
    }, { status: 500 });
  }
}
