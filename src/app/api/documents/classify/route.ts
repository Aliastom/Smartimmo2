import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { suggestTypeGlobal } from '@/services/documentSuggestion';
import { requireAuth } from '@/lib/auth/getCurrentUser';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

const classifyRequestSchema = z.object({
  context: z.string().optional(),
  filename: z.string(),
  mime: z.string(),
  ocr_excerpt: z.string().optional(),
});

// Fonction de classification des documents utilisant les types de la base de données
async function classifyDocument(
  context: string | undefined,
  filename: string,
  mime: string,
  ocr_excerpt: string | undefined
) {
  // Récupérer tous les types actifs avec leurs configurations
  const activeTypes = await prisma.documentType.findMany({
    where: { isActive: true },
    orderBy: [{ isSystem: 'desc' }, { order: 'asc' }]
  });

  // Parser les configurations JSON
  const parsedTypes = activeTypes.map(type => ({
    ...type,
    defaultContexts: type.defaultContexts ? JSON.parse(type.defaultContexts) : [],
    suggestionConfig: type.suggestionConfig ? JSON.parse(type.suggestionConfig) : null,
    lockInFlows: type.lockInFlows ? JSON.parse(type.lockInFlows) : [],
    metadataSchema: type.metadataSchema ? JSON.parse(type.metadataSchema) : null,
  }));

  // Extraire le contexte principal
  const contextType = extractContextType(context);

  // Utiliser le service de suggestion global
  const result = suggestTypeGlobal({
    context: contextType,
    filename,
    mime,
    ocrText: ocr_excerpt
  }, parsedTypes);

  return result;
}

// Fonction utilitaire pour extraire le type de contexte
function extractContextType(context: string | undefined): string {
  if (!context) return 'global';
  
  if (context.includes('transaction')) return 'transaction';
  if (context.includes('lease')) return 'lease';
  if (context.includes('property')) return 'property';
  if (context.includes('tenant')) return 'tenant';
  if (context.includes('loan')) return 'loan';
  
  return 'global';
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const validatedData = classifyRequestSchema.parse(body);

    const { context, filename, mime, ocr_excerpt } = validatedData;

    // Classification du document
    const classification = await classifyDocument(context, filename, mime, ocr_excerpt);

    return NextResponse.json(classification);
  } catch (error) {
    console.error('Error classifying document:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: error.errors 
        },
        { status: 400 }
      );
    }

    // En cas d'erreur, retourner MISC par défaut
    return NextResponse.json({
      type_code: 'MISC',
      confidence: 0.1,
      alternatives: [
        { type_code: 'RENT_RECEIPT', confidence: 0.05 },
        { type_code: 'SIGNED_LEASE', confidence: 0.05 }
      ],
      evidence: ['erreur_classification']
    });
  }
}
