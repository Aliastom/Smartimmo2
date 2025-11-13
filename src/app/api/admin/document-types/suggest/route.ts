import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { suggestTypeGlobal, SuggestionInput } from '@/services/documentSuggestion';
import { z } from 'zod';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

const suggestRequestSchema = z.object({
  context: z.string().optional(),
  filename: z.string().min(1, 'Filename is required'),
  mime: z.string().min(1, 'MIME type is required'),
  ocrText: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { context, filename, mime, ocrText } = suggestRequestSchema.parse(body);
    
    // Récupérer tous les types de documents actifs avec leurs configurations
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
    
    const input: SuggestionInput = {
      context,
      filename,
      mime,
      ocrText,
    };
    
    // Obtenir la suggestion
    const result = suggestTypeGlobal(input, parsedTypes);
    
    return NextResponse.json({
      success: true,
      result,
      input,
      availableTypes: parsedTypes.map(t => ({
        id: t.id,
        code: t.code,
        label: t.label,
        icon: t.icon
      }))
    });
  } catch (error) {
    console.error('Error suggesting document type:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Validation error', 
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to suggest document type' 
      },
      { status: 500 }
    );
  }
}
