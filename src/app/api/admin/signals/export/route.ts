import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

// GET /api/admin/signals/export - Exporter le catalogue des signaux

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const signals = await prisma.signal.findMany({
      where: { deletedAt: null },
      orderBy: { code: 'asc' }
    });

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      signals: signals.map(s => ({
        code: s.code,
        label: s.label,
        regex: s.regex,
        flags: s.flags,
        description: s.description || '',
        protected: s.protected
      }))
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    
    return new NextResponse(jsonString, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="signals-catalog-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('Error exporting signals catalog:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'export du catalogue' },
      { status: 500 }
    );
  }
}

