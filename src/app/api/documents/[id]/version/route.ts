import { NextRequest, NextResponse } from 'next/server';
import { DocumentsService } from '@/lib/services/documents';

/**
 * POST /api/documents/[id]/version - Créer une nouvelle version d'un document
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const uploadedBy = formData.get('uploadedBy') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convertir le File en Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const newVersion = await DocumentsService.createNewVersion(
      id,
      buffer,
      file.name,
      file.type,
      uploadedBy || undefined
    );

    return NextResponse.json({
      success: true,
      document: newVersion,
    });
  } catch (error: any) {
    console.error('Error creating document version:', error);
    return NextResponse.json(
      { error: 'Failed to create document version', details: error.message },
      { status: 500 }
    );
  }
}

