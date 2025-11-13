import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/document-types - RÃ©cupÃ©rer les types de documents
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const scope = searchParams.get('scope');
    const isRequired = searchParams.get('isRequired');
    const isActive = searchParams.get('isActive');

    const where: any = {};

    if (scope) {
      where.scope = scope;
    }

    if (isRequired !== null) {
      where.isRequired = isRequired === 'true';
    }

    if (isActive !== null) {
      where.isActive = isActive !== 'false'; // Par dÃ©faut true
    } else {
      where.isActive = true; // Par dÃ©faut, ne montrer que les actifs
    }

    const documentTypes = await prisma.documentType.findMany({
      where,
      orderBy: [
        { order: 'asc' },
        { label: 'asc' },
      ],
    });

    return NextResponse.json({
      documentTypes,
      total: documentTypes.length,
    });
  } catch (error: any) {
    console.error('Error fetching document types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document types', details: error.message },
      { status: 500 }
    );
  }
}
