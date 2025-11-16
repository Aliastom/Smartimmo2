import { NextRequest, NextResponse } from 'next/server';
import { DocumentsService } from '@/lib/services/documents';
import { requireAuth } from '@/lib/auth/getCurrentUser';

/**
 * GET /api/documents - Recherche et liste de documents
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const searchParams = request.nextUrl.searchParams;
    
    // Parse les paramètres de recherche
    const filters = {
      query: searchParams.get('query') || undefined,
      type: searchParams.get('type') || undefined,
      scope: searchParams.get('scope') as any || undefined,
      status: searchParams.get('status') as any || undefined,
      ocrStatus: searchParams.get('ocrStatus') as any || undefined,
      linkedTo: searchParams.get('linkedTo') || undefined,
      linkedId: searchParams.get('linkedId') || undefined,
      propertyId: searchParams.get('propertyId') || undefined,
      leaseId: searchParams.get('leaseId') || undefined,
      tenantId: searchParams.get('tenantId') || undefined,
      transactionId: searchParams.get('transactionId') || undefined,
      tags: searchParams.get('tags')?.split(',') || undefined,
      dateFrom: searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined,
      dateTo: searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined,
      includeDeleted: searchParams.get('includeDeleted') === 'true',
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    const result = await DocumentsService.search({ ...filters, organizationId });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/documents - Upload de documents
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const ownerId = user.id;

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Paramètres optionnels
    const linkedTo = (formData.get('linkedTo') as string) || 'global';
    const linkedId = formData.get('linkedId') as string | null;
    const hintedTypeKey = formData.get('hintedTypeKey') as string | null;
    const tagsStr = formData.get('tags') as string | null;
    const tags = tagsStr ? JSON.parse(tagsStr) : [];
    const source = (formData.get('source') as any) || 'upload';
    const uploadedBy = formData.get('uploadedBy') as string | null;

    const uploadedDocuments = [];

    for (const file of files) {
      const result = await DocumentsService.uploadAndCreate({
        file,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        linkedTo: linkedTo as any,
        linkedId: linkedId || undefined,
        hintedTypeKey: hintedTypeKey || undefined,
        tags,
        ownerId,
        organizationId,
        source,
        uploadedBy: uploadedBy || undefined,
      });

      uploadedDocuments.push(result);
    }

    return NextResponse.json({
      success: true,
      documents: uploadedDocuments,
    });
  } catch (error: any) {
    console.error('Error uploading documents:', error);
    return NextResponse.json(
      { error: 'Failed to upload documents', details: error.message },
      { status: 500 }
    );
  }
}
