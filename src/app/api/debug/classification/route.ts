import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { classificationService } from '@/services/ClassificationService';
import { prisma } from '@/lib/prisma';



/**
 * POST /api/debug/classification - Debug classification comparison
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentId, testText } = body;

    if (!documentId) {
      return NextResponse.json({ error: 'documentId requis' }, { status: 400 });
    }

    // RÃ©cupÃ©rer le document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        filenameOriginal: true,
        extractedText: true,
        size: true,
        mime: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });
    }

    const results = {};

    // Test 1: Classification avec le texte stockÃ© en base
    if (document.extractedText) {
      const result1 = await classificationService.classify(document.extractedText, {
        name: document.filenameOriginal,
        size: document.size,
        ocrStatus: 'unknown'
      });
      
      results.storedText = {
        textLength: document.extractedText.length,
        textPreview: document.extractedText.substring(0, 200),
        classification: {
          top3: result1.classification.top3.map(r => ({
            typeCode: r.typeCode,
            label: r.typeLabel,
            score: r.normalizedScore,
            threshold: r.threshold
          })),
          autoAssigned: result1.classification.autoAssigned
        }
      };
    }

    // Test 2: Classification avec le texte fourni (si fourni)
    if (testText) {
      const result2 = await classificationService.classify(testText, {
        name: document.filenameOriginal,
        size: document.size,
        ocrStatus: 'unknown'
      });
      
      results.testText = {
        textLength: testText.length,
        textPreview: testText.substring(0, 200),
        classification: {
          top3: result2.classification.top3.map(r => ({
            typeCode: r.typeCode,
            label: r.typeLabel,
            score: r.normalizedScore,
            threshold: r.threshold
          })),
          autoAssigned: result2.classification.autoAssigned
        }
      };
    }

    return NextResponse.json({
      success: true,
      documentId,
      results
    });

  } catch (error: any) {
    console.error('[Debug/Classification] Erreur:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}


