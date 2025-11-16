import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { documentRecognitionService } from '@/services/DocumentRecognitionService';
import { requireAuth } from '@/lib/auth/getCurrentUser';

/**
 * Fonction pour obtenir de vraies prédictions via le service unifié
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

async function getRealPredictions(document: any) {
  try {
    console.log('[API] Génération des prédictions pour le document:', document.id);

    // 1. Essayer d'abord l'analyse complète (OCR + Classification)
    if (document.extractedText) {
      console.log('[API] Analyse complète avec texte existant');
      const result = await documentRecognitionService.analyzeExistingDocument({
        id: document.id,
        fileName: document.fileName,
        textContent: document.extractedText
      });

      if (result.success && result.predictions?.length) {
        console.log('[API] Prédictions générées via analyse complète:', result.predictions.length);
        return result.predictions.map(pred => ({
          label: pred.label,
          score: pred.score,
          typeId: pred.typeId,
          typeCode: pred.typeCode
        }));
      }
    }

    // 2. Fallback vers l'analyse par nom de fichier
    console.log('[API] Fallback vers analyse par nom de fichier');
    const result = await documentRecognitionService.analyzeByFilename(document.fileName);

    if (result.success && result.predictions?.length) {
      console.log('[API] Prédictions générées via nom de fichier:', result.predictions.length);
      return result.predictions.map(pred => ({
        label: pred.label,
        score: pred.score,
        typeId: pred.typeId,
        typeCode: pred.typeCode
      }));
    }

    // 3. Dernier fallback
    console.log('[API] Utilisation du fallback de base');
    return [
      { label: 'Document général', score: 0.3, typeId: null, typeCode: null }
    ];
    
  } catch (error) {
    console.error('[API] Erreur lors de la génération des prédictions:', error);
    return [
      { label: 'Document général', score: 0.3, typeId: null, typeCode: null }
    ];
  }
}

/**
 * GET /api/uploads/staged/[id] - Récupérer un document brouillon
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    
    console.log('[API] Récupération du document brouillon:', params.id);
    
    // D'abord, récupérer le document sans filtre sur le status
    const document = await prisma.document.findFirst({
      where: { 
        id: params.id,
        organizationId
      },
      select: {
        id: true,
        fileName: true,
        filenameOriginal: true,
        url: true,
        documentTypeId: true,
        mime: true,
        size: true,
        status: true,
        uploadedAt: true,
        extractedText: true, // Inclure le texte extrait par OCR
        uploadSessionId: true,
        intendedContextType: true,
        intendedContextTempKey: true,
        createdAt: true,
        updatedAt: true,
        DocumentType: {
          select: {
            id: true,
            label: true,
            code: true
          }
        }
      }
    });

    console.log('[API] Document trouvé:', document ? {
      id: document.id,
      status: document.status,
      fileName: document.fileName,
      uploadSessionId: document.uploadSessionId
    } : 'null');

    if (!document) {
      console.log('[API] Document non trouvé');
      return NextResponse.json(
        { error: 'Document non trouvé' },
        { status: 404 }
      );
    }

    // Vérifier que c'est bien un document en staging
    if (document.status !== 'draft' || !document.uploadSessionId) {
      console.log('[API] Document pas en mode draft:', {
        status: document.status,
        uploadSessionId: document.uploadSessionId
      });
      return NextResponse.json(
        { error: 'Ce document n\'est pas en mode brouillon' },
        { status: 400 }
      );
    }

    // Transformation des données pour le frontend
    const draftDocument = {
      id: document.id,
      name: document.fileName,
      originalName: document.filenameOriginal,
      status: document.status,
      typeId: document.documentTypeId,
      type: document.DocumentType ? {
        id: document.DocumentType.id,
        label: document.DocumentType.label,
        code: document.DocumentType.code
      } : null,
      size: document.size,
      mime: document.mime,
      url: document.url,
      extractedText: document.extractedText, // Inclure le texte OCR pour les suggestions
      // Prédictions avec le vrai processus de reconnaissance
      predictions: await getRealPredictions(document),
      // Champs extraits simulés
      fieldsExtracted: {
        amount: null,
        date: null,
        reference: null,
        // metaFields n'est plus disponible dans la sélection actuelle
      },
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      intendedContext: {
        type: document.intendedContextType,
        tempKey: document.intendedContextTempKey
      }
    };

    return NextResponse.json(draftDocument);

  } catch (error) {
    console.error('Erreur lors de la récupération du document brouillon:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du document brouillon' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/uploads/staged/[id] - Modifier un document brouillon
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    
    const body = await request.json();
    const { name, typeId, fields } = body;

    // Vérifier que le document existe et est en mode draft
    const existingDocument = await prisma.document.findFirst({
      where: { 
        id: params.id,
        status: 'draft',
        organizationId
      }
    });

    if (!existingDocument) {
      return NextResponse.json(
        { error: 'Document brouillon non trouvé' },
        { status: 404 }
      );
    }

    // Vérifier que le type de document existe si fourni
    let validTypeId = null;
    if (typeId) {
      const documentType = await prisma.documentType.findUnique({
        where: { code: typeId } // Chercher par code car le frontend envoie le code
      });
      if (documentType) {
        validTypeId = typeId; // On garde le code pour la connexion
      }
      console.log('[API] Vérification du type de document:', { typeId, found: !!documentType });
    }

    console.log('[API] Mise à jour du document:', {
      id: params.id,
      name: name || existingDocument.fileName,
      validTypeId,
      originalTypeId: existingDocument.documentTypeId
    });

    // Mettre à jour le document
    const updatedDocument = await prisma.document.update({
      where: { id: params.id },
      data: {
        fileName: name || existingDocument.fileName,
        DocumentType: validTypeId ? {
          connect: { code: validTypeId }
        } : {
          disconnect: true
        },
        // Note: Le champ metaFields n'existe peut-être pas dans le modèle Document
        // On peut l'ignorer pour l'instant ou utiliser un autre champ
        updatedAt: new Date()
      },
      include: {
        DocumentType: {
          select: {
            id: true,
            label: true,
            code: true
          }
        }
      }
    });

    console.log('[API] Document mis à jour avec succès:', {
      id: updatedDocument.id,
      fileName: updatedDocument.fileName,
      documentTypeId: updatedDocument.documentTypeId,
      documentType: updatedDocument.DocumentType
    });

    return NextResponse.json({
      success: true,
      document: {
        id: updatedDocument.id,
        name: updatedDocument.fileName,
        typeId: updatedDocument.documentTypeId,
        type: updatedDocument.DocumentType ? {
          id: updatedDocument.DocumentType.id,
          label: updatedDocument.DocumentType.label,
          code: updatedDocument.DocumentType.code
        } : null,
        updatedAt: updatedDocument.updatedAt.toISOString()
      }
    });

  } catch (error) {
    console.error('Erreur lors de la modification du document brouillon:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la modification du document brouillon' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/uploads/staged/[id] - Supprimer un document brouillon
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    
    // Vérifier que le document existe et est en mode draft
    const existingDocument = await prisma.document.findFirst({
      where: { 
        id: params.id,
        status: 'draft',
        organizationId
      }
    });

    if (!existingDocument) {
      return NextResponse.json(
        { error: 'Document brouillon non trouvé' },
        { status: 404 }
      );
    }

    // Supprimer le document
    await prisma.document.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Erreur lors de la suppression du document brouillon:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du document brouillon' },
      { status: 500 }
    );
  }
}
